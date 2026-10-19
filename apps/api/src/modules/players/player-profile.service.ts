import { randomUUID } from 'node:crypto';
import type { MyPlayerProfileDto, UpsertPlayerProfile } from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import type { RequestContext } from '../../common/http/request-context.js';
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
import { mediaUrl } from '../media/media.controller.js';

const profileInclude = {
  memberships: { where: { endedOn: null }, include: { club: true }, take: 1 },
} satisfies Prisma.PlayerProfileInclude;

type ProfileRow = Prisma.PlayerProfileGetPayload<{ include: typeof profileInclude }>;

const EDITABLE_FIELDS = ['nickname', 'efootballId', 'platform', 'country', 'region'] as const;

function toDto(row: ProfileRow): MyPlayerProfileDto {
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
    club: club
      ? {
          slug: club.slug,
          name: club.name,
          tag: club.tag,
          primaryColor: club.primaryColor,
          secondaryColor: club.secondaryColor,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Perfil esportivo do próprio jogador: identificação no eFootball, país e avatar. */
@Injectable()
export class PlayerProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async getMine(auth: AuthContext): Promise<MyPlayerProfileDto | null> {
    const row = await this.find(auth.user.id);
    return row ? toDto(row) : null;
  }

  /** Cria o perfil no primeiro envio; depois, atualiza. A URL pública é o nome de usuário. */
  async upsertMine(
    auth: AuthContext,
    input: UpsertPlayerProfile,
    context: RequestContext,
  ): Promise<MyPlayerProfileDto> {
    await this.assertEfootballIdFree(auth.user.id, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await this.find(auth.user.id, tx);
        if (!current) {
          const created = await tx.playerProfile.create({
            data: { userId: auth.user.id, slug: auth.user.username, ...input },
          });
          await this.audit.record(
            {
              action: 'player.profile.created',
              actorUserId: auth.user.id,
              entityType: 'player',
              entityId: created.id,
              context,
            },
            tx,
          );
        } else {
          const changed = EDITABLE_FIELDS.filter((field) => current[field] !== input[field]);
          if (changed.length === 0) {
            return toDto(current);
          }
          await tx.playerProfile.update({ where: { id: current.id }, data: input });
          await this.audit.record(
            {
              action: 'player.profile.updated',
              actorUserId: auth.user.id,
              entityType: 'player',
              entityId: current.id,
              metadata: { fields: changed },
              context,
            },
            tx,
          );
        }
        return toDto(await this.findOrThrow(auth.user.id, tx));
      });
    } catch (error) {
      // Dois cadastros simultâneos do mesmo ID: o índice único decide.
      if (isUniqueViolation(error, 'efootball')) {
        throw new AppError('EFOOTBALL_ID_TAKEN');
      }
      throw error;
    }
  }

  async setAvatar(
    auth: AuthContext,
    file: Buffer | undefined,
    context: RequestContext,
  ): Promise<MyPlayerProfileDto> {
    const profile = await this.findOrThrow(auth.user.id);
    const image = await normalizeImage(file, 'cover');
    const key = `avatars/${randomUUID()}.webp`;
    await this.storage.put(key, image, IMAGE_CONTENT_TYPE);
    return this.replaceAvatar(auth, profile, key, context);
  }

  async removeAvatar(auth: AuthContext, context: RequestContext): Promise<MyPlayerProfileDto> {
    const profile = await this.findOrThrow(auth.user.id);
    if (!profile.avatarKey) {
      return toDto(profile);
    }
    return this.replaceAvatar(auth, profile, null, context);
  }

  private async replaceAvatar(
    auth: AuthContext,
    profile: ProfileRow,
    key: string | null,
    context: RequestContext,
  ): Promise<MyPlayerProfileDto> {
    const updated = await this.prisma
      .$transaction(async (tx) => {
        // Condicional ao avatar lido: dois envios simultâneos não deixam um objeto sem dono.
        const changed = await tx.playerProfile.updateMany({
          where: { id: profile.id, avatarKey: profile.avatarKey },
          data: { avatarKey: key },
        });
        if (changed.count !== 1) {
          throw new AppError('CONFLICT', { detail: 'O avatar mudou. Atualize e tente de novo.' });
        }
        await this.audit.record(
          {
            action: key ? 'player.avatar.updated' : 'player.avatar.removed',
            actorUserId: auth.user.id,
            entityType: 'player',
            entityId: profile.id,
            context,
          },
          tx,
        );
        return this.findOrThrow(auth.user.id, tx);
      })
      .catch(async (error: unknown) => {
        if (key) {
          await this.storage.deleteQuietly(key);
        }
        throw error;
      });
    if (profile.avatarKey) {
      await this.storage.deleteQuietly(profile.avatarKey);
    }
    return toDto(updated);
  }

  private async assertEfootballIdFree(userId: string, input: UpsertPlayerProfile): Promise<void> {
    const taken = await this.prisma.playerProfile.findFirst({
      where: {
        platform: input.platform,
        efootballId: { equals: input.efootballId, mode: 'insensitive' },
        NOT: { userId },
      },
      select: { id: true },
    });
    if (taken) {
      throw new AppError('EFOOTBALL_ID_TAKEN');
    }
  }

  private find(userId: string, db: DbClient = this.prisma): Promise<ProfileRow | null> {
    return db.playerProfile.findUnique({ where: { userId }, include: profileInclude });
  }

  private async findOrThrow(userId: string, db: DbClient = this.prisma): Promise<ProfileRow> {
    const row = await this.find(userId, db);
    if (!row) {
      throw new AppError('NOT_FOUND', { detail: 'Crie seu perfil de jogador primeiro.' });
    }
    return row;
  }
}
