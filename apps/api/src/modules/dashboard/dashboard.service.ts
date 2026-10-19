import {
  type DashboardSummaryDto,
  MFA_REQUIRED_ROLES,
  ROLE_KEYS,
  type RoleKey,
  USER_STATUSES,
  type UserStatus,
} from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 14;

function zeroed<Key extends string>(keys: readonly Key[]): Record<Key, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;
}

/** Indicadores do painel administrativo, sempre calculados a partir do banco. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<DashboardSummaryDto> {
    const now = new Date();
    const last7 = new Date(now.getTime() - 7 * DAY_MS);
    const previous7 = new Date(now.getTime() - 14 * DAY_MS);
    const last24h = new Date(now.getTime() - DAY_MS);
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const trendStart = new Date(todayUtc - (TREND_DAYS - 1) * DAY_MS);

    const [
      statusGroups,
      roleGroups,
      registeredLast7Days,
      registeredPrevious7Days,
      activeSessions,
      adminsWithoutMfa,
      failedLoginsLast24h,
      dailyRegistrations,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.role.findMany({ select: { key: true, _count: { select: { users: true } } } }),
      this.prisma.user.count({ where: { createdAt: { gte: last7 } } }),
      this.prisma.user.count({ where: { createdAt: { gte: previous7, lt: last7 } } }),
      this.prisma.session.count({
        where: { endedAt: null, expiresAt: { gt: now }, idleExpiresAt: { gt: now } },
      }),
      this.prisma.user.count({
        where: {
          status: 'ACTIVE',
          roles: { some: { role: { key: { in: [...MFA_REQUIRED_ROLES] } } } },
          OR: [{ totp: null }, { totp: { confirmedAt: null } }],
        },
      }),
      this.prisma.auditLog.count({
        where: { action: 'auth.login.failed', occurredAt: { gte: last24h } },
      }),
      this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day, count(*) AS count
        FROM users
        WHERE created_at >= ${trendStart}
        GROUP BY 1
      `,
    ]);

    const byStatus = zeroed<UserStatus>(USER_STATUSES);
    for (const group of statusGroups) {
      byStatus[group.status] = group._count._all;
    }
    const roles = zeroed<RoleKey>(ROLE_KEYS);
    for (const role of roleGroups) {
      roles[role.key] = role._count.users;
    }

    const countsByDay = new Map(
      dailyRegistrations.map((row) => [row.day.toISOString().slice(0, 10), Number(row.count)]),
    );
    const registrationsByDay = Array.from({ length: TREND_DAYS }, (_unused, index) => {
      const date = new Date(trendStart.getTime() + index * DAY_MS).toISOString().slice(0, 10);
      return { date, count: countsByDay.get(date) ?? 0 };
    });

    return {
      users: {
        total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
        byStatus,
        registeredLast7Days,
        registeredPrevious7Days,
      },
      roles,
      security: { activeSessions, adminsWithoutMfa, failedLoginsLast24h },
      registrationsByDay,
      generatedAt: now.toISOString(),
    };
  }
}
