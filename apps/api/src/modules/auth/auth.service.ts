import {
  type AccountDto,
  type LoginInput,
  type MfaChallengeInput,
  PRIVACY_NOTICE_VERSION,
  type RegisterInput,
} from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { AppError } from '../../common/errors/app-error.js';
import type { RequestContext } from '../../common/http/request-context.js';
import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from '../../infra/crypto/password-hashing.js';
import { isUniqueViolation, PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AccountMailer } from './account-mailer.js';
import type { AuthContext } from './auth.types.js';
import { MfaService } from './mfa.service.js';
import { PasswordVerifier } from './password-verifier.service.js';
import { type IssuedSession, SessionService } from './session.service.js';
import { UserTokenService } from './user-token.service.js';

export type LoginOutcome =
  | { status: 'AUTHENTICATED'; session: IssuedSession }
  | { status: 'MFA_REQUIRED'; session: IssuedSession };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly sessions: SessionService,
    private readonly tokens: UserTokenService,
    private readonly passwords: PasswordVerifier,
    private readonly mfa: MfaService,
    private readonly mailer: AccountMailer,
    private readonly audit: AuditService,
  ) {}

  /**
   * Cria a conta em estado pendente e envia o e-mail de verificação. A resposta é idêntica
   * quando o e-mail já existe, para não revelar quem está cadastrado; o titular é avisado
   * por e-mail. Nomes de usuário são públicos, então o conflito de nome é informado.
   */
  async register(input: RegisterInput, context: RequestContext): Promise<void> {
    const passwordHash = await hashPassword(input.password);

    const usernameOwner = await this.prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true },
    });
    if (usernameOwner) {
      throw new AppError('USERNAME_TAKEN');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      await this.notifyExistingAccount(existing);
      return;
    }

    try {
      const { user, token } = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: input.email,
            username: input.username,
            displayName: input.displayName,
            passwordHash,
            privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
            privacyNoticeAcceptedAt: new Date(),
            roles: { create: { role: { connect: { key: 'PLAYER' } } } },
          },
        });
        const verificationToken = await this.tokens.issue(
          created.id,
          'EMAIL_VERIFICATION',
          this.config.security.emailVerificationTtlMs,
          tx,
        );
        await this.audit.record(
          {
            action: 'auth.register',
            actorUserId: created.id,
            entityType: 'user',
            entityId: created.id,
            metadata: { privacyNoticeVersion: PRIVACY_NOTICE_VERSION },
            context,
          },
          tx,
        );
        return { user: created, token: verificationToken };
      });
      await this.mailer.sendEmailVerification(user, token);
    } catch (error) {
      if (isUniqueViolation(error, 'username')) {
        throw new AppError('USERNAME_TAKEN');
      }
      if (isUniqueViolation(error)) {
        // Corrida com outro cadastro do mesmo e-mail: mantém a resposta genérica.
        return;
      }
      throw error;
    }
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user?.status === 'PENDING_VERIFICATION') {
      await this.sendVerification(user);
    }
  }

  async verifyEmail(token: string, context: RequestContext): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const userId = await this.tokens.consume(token, 'EMAIL_VERIFICATION', tx);
      if (!userId) {
        throw new AppError('TOKEN_INVALID');
      }
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          emailVerifiedAt: new Date(),
          status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status,
        },
      });
      await this.audit.record(
        {
          action: 'auth.email.verified',
          actorUserId: userId,
          entityType: 'user',
          entityId: userId,
          context,
        },
        tx,
      );
    });
  }

  async login(input: LoginInput, context: RequestContext): Promise<LoginOutcome> {
    const user = await this.prisma.user.findUnique({
      where: input.identifier.includes('@')
        ? { email: input.identifier }
        : { username: input.identifier },
      include: {
        roles: { include: { role: { select: { key: true } } } },
        totp: { select: { confirmedAt: true } },
      },
    });

    if (!user) {
      await this.passwords.burnTime(input.password);
      await this.audit.record({
        action: 'auth.login.failed',
        metadata: { reason: 'unknown_identifier' },
        context,
      });
      throw new AppError('INVALID_CREDENTIALS');
    }

    this.assertNotLocked(user.lockedUntil);

    if (!(await verifyPassword(user.passwordHash, input.password))) {
      await this.registerFailedAttempt(user.id, 'auth.login.failed', 'wrong_password', context);
      throw new AppError('INVALID_CREDENTIALS');
    }

    // O estado da conta só é revelado a quem provou conhecer a senha.
    if (user.status === 'PENDING_VERIFICATION') {
      throw new AppError('EMAIL_NOT_VERIFIED');
    }
    if (user.status === 'SUSPENDED') {
      throw new AppError('ACCOUNT_SUSPENDED');
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError('INVALID_CREDENTIALS');
    }

    const roles = user.roles.map((entry) => entry.role.key);
    const awaitingMfa = Boolean(user.totp?.confirmedAt);

    // Se os parâmetros do Argon2id foram endurecidos, migra o hash aproveitando a senha em mãos.
    const upgradedHash = passwordNeedsRehash(user.passwordHash)
      ? await hashPassword(input.password)
      : undefined;

    const session = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          passwordHash: upgradedHash,
        },
      });
      const issued = await this.sessions.create(
        { userId: user.id, roles, awaitingMfa, context },
        tx,
      );
      await this.audit.record(
        {
          action: 'auth.login.succeeded',
          actorUserId: user.id,
          entityType: 'session',
          entityId: issued.id,
          metadata: { awaitingMfa },
          context,
        },
        tx,
      );
      return issued;
    });

    return { status: awaitingMfa ? 'MFA_REQUIRED' : 'AUTHENTICATED', session };
  }

  /** Segundo passo do login para contas com MFA. Falhas contam para o bloqueio temporário. */
  async completeMfaChallenge(
    auth: AuthContext,
    input: MfaChallengeInput,
    context: RequestContext,
  ): Promise<IssuedSession> {
    if (!auth.mfaPending) {
      throw new AppError('CONFLICT', {
        detail: 'Esta sessão já concluiu a verificação em duas etapas.',
      });
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.user.id },
      select: { lockedUntil: true },
    });
    this.assertNotLocked(user.lockedUntil);

    const method = await this.mfa.verifyChallenge(auth.user.id, input);
    if (!method) {
      await this.registerFailedAttempt(
        auth.user.id,
        'auth.mfa.challenge.failed',
        'invalid_code',
        context,
      );
      throw new AppError('MFA_INVALID_CODE');
    }

    await this.prisma.user.update({
      where: { id: auth.user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    const session = await this.sessions.completeMfa(auth.sessionId, auth.roles);
    await this.audit.record({
      action: 'auth.mfa.challenge.succeeded',
      actorUserId: auth.user.id,
      entityType: 'session',
      entityId: auth.sessionId,
      metadata: { method },
      context,
    });
    return session;
  }

  async logout(token: string | undefined, context: RequestContext): Promise<void> {
    if (!token) {
      return;
    }
    const userId = await this.sessions.endByToken(token, 'LOGOUT');
    if (userId) {
      await this.audit.record({ action: 'auth.logout', actorUserId: userId, context });
    }
  }

  /** Recarrega o contexto depois de uma operação que altera a própria sessão (ex.: MFA). */
  async reload(token: string): Promise<AuthContext> {
    const result = await this.sessions.authenticate(token);
    if (result.kind !== 'authenticated') {
      throw new AppError('UNAUTHENTICATED');
    }
    return result.auth;
  }

  toAccountDto(auth: AuthContext): AccountDto {
    return {
      id: auth.user.id,
      email: auth.user.email,
      username: auth.user.username,
      displayName: auth.user.displayName,
      status: auth.user.status,
      roles: auth.roles,
      permissions: auth.permissions,
      mfaEnabled: auth.mfaEnabled,
      mfaEnrollmentRequired: auth.mfaEnrollmentRequired,
      createdAt: auth.user.createdAt.toISOString(),
    };
  }

  private assertNotLocked(lockedUntil: Date | null): void {
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      throw new AppError('ACCOUNT_LOCKED', {
        retryAfterSeconds: Math.ceil((lockedUntil.getTime() - Date.now()) / 1000),
      });
    }
  }

  /**
   * Conta a falha e, a partir do limite, bloqueia a conta por um período que dobra a cada
   * nova tentativa (1, 2, 4… minutos) até o teto configurado.
   */
  private async registerFailedAttempt(
    userId: string,
    action: 'auth.login.failed' | 'auth.mfa.challenge.failed',
    reason: string,
    context: RequestContext,
  ): Promise<void> {
    const { loginLockThreshold, loginLockMaxMs } = this.config.security;
    const { failedLoginCount } = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });

    let locked = false;
    if (failedLoginCount >= loginLockThreshold) {
      const exponent = Math.min(failedLoginCount - loginLockThreshold, 10);
      const lockMs = Math.min(60_000 * 2 ** exponent, loginLockMaxMs);
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + lockMs) },
      });
      locked = true;
    }

    await this.audit.record({
      action,
      entityType: 'user',
      entityId: userId,
      metadata: { reason, failedAttempts: failedLoginCount, locked },
      context,
    });
  }

  private async notifyExistingAccount(user: {
    id: string;
    email: string;
    displayName: string;
    status: string;
  }): Promise<void> {
    if (user.status === 'PENDING_VERIFICATION') {
      await this.sendVerification(user);
    } else {
      await this.mailer.sendAlreadyRegistered(user);
    }
  }

  private async sendVerification(user: {
    id: string;
    email: string;
    displayName: string;
  }): Promise<void> {
    const token = await this.tokens.issue(
      user.id,
      'EMAIL_VERIFICATION',
      this.config.security.emailVerificationTtlMs,
    );
    await this.mailer.sendEmailVerification(user, token);
  }
}
