import {
  type MfaChallengeInput,
  type MfaEnrollmentDto,
  type MfaRecoveryCodesDto,
  type MfaStatusDto,
  requiresMfa,
} from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { AppError } from '../../common/errors/app-error.js';
import type { RequestContext } from '../../common/http/request-context.js';
import { generateRecoveryCodes } from '../../infra/crypto/recovery-codes.js';
import { openSecret, sealSecret } from '../../infra/crypto/secret-box.js';
import { sha256Hex } from '../../infra/crypto/tokens.js';
import { buildOtpauthUri, generateTotpSecret, verifyTotp } from '../../infra/crypto/totp.js';
import { type DbClient, PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from './auth.types.js';
import { PasswordVerifier } from './password-verifier.service.js';
import { SessionService } from './session.service.js';

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly sessions: SessionService,
    private readonly passwords: PasswordVerifier,
    private readonly audit: AuditService,
  ) {}

  async status(auth: AuthContext): Promise<MfaStatusDto> {
    const [totp, recoveryCodesRemaining] = await Promise.all([
      this.prisma.userTotp.findUnique({ where: { userId: auth.user.id } }),
      this.prisma.mfaRecoveryCode.count({ where: { userId: auth.user.id, usedAt: null } }),
    ]);
    return {
      enabled: Boolean(totp?.confirmedAt),
      required: requiresMfa(auth.roles),
      enabledAt: totp?.confirmedAt?.toISOString() ?? null,
      recoveryCodesRemaining,
    };
  }

  /** Gera um novo segredo pendente. Só passa a valer depois de confirmado com um código. */
  async startEnrollment(auth: AuthContext, password: string): Promise<MfaEnrollmentDto> {
    if (auth.mfaEnabled) {
      throw new AppError('MFA_ALREADY_ENABLED');
    }
    await this.passwords.assertCurrentPassword(auth.user.id, password);

    const secret = generateTotpSecret();
    const secretCiphertext = sealSecret(
      this.config.security.mfaEncryptionKey,
      secret,
      auth.user.id,
    );
    await this.prisma.userTotp.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, secretCiphertext },
      update: { secretCiphertext, confirmedAt: null, lastUsedStep: null },
    });

    return {
      secret,
      otpauthUri: buildOtpauthUri(this.config.security.mfaIssuer, auth.user.email, secret),
    };
  }

  async confirmEnrollment(
    auth: AuthContext,
    code: string,
    context: RequestContext,
  ): Promise<MfaRecoveryCodesDto> {
    const totp = await this.prisma.userTotp.findUnique({ where: { userId: auth.user.id } });
    if (!totp) {
      throw new AppError('CONFLICT', {
        detail: 'Inicie o cadastro do segundo fator antes de confirmar.',
      });
    }
    if (totp.confirmedAt) {
      throw new AppError('MFA_ALREADY_ENABLED');
    }
    const step = verifyTotp(
      this.decrypt(totp.secretCiphertext, auth.user.id),
      code,
      Date.now(),
      null,
    );
    if (step === null) {
      throw new AppError('MFA_INVALID_CODE');
    }

    const recoveryCodes = generateRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      await tx.userTotp.update({
        where: { userId: auth.user.id },
        data: { confirmedAt: new Date(), lastUsedStep: step },
      });
      await this.replaceRecoveryCodes(auth.user.id, recoveryCodes, tx);
      await this.sessions.markMfaVerified(auth.sessionId, tx);
      await this.sessions.endAllForUser(auth.user.id, 'MFA_CHANGED', {
        exceptSessionId: auth.sessionId,
        db: tx,
      });
      await this.audit.record(
        {
          action: 'auth.mfa.enabled',
          actorUserId: auth.user.id,
          entityType: 'user',
          entityId: auth.user.id,
          context,
        },
        tx,
      );
    });
    return { recoveryCodes };
  }

  async disable(auth: AuthContext, password: string, context: RequestContext): Promise<void> {
    if (!auth.mfaEnabled) {
      throw new AppError('MFA_NOT_ENABLED');
    }
    if (requiresMfa(auth.roles)) {
      throw new AppError('FORBIDDEN', {
        detail: 'Contas administrativas não podem desativar a verificação em duas etapas.',
      });
    }
    await this.passwords.assertCurrentPassword(auth.user.id, password);

    await this.prisma.$transaction(async (tx) => {
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: auth.user.id } });
      await tx.userTotp.delete({ where: { userId: auth.user.id } });
      await this.sessions.endAllForUser(auth.user.id, 'MFA_CHANGED', {
        exceptSessionId: auth.sessionId,
        db: tx,
      });
      await this.audit.record(
        {
          action: 'auth.mfa.disabled',
          actorUserId: auth.user.id,
          entityType: 'user',
          entityId: auth.user.id,
          context,
        },
        tx,
      );
    });
  }

  async regenerateRecoveryCodes(
    auth: AuthContext,
    password: string,
    context: RequestContext,
  ): Promise<MfaRecoveryCodesDto> {
    if (!auth.mfaEnabled) {
      throw new AppError('MFA_NOT_ENABLED');
    }
    await this.passwords.assertCurrentPassword(auth.user.id, password);

    const recoveryCodes = generateRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      await this.replaceRecoveryCodes(auth.user.id, recoveryCodes, tx);
      await this.audit.record(
        {
          action: 'auth.mfa.recovery_codes.regenerated',
          actorUserId: auth.user.id,
          entityType: 'user',
          entityId: auth.user.id,
          context,
        },
        tx,
      );
    });
    return { recoveryCodes };
  }

  /** Confere o segundo fator do login. Cada código (TOTP ou de recuperação) vale uma única vez. */
  async verifyChallenge(
    userId: string,
    input: MfaChallengeInput,
  ): Promise<'totp' | 'recovery' | null> {
    if ('recoveryCode' in input) {
      const used = await this.prisma.mfaRecoveryCode.updateMany({
        where: { userId, codeHash: sha256Hex(input.recoveryCode), usedAt: null },
        data: { usedAt: new Date() },
      });
      return used.count === 1 ? 'recovery' : null;
    }

    const totp = await this.prisma.userTotp.findUnique({ where: { userId } });
    if (!totp?.confirmedAt) {
      return null;
    }
    const secret = this.decrypt(totp.secretCiphertext, userId);
    const step = verifyTotp(secret, input.code, Date.now(), totp.lastUsedStep);
    if (step === null) {
      return null;
    }
    // O UPDATE condicional impede que duas requisições simultâneas aceitem o mesmo código.
    const claimed = await this.prisma.userTotp.updateMany({
      where: { userId, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
      data: { lastUsedStep: step },
    });
    return claimed.count === 1 ? 'totp' : null;
  }

  private async replaceRecoveryCodes(userId: string, codes: string[], db: DbClient): Promise<void> {
    await db.mfaRecoveryCode.deleteMany({ where: { userId } });
    await db.mfaRecoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: sha256Hex(code) })),
    });
  }

  private decrypt(ciphertext: string, userId: string): string {
    return openSecret(this.config.security.mfaEncryptionKey, ciphertext, userId);
  }
}
