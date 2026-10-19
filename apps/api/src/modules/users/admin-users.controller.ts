import {
  type AdminUserDto,
  adminUserDtoSchema,
  type ApiResponse,
  type ListUsersQuery,
  listUsersQuerySchema,
  type PaginatedResponse,
  type SetUserRolesInput,
  setUserRolesSchema,
  type UpdateUserStatusInput,
  updateUserStatusSchema,
} from '@efed/shared';
import { Body, Controller, Get, Param, Patch, Put, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requestContextFrom } from '../../common/http/request-context.js';
import { UuidParamPipe } from '../../common/http/uuid-param.pipe.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import {
  ApiProblems,
  ApiZodBody,
  ApiZodQuery,
  ApiZodResponse,
} from '../../common/openapi/zod-openapi.js';
import { CurrentAuth, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthContext } from '../auth/auth.types.js';
import { UsersAdminService } from './users-admin.service.js';

@ApiTags('Administração — Usuários')
@ApiCookieAuth()
@ApiProblems(401, 403)
@Controller({ path: 'admin/users', version: '1' })
export class AdminUsersController {
  constructor(private readonly users: UsersAdminService) {}

  @Get()
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Lista usuários com busca, filtros, ordenação e paginação' })
  @ApiZodQuery(listUsersQuerySchema)
  @ApiZodResponse(adminUserDtoSchema, { description: 'Página de usuários.', paginated: true })
  list(
    @Query(new ZodValidationPipe(listUsersQuerySchema)) query: ListUsersQuery,
  ): Promise<PaginatedResponse<AdminUserDto>> {
    return this.users.list(query);
  }

  @Get(':id')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Consulta um usuário' })
  @ApiZodResponse(adminUserDtoSchema, { description: 'Usuário.' })
  @ApiProblems(404)
  async get(@Param('id', new UuidParamPipe()) id: string): Promise<ApiResponse<AdminUserDto>> {
    return { data: await this.users.get(id) };
  }

  @Patch(':id/status')
  @RequirePermissions('users.manage_status')
  @ApiOperation({
    summary: 'Suspende ou reativa uma conta',
    description: 'A suspensão encerra todas as sessões da conta. O motivo é gravado na auditoria.',
  })
  @ApiZodBody(updateUserStatusSchema)
  @ApiZodResponse(adminUserDtoSchema, { description: 'Usuário atualizado.' })
  @ApiProblems(400, 404, 409)
  async updateStatus(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema)) body: UpdateUserStatusInput,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminUserDto>> {
    return { data: await this.users.updateStatus(auth, id, body, requestContextFrom(request)) };
  }

  @Put(':id/roles')
  @RequirePermissions('users.manage_roles')
  @ApiOperation({
    summary: 'Define os papéis de uma conta',
    description:
      'Administradores concedem apenas ORGANIZER, REFEREE e PLAYER; papéis administrativos exigem SUPER_ADMIN.',
  })
  @ApiZodBody(setUserRolesSchema)
  @ApiZodResponse(adminUserDtoSchema, { description: 'Usuário atualizado.' })
  @ApiProblems(400, 404, 409)
  async setRoles(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(setUserRolesSchema)) body: SetUserRolesInput,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminUserDto>> {
    return { data: await this.users.setRoles(auth, id, body, requestContextFrom(request)) };
  }
}
