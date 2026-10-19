import { hasPermission, type Permission } from '@efed/shared';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { REQUIRED_PERMISSIONS } from './auth.decorators.js';

/**
 * Autorização por papel (RBAC). Regras que dependem do recurso em si — por exemplo,
 * "um administrador não altera outro administrador" — ficam nas políticas dos serviços.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const { auth } = context.switchToHttp().getRequest<Request>();
    if (!auth) {
      throw new AppError('UNAUTHENTICATED');
    }
    if (required.every((permission) => auth.permissions.includes(permission))) {
      return true;
    }

    const blockedOnlyByMfa =
      auth.mfaEnrollmentRequired &&
      required.every((permission) => hasPermission(auth.roles, permission));
    throw new AppError(blockedOnlyByMfa ? 'MFA_ENROLLMENT_REQUIRED' : 'FORBIDDEN');
  }
}
