import {
  auditLogDtoSchema,
  type AuditLogDto,
  type ListAuditLogsQuery,
  listAuditLogsQuerySchema,
  type PaginatedResponse,
} from '@efed/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { ApiProblems, ApiZodQuery, ApiZodResponse } from '../../common/openapi/zod-openapi.js';
import { RequirePermissions } from '../auth/auth.decorators.js';
import { AuditQueryService } from './audit-query.service.js';

@ApiTags('Administração — Auditoria')
@ApiCookieAuth()
@ApiProblems(401, 403)
@Controller({ path: 'admin/audit-logs', version: '1' })
export class AdminAuditController {
  constructor(private readonly auditQuery: AuditQueryService) {}

  @Get()
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Lista eventos de auditoria, do mais recente para o mais antigo' })
  @ApiZodQuery(listAuditLogsQuerySchema)
  @ApiZodResponse(auditLogDtoSchema, { description: 'Página de eventos.', paginated: true })
  list(
    @Query(new ZodValidationPipe(listAuditLogsQuerySchema)) query: ListAuditLogsQuery,
  ): Promise<PaginatedResponse<AuditLogDto>> {
    return this.auditQuery.list(query);
  }
}
