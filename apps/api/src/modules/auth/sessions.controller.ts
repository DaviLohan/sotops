import {
  type ApiResponse,
  type MessageDto,
  messageDtoSchema,
  type SessionDto,
  sessionDtoSchema,
} from '@efed/shared';
import { Controller, Delete, Get, HttpCode, Param, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { requestContextFrom } from '../../common/http/request-context.js';
import { UuidParamPipe } from '../../common/http/uuid-param.pipe.js';
import { ApiProblems, ApiZodResponse } from '../../common/openapi/zod-openapi.js';
import { AuditService } from '../audit/audit.service.js';
import { CurrentAuth } from './auth.decorators.js';
import type { AuthContext } from './auth.types.js';
import { SessionService } from './session.service.js';

@ApiTags('Autenticação — Sessões')
@ApiCookieAuth()
@ApiProblems(401, 403)
@Controller({ path: 'auth/sessions', version: '1' })
export class SessionsController {
  constructor(
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista as sessões ativas da conta' })
  @ApiZodResponse(sessionDtoSchema, { description: 'Sessões ativas.', isArray: true })
  async list(@CurrentAuth() auth: AuthContext): Promise<ApiResponse<SessionDto[]>> {
    return { data: await this.sessions.listActive(auth.user.id, auth.sessionId) };
  }

  @Delete()
  @HttpCode(200)
  @ApiOperation({ summary: 'Encerra todas as outras sessões da conta' })
  @ApiZodResponse(messageDtoSchema, { description: 'Sessões encerradas.' })
  async revokeOthers(
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ): Promise<ApiResponse<MessageDto>> {
    const ended = await this.sessions.endAllForUser(auth.user.id, 'REVOKED_BY_USER', {
      exceptSessionId: auth.sessionId,
    });
    await this.audit.record({
      action: 'auth.sessions.revoked_others',
      actorUserId: auth.user.id,
      metadata: { endedSessions: ended },
      context: requestContextFrom(request),
    });
    return { data: { message: `${ended} sessão(ões) encerrada(s).` } };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Encerra uma sessão específica da conta' })
  @ApiProblems(404)
  async revoke(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) sessionId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const ended = await this.sessions.endOwned(auth.user.id, sessionId, 'REVOKED_BY_USER');
    if (!ended) {
      throw new AppError('NOT_FOUND');
    }
    await this.audit.record({
      action: 'auth.session.revoked',
      actorUserId: auth.user.id,
      entityType: 'session',
      entityId: sessionId,
      context: requestContextFrom(request),
    });
    if (sessionId === auth.sessionId) {
      this.sessions.clearCookie(response);
    }
  }
}
