import {
  type AdminPlayerDto,
  adminPlayerDtoSchema,
  type AdminUpdatePlayer,
  adminUpdatePlayerSchema,
  type ApiResponse,
  type ListPlayersQuery,
  listPlayersQuerySchema,
  type PaginatedResponse,
} from '@efed/shared';
import { Body, Controller, Delete, Get, Param, Put, Query, Req } from '@nestjs/common';
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
import { PlayersAdminService } from './players-admin.service.js';

@ApiTags('Administração — Jogadores')
@ApiCookieAuth()
@ApiProblems(401, 403)
@RequirePermissions('players.manage')
@Controller({ path: 'admin/players', version: '1' })
export class AdminPlayersController {
  constructor(private readonly players: PlayersAdminService) {}

  @Get()
  @ApiOperation({ summary: 'Perfis de jogador, com busca por apelido, ID do eFootball ou usuário' })
  @ApiZodQuery(listPlayersQuerySchema)
  @ApiZodResponse(adminPlayerDtoSchema, { description: 'Página de jogadores.', paginated: true })
  list(
    @Query(new ZodValidationPipe(listPlayersQuerySchema)) query: ListPlayersQuery,
  ): Promise<PaginatedResponse<AdminPlayerDto>> {
    return this.players.list(query);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Corrige o perfil de um jogador (motivo vai para a auditoria)' })
  @ApiZodBody(adminUpdatePlayerSchema)
  @ApiZodResponse(adminPlayerDtoSchema, { description: 'Perfil corrigido.' })
  @ApiProblems(400, 404, 409)
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(adminUpdatePlayerSchema)) body: AdminUpdatePlayer,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminPlayerDto>> {
    return { data: await this.players.update(auth, id, body, requestContextFrom(request)) };
  }

  @Delete(':id/avatar')
  @ApiOperation({ summary: 'Remove um avatar impróprio' })
  @ApiZodResponse(adminPlayerDtoSchema, { description: 'Perfil sem avatar.' })
  @ApiProblems(404, 409)
  async removeAvatar(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminPlayerDto>> {
    return { data: await this.players.removeAvatar(auth, id, requestContextFrom(request)) };
  }
}
