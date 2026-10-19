import { randomUUID } from 'node:crypto';
import type { AdminClubDto, ClubData, ListClubsQuery, PaginatedResponse } from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { paginated, toSkipTake } from '../../common/http/pagination.js';
import type { RequestContext } from '../../common/http/request-context.js';
import { dateOnly } from '../../common/time/federation-time.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  type DbClient,
  isUniqueViolation,
  PrismaService,
} from '../../infra/prisma/prisma.service.js';
import { IMAGE_CONTENT_TYPE, normalizeImage } from '../../infra/storage/images.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import { toPublicClub } from './club-mappers.js';

const clubInclude = {
  manager: { select: { id: true, username: true, displayName: true } },
  _count: { select: { memberships: { where: { endedOn: null } } } },
} satisfies Prisma.ClubInclude;

type ClubRow = Prisma.ClubGetPayload<{ include: typeof clubInclude }>;

const AUDITED_FIELDS = [
  'name',
  'tag',
  'primaryColor',
  'secondaryColor',
  'foundedOn',
  'status',
  'managerUserId',
] as const;

function toDto(row: ClubRow): AdminClubDto {
  return {
    ...toPublicClub(row),
    id: row.id,
    status: row.status,
    foundedOn: row.foundedOn ? dateOnly(row.foundedOn) : null,
    manager: row.manager,
    members: row._count.memberships,
    createdAt: row.createdAt.toISOString(),
  };
}

/** "Esporte Clube São João" → "esporte-clube-sao-joao". */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
}

/** Cadastro e manutenção de clubes pela federação. */
@Injectable()
export class ClubsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListClubsQuery): Promise<PaginatedResponse<AdminClubDto>> {
    const where: Prisma.ClubWhereInput = {
      status: query.status,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' } },
            { tag: { contains: query.search.toUpperCase() } },
          ]
        : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.club.findMany({
        where,
        include: clubInclude,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.club.count({ where }),
    ]);
    return paginated(rows.map(toDto), total, query);
  }

  async get(id: string): Promise<AdminClubDto> {
    return toDto(await this.findOrThrow(id));
  }

  async create(
    actor: AuthContext,
    input: ClubData,
    context: RequestContext,
  ): Promise<AdminClubDto> {
    const managerUserId = await this.resolveManager(input.managerUsername);
    const id = await this.withTagCheck(() =>
      this.prisma.$transaction(async (tx) => {
        const club = await tx.club.create({
          data: {
            ...this.columns(input, managerUserId),
            slug: await this.freeSlug(input.name, tx),
          },
        });
        await this.audit.record(
          {
            action: 'club.created',
            actorUserId: actor.user.id,
            entityType: 'club',
            entityId: club.id,
            metadata: { name: club.name, tag: club.tag },
            context,
          },
          tx,
        );
        return club.id;
      }),
    );
    return this.get(id);
  }

  /** O slug (URL pública) não muda com o nome: links já compartilhados continuam válidos. */
  async update(
    actor: AuthContext,
    id: string,
    input: ClubData,
    context: RequestContext,
  ): Promise<AdminClubDto> {
    const current = await this.findOrThrow(id);
    const managerUserId = await this.resolveManager(input.managerUsername);
    const next = this.columns(input, managerUserId);
    const changed = AUDITED_FIELDS.filter((field) =>
      field === 'foundedOn'
        ? (current.foundedOn?.getTime() ?? null) !== (next.foundedOn?.getTime() ?? null)
        : current[field] !== next[field],
    );
    if (changed.length === 0) {
      return toDto(current);
    }
    await this.withTagCheck(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.club.update({ where: { id }, data: next });
        await this.audit.record(
          {
            action: 'club.updated',
            actorUserId: actor.user.id,
            entityType: 'club',
            entityId: id,
            metadata: { fields: changed },
            context,
          },
          tx,
        );
      }),
    );
    return this.get(id);
  }

  async setCrest(
    actor: AuthContext,
    id: string,
    file: Buffer | undefined,
    context: RequestContext,
  ): Promise<AdminClubDto> {
    const club = await this.findOrThrow(id);
    const image = await normalizeImage(file, 'contain');
    const key = `crests/${randomUUID()}.webp`;
    await this.storage.put(key, image, IMAGE_CONTENT_TYPE);
    return this.replaceCrest(actor, club, key, context);
  }

  async removeCrest(
    actor: AuthContext,
    id: string,
    context: RequestContext,
  ): Promise<AdminClubDto> {
    const club = await this.findOrThrow(id);
    return club.crestKey ? this.replaceCrest(actor, club, null, context) : toDto(club);
  }

  private async replaceCrest(
    actor: AuthContext,
    club: ClubRow,
    key: string | null,
    context: RequestContext,
  ): Promise<AdminClubDto> {
    await this.prisma
      .$transaction(async (tx) => {
        const changed = await tx.club.updateMany({
          where: { id: club.id, crestKey: club.crestKey },
          data: { crestKey: key },
        });
        if (changed.count !== 1) {
          throw new AppError('CONFLICT', { detail: 'O escudo mudou. Atualize e tente de novo.' });
        }
        await this.audit.record(
          {
            action: key ? 'club.crest.updated' : 'club.crest.removed',
            actorUserId: actor.user.id,
            entityType: 'club',
            entityId: club.id,
            context,
          },
          tx,
        );
      })
      .catch(async (error: unknown) => {
        if (key) {
          await this.storage.deleteQuietly(key);
        }
        throw error;
      });
    if (club.crestKey) {
      await this.storage.deleteQuietly(club.crestKey);
    }
    return this.get(club.id);
  }

  private columns(input: ClubData, managerUserId: string | null) {
    return {
      name: input.name,
      tag: input.tag,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      foundedOn: input.foundedOn ? new Date(`${input.foundedOn}T00:00:00.000Z`) : null,
      status: input.status,
      managerUserId,
    };
  }

  private async resolveManager(username: string | null): Promise<string | null> {
    if (!username) {
      return null;
    }
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('VALIDATION_FAILED', {
        errors: [{ path: 'managerUsername', message: 'Nenhuma conta ativa com este usuário.' }],
      });
    }
    return user.id;
  }

  private async freeSlug(name: string, db: DbClient): Promise<string> {
    const base = slugify(name) || 'clube';
    const taken = new Set(
      (
        await db.club.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })
      ).map((club) => club.slug),
    );
    let slug = base;
    for (let n = 2; taken.has(slug); n += 1) {
      slug = `${base}-${n}`;
    }
    return slug;
  }

  private async withTagCheck<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isUniqueViolation(error, 'tag')) {
        throw new AppError('VALIDATION_FAILED', {
          errors: [{ path: 'tag', message: 'Esta sigla já é usada por outro clube.' }],
        });
      }
      if (isUniqueViolation(error, 'slug')) {
        // Dois cadastros simultâneos com o mesmo nome.
        throw new AppError('CONFLICT', {
          detail: 'Outro clube com este nome acabou de ser criado.',
        });
      }
      throw error;
    }
  }

  /**
   * Fora de transações: com várias relações, o Prisma as busca em paralelo, o que numa transação
   * (uma única conexão) gera consultas simultâneas no mesmo cliente do `pg`.
   */
  private async findOrThrow(id: string): Promise<ClubRow> {
    const row = await this.prisma.club.findUnique({ where: { id }, include: clubInclude });
    if (!row) {
      throw new AppError('NOT_FOUND');
    }
    return row;
  }
}
