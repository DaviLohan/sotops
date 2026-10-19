import type { AuditLogDto, ListAuditLogsQuery, PaginatedResponse } from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { paginated, toSkipTake } from '../../common/http/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditLogsQuery): Promise<PaginatedResponse<AuditLogDto>> {
    const where: Prisma.AuditLogWhereInput = {
      action: query.action ? { startsWith: query.action } : undefined,
      actorUserId: query.actorId,
      entityType: query.entityType,
      entityId: query.entityId,
      occurredAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        include: { actor: { select: { id: true, username: true, displayName: true } } },
        ...toSkipTake(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const data = rows.map<AuditLogDto>((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      action: row.action,
      actor: row.actor,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      ipAddress: row.ipAddress,
      requestId: row.requestId,
    }));
    return paginated(data, total, query);
  }
}
