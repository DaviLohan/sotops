import type { ChangePasswordInput, ResetPasswordInput } from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { AppError } from '../../common/errors/app-error.js';
import type { RequestContext } from '../../common/http/request-context.js';
import { hashPassword } from '../../infra/crypto/password-hashing.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AccountMailer } from './account-mailer.js';
import type { AuthContext } from './auth.types.js';
import { PasswordVerifier } from './password-verifier.service.js';
import { SessionService } from './session.service.js';
import { UserTokenService } from './user-token.service.js';

@Injectable()
export class PasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly sessions: SessionService,
    private readonly tokens: UserTokenService,
    private readonly passwords: PasswordVerifier,
    private readonly mailer: AccountMailer,
    private readonly audit: AuditService,
  ) {}

  /** A resposta da API é a mesma exista ou não a conta; só contas ativas recebem o link. */
  async requestReset(email: string, context: RequestContext): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') {
      return;
    }
    const token = await this.tokens.issue(
      user.id,
      'PASSWORD_RESET',
      this.config.security.passwordResetTtlMs,
    );
    await this.audit.record({
      action: 'auth.password.reset_requested',
      entityType: 'user',
      entityId: user.id,
      context,
    });
    await this.mailer.sendPasswordReset(user, token);
  }

  /** Redefine a senha com o token do e-mail e encerra todas as sessões da conta. */
  async reset(input: ResetPasswordInput, context: RequestContext): Promise<void> {
    const passwordHash = await hashPassword(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const userId = await this.tokens.consume(input.token, 'PASSWORD_RESET', tx);
      if (!userId) {
        throw new AppError('TOKEN_INVALID');
      }
      const updated = await tx.user.update({
        where: { id: userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      });
      const endedSessions = await this.sessions.endAllForUser(userId, 'PASSWORD_RESET', { db: tx });
      await this.audit.record(
        {
          action: 'auth.password.reset',
          actorUserId: userId,
          entityType: 'user',
          entityId: userId,
          metadata: { endedSessions },
          context,
        },
        tx,
      );
      return updated;
    });

    await this.mailer.sendPasswordChanged(user);
  }

  /** Troca a senha com a sessão aberta, mantendo apenas a sessão atual. */
  async change(
    auth: AuthContext,
    input: ChangePasswordInput,
    context: RequestContext,
  ): Promise<void> {
    await this.passwords.assertCurrentPassword(auth.user.id, input.currentPassword);
    if (input.currentPassword === input.newPassword) {
      throw new AppError('VALIDATION_FAILED', {
        errors: [{ path: 'newPassword', message: 'A nova senha deve ser diferente da atual.' }],
      });
    }
    const passwordHash = await hashPassword(input.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: auth.user.id }, data: { passwordHash } });
      const endedSessions = await this.sessions.endAllForUser(auth.user.id, 'PASSWORD_CHANGED', {
        exceptSessionId: auth.sessionId,
        db: tx,
      });
      await this.audit.record(
        {
          action: 'auth.password.changed',
          actorUserId: auth.user.id,
          entityType: 'user',
          entityId: auth.user.id,
          metadata: { endedSessions },
          context,
        },
        tx,
      );
    });

    await this.mailer.sendPasswordChanged(auth.user);
  }
}
