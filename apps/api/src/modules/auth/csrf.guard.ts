import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { AppError } from '../../common/errors/app-error.js';
import { safeEqual } from '../../infra/crypto/tokens.js';
import { SessionService } from './session.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Defesa em duas camadas para requisições que alteram estado:
 * 1. a origem (cabeçalho Origin ou Referer) precisa estar na lista autorizada;
 * 2. requisições autenticadas precisam do token anti-CSRF vinculado à sessão.
 *
 * Clientes sem cookie de sessão e sem Origin (scripts, integrações) não carregam credenciais
 * ambientes e por isso não são alvo de CSRF.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly config: AppConfig,
    private readonly sessions: SessionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    this.assertTrustedOrigin(request);

    if (request.auth) {
      const provided = request.get(CSRF_HEADER);
      const expected = this.sessions.csrfTokenFor(request.auth.sessionId);
      if (!provided || !safeEqual(provided, expected)) {
        throw new AppError('CSRF_REJECTED');
      }
    }
    return true;
  }

  private assertTrustedOrigin(request: Request): void {
    const origin = request.get('origin') ?? this.originFromReferer(request.get('referer'));
    if (origin) {
      if (!this.config.http.allowedOrigins.includes(origin)) {
        throw new AppError('CSRF_REJECTED');
      }
      return;
    }
    const hasSessionCookie = Boolean(request.cookies?.[this.config.session.cookieName]);
    if (hasSessionCookie) {
      throw new AppError('CSRF_REJECTED');
    }
  }

  private originFromReferer(referer: string | undefined): string | undefined {
    if (!referer) {
      return undefined;
    }
    try {
      return new URL(referer).origin;
    } catch {
      return 'invalid';
    }
  }
}
