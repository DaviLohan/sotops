import { permissionsForRoles, requiresMfa, type RoleKey, type SessionDto } from '@efed/shared';
import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { AppConfig } from '../../config/app-config.js';
import type { RequestContext } from '../../common/http/request-context.js';
import type { SessionEndReason } from '../../generated/prisma/client.js';
import { generateOpaqueToken, hmacSha256, sha256Hex } from '../../infra/crypto/tokens.js';
import { type DbClient, PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AuthContext } from './auth.types.js';

export interface IssuedSession {
  id: string;
  token: string;
  expiresAt: Date;
}

interface CreateSessionInput {
  userId: string;
  roles: RoleKey[];
  /** `true` quando o usuário tem MFA ativo e ainda precisa apresentar o segundo fator. */
  awaitingMfa: boolean;
  context: RequestContext;
}

export type SessionAuthentication =
  { kind: 'authenticated'; auth: AuthContext } | { kind: 'invalid' } | { kind: 'suspended' };

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async create(input: CreateSessionInput, db: DbClient = this.prisma): Promise<IssuedSession> {
    const now = Date.now();
    const token = generateOpaqueToken();
    const lifetime = input.awaitingMfa
      ? this.config.session.pendingMfaTtlMs
      : this.config.session.absoluteTtlMs;
    const expiresAt = new Date(now + lifetime);

    const session = await db.session.create({
      data: {
        userId: input.userId,
        tokenHash: sha256Hex(token),
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
        idleExpiresAt: this.idleDeadline(now, input.roles, expiresAt),
        expiresAt,
      },
      select: { id: true },
    });
    return { id: session.id, token, expiresAt };
  }

  /** Resolve o cookie em um contexto de autenticação, renovando a inatividade quando necessário. */
  async authenticate(token: string): Promise<SessionAuthentication> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256Hex(token) },
      include: {
        user: {
          include: {
            roles: { include: { role: { select: { key: true } } } },
            totp: { select: { confirmedAt: true } },
          },
        },
      },
    });

    const now = new Date();
    if (!session || session.endedAt || session.expiresAt <= now || session.idleExpiresAt <= now) {
      return { kind: 'invalid' };
    }
    const { user } = session;
    if (user.status === 'SUSPENDED') {
      return { kind: 'suspended' };
    }
    if (user.status !== 'ACTIVE') {
      return { kind: 'invalid' };
    }

    const roles = user.roles.map((entry) => entry.role.key);
    if (now.getTime() - session.lastSeenAt.getTime() >= this.config.session.touchIntervalMs) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          lastSeenAt: now,
          idleExpiresAt: this.idleDeadline(now.getTime(), roles, session.expiresAt),
        },
      });
    }

    const mfaEnabled = Boolean(user.totp?.confirmedAt);
    const mfaPending = mfaEnabled && !session.mfaVerifiedAt;
    const mfaEnrollmentRequired = requiresMfa(roles) && !mfaEnabled;

    return {
      kind: 'authenticated',
      auth: {
        sessionId: session.id,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          status: user.status,
          createdAt: user.createdAt,
        },
        roles,
        permissions: mfaPending || mfaEnrollmentRequired ? [] : permissionsForRoles(roles),
        mfaEnabled,
        mfaPending,
        mfaEnrollmentRequired,
      },
    };
  }

  /**
   * Promove a sessão após o segundo fator: marca a verificação, estende a validade e troca o
   * token, para que um token capturado antes do MFA não sirva depois dele.
   */
  async completeMfa(sessionId: string, roles: RoleKey[]): Promise<IssuedSession> {
    const now = Date.now();
    const token = generateOpaqueToken();
    const expiresAt = new Date(now + this.config.session.absoluteTtlMs);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        tokenHash: sha256Hex(token),
        mfaVerifiedAt: new Date(now),
        lastSeenAt: new Date(now),
        idleExpiresAt: this.idleDeadline(now, roles, expiresAt),
        expiresAt,
      },
    });
    return { id: sessionId, token, expiresAt };
  }

  async markMfaVerified(sessionId: string, db: DbClient = this.prisma): Promise<void> {
    await db.session.update({ where: { id: sessionId }, data: { mfaVerifiedAt: new Date() } });
  }

  async end(
    sessionId: string,
    reason: SessionEndReason,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await db.session.updateMany({
      where: { id: sessionId, endedAt: null },
      data: { endedAt: new Date(), endReason: reason },
    });
  }

  async endByToken(token: string, reason: SessionEndReason): Promise<string | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256Hex(token) },
      select: { id: true, userId: true, endedAt: true },
    });
    if (!session || session.endedAt) {
      return null;
    }
    await this.end(session.id, reason);
    return session.userId;
  }

  /** Encerra uma sessão somente se ela pertencer ao usuário informado. */
  async endOwned(userId: string, sessionId: string, reason: SessionEndReason): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, endedAt: null },
      data: { endedAt: new Date(), endReason: reason },
    });
    return result.count === 1;
  }

  /** Encerra todas as sessões ativas do usuário, opcionalmente preservando a atual. */
  async endAllForUser(
    userId: string,
    reason: SessionEndReason,
    options: { exceptSessionId?: string; db?: DbClient } = {},
  ): Promise<number> {
    const db = options.db ?? this.prisma;
    const result = await db.session.updateMany({
      where: {
        userId,
        endedAt: null,
        id: options.exceptSessionId ? { not: options.exceptSessionId } : undefined,
      },
      data: { endedAt: new Date(), endReason: reason },
    });
    return result.count;
  }

  async listActive(userId: string, currentSessionId: string): Promise<SessionDto[]> {
    const now = new Date();
    const sessions = await this.prisma.session.findMany({
      where: { userId, endedAt: null, expiresAt: { gt: now }, idleExpiresAt: { gt: now } },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map((session) => ({
      id: session.id,
      current: session.id === currentSessionId,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    }));
  }

  /** Token anti-CSRF derivado da sessão: não precisa ser armazenado e morre com ela. */
  csrfTokenFor(sessionId: string): string {
    return hmacSha256(this.config.security.csrfSecret, `csrf:${sessionId}`);
  }

  setCookie(response: Response, session: IssuedSession): void {
    response.cookie(this.config.session.cookieName, session.token, {
      ...this.cookieOptions(),
      expires: session.expiresAt,
    });
  }

  clearCookie(response: Response): void {
    response.clearCookie(this.config.session.cookieName, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.session.secureCookie,
      sameSite: 'lax',
      path: '/',
    };
  }

  private idleDeadline(nowMs: number, roles: RoleKey[], absoluteExpiry: Date): Date {
    const ttl = requiresMfa(roles)
      ? this.config.session.adminIdleTtlMs
      : this.config.session.idleTtlMs;
    return new Date(Math.min(nowMs + ttl, absoluteExpiry.getTime()));
  }
}
