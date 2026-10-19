import { Injectable } from '@nestjs/common';
import type { RequestContext } from '../../common/http/request-context.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { type DbClient, PrismaService } from '../../infra/prisma/prisma.service.js';

export type AuditAction =
  | 'auth.register'
  | 'auth.email.verified'
  | 'auth.login.succeeded'
  | 'auth.login.failed'
  | 'auth.mfa.challenge.succeeded'
  | 'auth.mfa.challenge.failed'
  | 'auth.logout'
  | 'auth.password.reset_requested'
  | 'auth.password.reset'
  | 'auth.password.changed'
  | 'auth.session.revoked'
  | 'auth.sessions.revoked_others'
  | 'auth.mfa.enabled'
  | 'auth.mfa.disabled'
  | 'auth.mfa.recovery_codes.regenerated'
  | 'account.profile.updated'
  | 'admin.user.status_changed'
  | 'admin.user.roles_changed';

export interface AuditEntry {
  action: AuditAction;
  actorUserId?: string | null;
  entityType?: string;
  entityId?: string;
  /** Nunca inclua senhas, tokens, códigos ou segredos. */
  metadata?: Prisma.InputJsonObject;
  context?: RequestContext;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra um evento. Passe o cliente da transação (`db`) quando o evento precisa
   * ser gravado de forma atômica com a alteração que ele descreve.
   */
  async record(entry: AuditEntry, db: DbClient = this.prisma): Promise<void> {
    await db.auditLog.create({
      data: {
        action: entry.action,
        actorUserId: entry.actorUserId ?? null,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
        ipAddress: entry.context?.ipAddress ?? null,
        userAgent: entry.context?.userAgent ?? null,
        requestId: entry.context?.requestId ?? null,
      },
    });
  }
}
