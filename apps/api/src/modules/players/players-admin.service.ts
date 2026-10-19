import type {
  AdminPlayerDto,
  AdminUpdatePlayer,
  ListPlayersQuery,
  PaginatedResponse,
} from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { paginated, toSkipTake } from '../../common/http/pagination.js';
import type { RequestContext } from '../../common/http/request-context.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { isUniqueViolation, PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import { toPublicClub } from '../clubs/club-mappers.js';
import { mediaUrl } from '../media/media.controller.js';

const playerInclude = {
  user: { select: { id: true, username: true, displayName: true, status: true } },
  memberships: { where: { endedOn: null }, include: { club: true }, take: 1 },
} satisfies Prisma.PlayerProfileInclude;
type PlayerRow = Prisma.PlayerProfileGetPayload<{ include: typeof playerInclude }>;

const EDITABLE = ['nickname', 'efootballId', 'platform', 'country', 'region'] as const;

function toDto(row: PlayerRow): AdminPlayerDto {
  const club = row.memberships[0]?.club;
  return {
    id: row.id,
    slug: row.slug,
    nickname: row.nickname,
    efootballId: row.efootballId,
    platform: row.platform,
    country: row.country,
    region: row.region,
    avatarUrl: mediaUrl(row.avatarKey),
    club: club ? toPublicClub(club) : null,
    user: row.user,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Gestão de perfis pela federação: busca, correção de dados e moderação do avatar. */
@Injectable()
export class PlayersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListPlayersQuery): Promise<PaginatedResponse<AdminPlayerDto>> {
    const where: Prisma.PlayerProfileWhereInput = query.search
      ? {
          OR: [
            { nickname: { contains: query.search, mode: 'insensitive' } },
            { efootballId: { contains: query.search, mode: 'insensitive' } },
            { user: { username: { contains: query.search.toLowerCase() } } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.playerProfile.findMany({
        where,
        include: playerInclude,
        orderBy: [{ nickname: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.playerProfile.count({ where }),
    ]);
    return paginated(rows.map(toDto), total, query);
  }

  async update(
    actor: AuthContext,
    id: string,
    input: AdminUpdatePlayer,
    context: RequestContext,
  ): Promise<AdminPlayerDto> {
    const current = await this.findOrThrow(id);
    const { reason, ...data } = input;
    const changed = EDITABLE.filter((field) => current[field] !== data[field]);
    if (changed.length === 0) {
      return toDto(current);
    }
    const taken = await this.prisma.playerProfile.findFirst({
      where: {
        platform: data.platform,
        efootballId: { equals: data.efootballId, mode: 'insensitive' },
        NOT: { id },
      },
      select: { id: true },
    });
    if (taken) {
      throw new AppError('EFOOTBALL_ID_TAKEN');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.playerProfile.update({ where: { id }, data });
        await this.audit.record(
          {
            action: 'admin.player.updated',
            actorUserId: actor.user.id,
            entityType: 'player',
            entityId: id,
            metadata: { fields: changed, reason },
            context,
          },
          tx,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error, 'efootball')) {
        throw new AppError('EFOOTBALL_ID_TAKEN');
      }
      throw error;
    }
    return toDto(await this.findOrThrow(id));
  }

  async removeAvatar(
    actor: AuthContext,
    id: string,
    context: RequestContext,
  ): Promise<AdminPlayerDto> {
    const current = await this.findOrThrow(id);
    if (!current.avatarKey) {
      return toDto(current);
    }
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.playerProfile.updateMany({
        where: { id, avatarKey: current.avatarKey },
        data: { avatarKey: null },
      });
      if (changed.count !== 1) {
        throw new AppError('CONFLICT', { detail: 'O avatar mudou. Atualize e tente de novo.' });
      }
      await this.audit.record(
        {
          action: 'admin.player.avatar_removed',
          actorUserId: actor.user.id,
          entityType: 'player',
          entityId: id,
          context,
        },
        tx,
      );
    });
    await this.storage.deleteQuietly(current.avatarKey);
    return toDto(await this.findOrThrow(id));
  }

  private async findOrThrow(id: string): Promise<PlayerRow> {
    const row = await this.prisma.playerProfile.findUnique({
      where: { id },
      include: playerInclude,
    });
    if (!row) {
      throw new AppError('NOT_FOUND');
    }
    return row;
  }
}
