import type { Request } from 'express';

/** Dados da requisição que acompanham registros de sessão e de auditoria. */
export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export function requestContextFrom(request: Request): RequestContext {
  const userAgent = request.get('user-agent');
  return {
    ipAddress: request.ip ?? null,
    userAgent: userAgent ? userAgent.slice(0, 512) : null,
    requestId: typeof request.id === 'string' ? request.id : null,
  };
}
