import type { Permission } from '@efed/shared';
import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import type { AuthContext } from './auth.types.js';

export const IS_PUBLIC = 'auth:public';
export const ALLOW_PENDING_MFA = 'auth:allow-pending-mfa';
export const REQUIRED_PERMISSIONS = 'auth:permissions';
export const AUTH_RATE_LIMITED = 'auth:rate-limited';

/** Rota acessível sem sessão. Toda rota é autenticada por padrão. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Rota utilizável por uma sessão que ainda aguarda o segundo fator. */
export const AllowPendingMfa = () => SetMetadata(ALLOW_PENDING_MFA, true);

/** Exige todas as permissões informadas. A verificação acontece na PermissionsGuard. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

/** Aplica o limite de requisições reduzido das rotas sensíveis de autenticação. */
export const AuthRateLimited = () => SetMetadata(AUTH_RATE_LIMITED, true);

export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request>();
  if (!request.auth) {
    throw new AppError('UNAUTHENTICATED');
  }
  return request.auth satisfies AuthContext;
});
