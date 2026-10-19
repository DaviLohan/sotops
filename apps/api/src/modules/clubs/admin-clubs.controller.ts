import {
  type AdminClubDto,
  adminClubDtoSchema,
  type ApiResponse,
  type ClubData,
  clubInputSchema,
  type ListClubsQuery,
  listClubsQuerySchema,
  type PaginatedResponse,
} from '@efed/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { ApiImageUpload, imageUpload } from '../players/player-profile.controller.js';
import { ClubsAdminService } from './clubs-admin.service.js';

@ApiTags('Administração — Clubes')
@ApiCookieAuth()
@ApiProblems(401, 403)
@RequirePermissions('clubs.manage')
@Controller({ path: 'admin/clubs', version: '1' })
export class AdminClubsController {
  constructor(private readonly clubs: ClubsAdminService) {}

  @Get()
  @ApiOperation({ summary: 'Lista clubes com busca por nome ou sigla' })
  @ApiZodQuery(listClubsQuerySchema)
  @ApiZodResponse(adminClubDtoSchema, { description: 'Página de clubes.', paginated: true })
  list(
    @Query(new ZodValidationPipe(listClubsQuerySchema)) query: ListClubsQuery,
  ): Promise<PaginatedResponse<AdminClubDto>> {
    return this.clubs.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um clube' })
  @ApiZodResponse(adminClubDtoSchema, { description: 'Clube.' })
  @ApiProblems(404)
  async get(@Param('id', new UuidParamPipe()) id: string): Promise<ApiResponse<AdminClubDto>> {
    return { data: await this.clubs.get(id) };
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um clube', description: 'A URL pública é gerada do nome.' })
  @ApiZodBody(clubInputSchema)
  @ApiZodResponse(adminClubDtoSchema, { description: 'Clube criado.', status: 201 })
  @ApiProblems(400, 409)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(clubInputSchema)) body: ClubData,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminClubDto>> {
    return { data: await this.clubs.create(auth, body, requestContextFrom(request)) };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Atualiza um clube',
    description: 'Clube inativo não recebe novos jogadores; os vínculos atuais continuam.',
  })
  @ApiZodBody(clubInputSchema)
  @ApiZodResponse(adminClubDtoSchema, { description: 'Clube atualizado.' })
  @ApiProblems(400, 404, 409)
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(clubInputSchema)) body: ClubData,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminClubDto>> {
    return { data: await this.clubs.update(auth, id, body, requestContextFrom(request)) };
  }

  @Post(':id/crest')
  @UseInterceptors(imageUpload())
  @ApiOperation({ summary: 'Envia o escudo (regravado em WebP 256×256)' })
  @ApiConsumes('multipart/form-data')
  @ApiImageUpload()
  @ApiZodResponse(adminClubDtoSchema, { description: 'Clube com o novo escudo.', status: 201 })
  @ApiProblems(400, 404, 409, 413)
  async uploadCrest(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminClubDto>> {
    return {
      data: await this.clubs.setCrest(auth, id, file?.buffer, requestContextFrom(request)),
    };
  }

  @Delete(':id/crest')
  @ApiOperation({ summary: 'Remove o escudo' })
  @ApiZodResponse(adminClubDtoSchema, { description: 'Clube sem escudo.' })
  @ApiProblems(404, 409)
  async removeCrest(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminClubDto>> {
    return { data: await this.clubs.removeCrest(auth, id, requestContextFrom(request)) };
  }
}
