import type {
  ListTransfersQuery,
  MembershipDto,
  MyClubDto,
  PaginatedResponse,
  RequestTransfer,
  TransferDto,
} from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { paginated, toSkipTake } from '../../common/http/pagination.js';
import type { RequestContext } from '../../common/http/request-context.js';
import { dateOnly, federationDate } from '../../common/time/federation-time.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { isUniqueViolation, PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import { mediaUrl } from '../media/media.controller.js';
import { toPublicClub } from './club-mappers.js';
import {
  assertCanRequestTransfer,
  assertManagesClub,
  initialTransferStatus,
} from './transfer.policy.js';

const transferInclude = {
  player: { select: { slug: true, nickname: true, avatarKey: true } },
  fromClub: true,
  toClub: true,
} satisfies Prisma.ClubTransferInclude;

type TransferRow = Prisma.ClubTransferGetPayload<{ include: typeof transferInclude }>;

const OPEN = ['PENDING_CLUB', 'PENDING_ADMIN'] as const;
const RECENT_DECIDED = 5;

function toTransferDto(row: TransferRow): TransferDto {
  return {
    id: row.id,
    player: {
      slug: row.player.slug,
      nickname: row.player.nickname,
      avatarUrl: mediaUrl(row.player.avatarKey),
    },
    fromClub: row.fromClub ? toPublicClub(row.fromClub) : null,
    toClub: toPublicClub(row.toClub),
    status: row.status,
    note: row.note,
    decisionReason: row.decisionReason,
    createdAt: row.createdAt.toISOString(),
    clubDecidedAt: row.clubDecidedAt?.toISOString() ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

function toMembershipDto(
  row: Prisma.ClubMembershipGetPayload<{ include: { club: true } }>,
): MembershipDto {
  return {
    club: toPublicClub(row.club),
    startedOn: dateOnly(row.startedOn),
    endedOn: row.endedOn ? dateOnly(row.endedOn) : null,
  };
}

/** Dia civil de hoje no fuso da federação, no formato da coluna DATE. */
function today(): Date {
  return new Date(`${federationDate(new Date())}T00:00:00.000Z`);
}

/**
 * Vínculos e transferências. Vínculos passados nunca mudam: uma transferência aprovada encerra o
 * vínculo ativo (data de fim) e cria outro. Cada decisão é um UPDATE condicional ao estado lido,
 * então repetir a chamada não repete o efeito.
 */
@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Jogador ----------------------------------------------------------------------------

  async myClub(auth: AuthContext): Promise<MyClubDto> {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId: auth.user.id },
      select: { id: true },
    });
    if (!profile) {
      return { current: null, history: [], openTransfer: null, recentTransfers: [] };
    }
    const [memberships, open, recent] = await Promise.all([
      this.prisma.clubMembership.findMany({
        where: { playerId: profile.id },
        include: { club: true },
        orderBy: [{ startedOn: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.clubTransfer.findFirst({
        where: { playerId: profile.id, status: { in: [...OPEN] } },
        include: transferInclude,
      }),
      this.prisma.clubTransfer.findMany({
        where: { playerId: profile.id, status: { notIn: [...OPEN] } },
        include: transferInclude,
        orderBy: { createdAt: 'desc' },
        take: RECENT_DECIDED,
      }),
    ]);
    const current = memberships.find((membership) => membership.endedOn === null);
    return {
      current: current ? toMembershipDto(current) : null,
      history: memberships.filter((m) => m.endedOn !== null).map(toMembershipDto),
      openTransfer: open ? toTransferDto(open) : null,
      recentTransfers: recent.map(toTransferDto),
    };
  }

  async request(
    auth: AuthContext,
    input: RequestTransfer,
    context: RequestContext,
  ): Promise<TransferDto> {
    const profile = await this.profileOrThrow(auth);
    const target = await this.prisma.club.findUnique({ where: { slug: input.toClubSlug } });
    if (!target) {
      throw new AppError('VALIDATION_FAILED', {
        errors: [{ path: 'toClubSlug', message: 'Clube não encontrado.' }],
      });
    }
    const current = await this.prisma.clubMembership.findFirst({
      where: { playerId: profile.id, endedOn: null },
      select: { clubId: true },
    });
    assertCanRequestTransfer(target, current?.clubId ?? null);

    let id: string;
    try {
      id = await this.prisma.$transaction(async (tx) => {
        const transfer = await tx.clubTransfer.create({
          data: {
            playerId: profile.id,
            fromClubId: current?.clubId ?? null,
            toClubId: target.id,
            status: initialTransferStatus(target, auth.user.id),
            note: input.note,
          },
        });
        await this.audit.record(
          {
            action: 'transfer.requested',
            actorUserId: auth.user.id,
            entityType: 'transfer',
            entityId: transfer.id,
            metadata: { from: transfer.fromClubId, to: transfer.toClubId, status: transfer.status },
            context,
          },
          tx,
        );
        return transfer.id;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('CONFLICT', {
          detail: 'Você já tem um pedido de transferência em aberto.',
        });
      }
      throw error;
    }
    return toTransferDto(await this.findOrThrow(id));
  }

  async cancel(auth: AuthContext, id: string, context: RequestContext): Promise<TransferDto> {
    const profile = await this.profileOrThrow(auth);
    const transfer = await this.findOrThrow(id);
    if (transfer.playerId !== profile.id) {
      throw new AppError('NOT_FOUND');
    }
    return this.decide({
      transfer,
      from: OPEN,
      data: { status: 'CANCELED', decidedById: auth.user.id, decidedAt: new Date() },
      action: 'transfer.canceled',
      actorUserId: auth.user.id,
      context,
    });
  }

  /** Sair do clube: encerra o vínculo ativo, sem apagar nada do histórico. */
  async leave(auth: AuthContext, context: RequestContext): Promise<MyClubDto> {
    const profile = await this.profileOrThrow(auth);
    await this.prisma.$transaction(async (tx) => {
      const open = await tx.clubTransfer.count({
        where: { playerId: profile.id, status: { in: [...OPEN] } },
      });
      if (open > 0) {
        throw new AppError('CONFLICT', {
          detail: 'Cancele o pedido de transferência em aberto antes de sair do clube.',
        });
      }
      const membership = await tx.clubMembership.findFirst({
        where: { playerId: profile.id, endedOn: null },
      });
      if (!membership) {
        throw new AppError('CONFLICT', { detail: 'Você não faz parte de nenhum clube.' });
      }
      const ended = await tx.clubMembership.updateMany({
        where: { id: membership.id, endedOn: null },
        data: { endedOn: today() },
      });
      if (ended.count !== 1) {
        throw new AppError('CONFLICT', { detail: 'O vínculo mudou. Atualize e tente de novo.' });
      }
      await this.audit.record(
        {
          action: 'membership.left',
          actorUserId: auth.user.id,
          entityType: 'membership',
          entityId: membership.id,
          metadata: { clubId: membership.clubId },
          context,
        },
        tx,
      );
    });
    return this.myClub(auth);
  }

  // --- Responsável do clube ---------------------------------------------------------------

  async clubRequests(auth: AuthContext): Promise<TransferDto[]> {
    const rows = await this.prisma.clubTransfer.findMany({
      where: { status: 'PENDING_CLUB', toClub: { managerUserId: auth.user.id } },
      include: transferInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toTransferDto);
  }

  async clubDecision(
    auth: AuthContext,
    id: string,
    decision: { accept: true } | { accept: false; reason: string },
    context: RequestContext,
  ): Promise<TransferDto> {
    const transfer = await this.findOrThrow(id);
    assertManagesClub(transfer.toClub, auth.user.id);
    const now = new Date();
    return this.decide({
      transfer,
      from: ['PENDING_CLUB'],
      data: decision.accept
        ? { status: 'PENDING_ADMIN', clubDecidedById: auth.user.id, clubDecidedAt: now }
        : {
            status: 'REJECTED',
            clubDecidedById: auth.user.id,
            clubDecidedAt: now,
            decidedById: auth.user.id,
            decidedAt: now,
            decisionReason: decision.reason,
          },
      action: decision.accept ? 'transfer.club_accepted' : 'transfer.club_rejected',
      actorUserId: auth.user.id,
      context,
    });
  }

  // --- Federação --------------------------------------------------------------------------

  async list(query: ListTransfersQuery): Promise<PaginatedResponse<TransferDto>> {
    const where: Prisma.ClubTransferWhereInput = { status: query.status };
    const [rows, total] = await Promise.all([
      this.prisma.clubTransfer.findMany({
        where,
        include: transferInclude,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.clubTransfer.count({ where }),
    ]);
    return paginated(rows.map(toTransferDto), total, query);
  }

  async approve(auth: AuthContext, id: string, context: RequestContext): Promise<TransferDto> {
    const transfer = await this.findOrThrow(id);
    return this.decide({
      transfer,
      from: ['PENDING_ADMIN'],
      data: { status: 'APPROVED', decidedById: auth.user.id, decidedAt: new Date() },
      action: 'transfer.approved',
      actorUserId: auth.user.id,
      context,
      effect: async (tx) => {
        const club = await tx.club.findUniqueOrThrow({ where: { id: transfer.toClubId } });
        if (club.status !== 'ACTIVE') {
          throw new AppError('CONFLICT', { detail: 'O clube de destino está inativo.' });
        }
        const startedOn = today();
        await tx.clubMembership.updateMany({
          where: { playerId: transfer.playerId, endedOn: null },
          data: { endedOn: startedOn },
        });
        await tx.clubMembership.create({
          data: { clubId: transfer.toClubId, playerId: transfer.playerId, startedOn },
        });
      },
    });
  }

  async reject(
    auth: AuthContext,
    id: string,
    reason: string,
    context: RequestContext,
  ): Promise<TransferDto> {
    const transfer = await this.findOrThrow(id);
    return this.decide({
      transfer,
      from: ['PENDING_ADMIN'],
      data: {
        status: 'REJECTED',
        decidedById: auth.user.id,
        decidedAt: new Date(),
        decisionReason: reason,
      },
      action: 'transfer.rejected',
      actorUserId: auth.user.id,
      context,
    });
  }

  // ----------------------------------------------------------------------------------------

  /** Muda o estado só se ele ainda for um dos esperados; efeito e auditoria na mesma transação. */
  private async decide(options: {
    transfer: TransferRow;
    from: readonly TransferRow['status'][];
    data: Prisma.ClubTransferUncheckedUpdateManyInput;
    action:
      | 'transfer.canceled'
      | 'transfer.club_accepted'
      | 'transfer.club_rejected'
      | 'transfer.approved'
      | 'transfer.rejected';
    actorUserId: string;
    context: RequestContext;
    effect?: (tx: Prisma.TransactionClient) => Promise<void>;
  }): Promise<TransferDto> {
    const { transfer } = options;
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.clubTransfer.updateMany({
        where: { id: transfer.id, status: { in: [...options.from] } },
        data: options.data,
      });
      if (changed.count !== 1) {
        throw new AppError('CONFLICT', {
          detail: 'Este pedido já foi decidido ou cancelado. Atualize a página.',
        });
      }
      await options.effect?.(tx);
      await this.audit.record(
        {
          action: options.action,
          actorUserId: options.actorUserId,
          entityType: 'transfer',
          entityId: transfer.id,
          metadata: {
            from: transfer.status,
            to: options.data.status as string,
            ...(typeof options.data.decisionReason === 'string'
              ? { reason: options.data.decisionReason }
              : {}),
          },
          context: options.context,
        },
        tx,
      );
    });
    return toTransferDto(await this.findOrThrow(transfer.id));
  }

  private async profileOrThrow(auth: AuthContext): Promise<{ id: string }> {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId: auth.user.id },
      select: { id: true },
    });
    if (!profile) {
      throw new AppError('NOT_FOUND', { detail: 'Crie seu perfil de jogador primeiro.' });
    }
    return profile;
  }

  /** Fora de transações (ver `ClubsAdminService.findOrThrow`). */
  private async findOrThrow(id: string): Promise<TransferRow> {
    const row = await this.prisma.clubTransfer.findUnique({
      where: { id },
      include: transferInclude,
    });
    if (!row) {
      throw new AppError('NOT_FOUND');
    }
    return row;
  }
}
