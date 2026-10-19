import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { AppError } from '../../common/errors/app-error.js';
import { ALLOW_PENDING_MFA, IS_PUBLIC } from './auth.decorators.js';
import './auth.types.js';
import { SessionService } from './session.service.js';

/**
 * Autentica toda requisição pelo cookie de sessão, exceto rotas marcadas com `@Public()`.
 * Uma sessão que ainda aguarda o segundo fator só alcança rotas com `@AllowPendingMfa()`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const token: unknown = request.cookies?.[this.config.session.cookieName];
    if (typeof token !== 'string' || token.length === 0) {
      throw new AppError('UNAUTHENTICATED');
    }

    const result = await this.sessions.authenticate(token);
    if (result.kind !== 'authenticated') {
      this.sessions.clearCookie(http.getResponse<Response>());
      throw new AppError(result.kind === 'suspended' ? 'ACCOUNT_SUSPENDED' : 'UNAUTHENTICATED');
    }

    const allowPendingMfa = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_MFA, targets);
    if (result.auth.mfaPending && !allowPendingMfa) {
      throw new AppError('MFA_CHALLENGE_REQUIRED');
    }

    request.auth = result.auth;
    return true;
  }
}
