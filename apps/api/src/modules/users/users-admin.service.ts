import type {
  AdminUserDto,
  ListUsersQuery,
  PaginatedResponse,
  RoleKey,
  SetUserRolesInput,
  UpdateUserStatusInput,
} from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { paginated, toSkipTake } from '../../common/http/pagination.js';
import type { RequestContext } from '../../common/http/request-context.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type DbClient, PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import { SessionService } from '../auth/session.service.js';
import { assertCanAssignRoles, assertCanManageAccount, diffRoles } from './user-admin.policy.js';

const userWithAccess = {
  roles: { include: { role: { select: { key: true } } } },
  totp: { select: { confirmedAt: true } },
} satisfies Prisma.UserInclude;

type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userWithAccess }>;

function rolesOf(user: UserWithAccess): RoleKey[] {
  return user.roles.map((entry) => entry.role.key);
}

function toDto(user: UserWithAccess): AdminUserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    status: user.status,
    roles: rolesOf(user),
    mfaEnabled: Boolean(user.totp?.confirmedAt),
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQuery): Promise<PaginatedResponse<AdminUserDto>> {
    const where: Prisma.UserWhereInput = {
      status: query.status,
      roles: query.role ? { some: { role: { key: query.role } } } : undefined,
      OR: query.search
        ? [
            { username: { contains: query.search.toLowerCase() } },
            { email: { contains: query.search.toLowerCase() } },
            { displayName: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userWithAccess,
        orderBy: [{ [query.sortBy]: query.sortDir }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(users.map(toDto), total, query);
  }

  async get(userId: string): Promise<AdminUserDto> {
    return toDto(await this.findOrThrow(userId));
  }

  /** Suspende ou reativa uma conta. A suspensão encerra todas as sessões da conta. */
  async updateStatus(
    actor: AuthContext,
    userId: string,
    input: UpdateUserStatusInput,
    context: RequestContext,
  ): Promise<AdminUserDto> {
    const target = await this.findOrThrow(userId);
    assertCanManageAccount(
      { id: actor.user.id, roles: actor.roles },
      { id: target.id, roles: rolesOf(target) },
    );

    const allowedFrom = input.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    if (target.status !== allowedFrom) {
      throw new AppError('CONFLICT', {
        detail:
          input.status === 'SUSPENDED'
            ? 'Somente contas ativas podem ser suspensas.'
            : 'Somente contas suspensas podem ser reativadas.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // O filtro pelo estado anterior torna a operação idempotente sob concorrência.
      const changed = await tx.user.updateMany({
        where: { id: userId, status: allowedFrom },
        data: { status: input.status },
      });
      if (changed.count !== 1) {
        throw new AppError('CONFLICT', {
          detail: 'O estado da conta mudou. Atualize e tente de novo.',
        });
      }
      const endedSessions =
        input.status === 'SUSPENDED'
          ? await this.sessions.endAllForUser(userId, 'ACCOUNT_SUSPENDED', { db: tx })
          : 0;
      await this.audit.record(
        {
          action: 'admin.user.status_changed',
          actorUserId: actor.user.id,
          entityType: 'user',
          entityId: userId,
          metadata: { from: target.status, to: input.status, reason: input.reason, endedSessions },
          context,
        },
        tx,
      );
      return this.findOrThrow(userId, tx);
    });
    return toDto(updated);
  }

  /** Substitui o conjunto de papéis da conta, respeitando o que o ator pode conceder. */
  async setRoles(
    actor: AuthContext,
    userId: string,
    input: SetUserRolesInput,
    context: RequestContext,
  ): Promise<AdminUserDto> {
    const target = await this.findOrThrow(userId);
    const currentRoles = rolesOf(target);
    const actorRef = { id: actor.user.id, roles: actor.roles };
    assertCanManageAccount(actorRef, { id: target.id, roles: currentRoles });

    const change = diffRoles(currentRoles, input.roles);
    assertCanAssignRoles(actorRef, change);
    if (change.added.length === 0 && change.removed.length === 0) {
      return toDto(target);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (change.removed.length > 0) {
        await tx.userRole.deleteMany({
          where: { userId, role: { key: { in: change.removed } } },
        });
      }
      for (const key of change.added) {
        const role = await tx.role.findUniqueOrThrow({ where: { key }, select: { id: true } });
        await tx.userRole.create({
          data: { userId, roleId: role.id, grantedById: actor.user.id },
        });
      }
      await this.assertSuperAdminRemains(tx);
      await this.audit.record(
        {
          action: 'admin.user.roles_changed',
          actorUserId: actor.user.id,
          entityType: 'user',
          entityId: userId,
          metadata: { added: change.added, removed: change.removed },
          context,
        },
        tx,
      );
      return this.findOrThrow(userId, tx);
    });
    return toDto(updated);
  }

  /** A federação nunca pode ficar sem um superadministrador ativo. */
  private async assertSuperAdminRemains(db: DbClient): Promise<void> {
    const remaining = await db.userRole.count({
      where: { role: { key: 'SUPER_ADMIN' }, user: { status: 'ACTIVE' } },
    });
    if (remaining === 0) {
      throw new AppError('CONFLICT', {
        detail: 'A federação precisa manter pelo menos um superadministrador ativo.',
      });
    }
  }

  private async findOrThrow(userId: string, db: DbClient = this.prisma): Promise<UserWithAccess> {
    const user = await db.user.findUnique({ where: { id: userId }, include: userWithAccess });
    if (!user) {
      throw new AppError('NOT_FOUND');
    }
    return user;
  }
}
