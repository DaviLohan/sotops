import {
  type AdminBannerDto,
  adminBannerDtoSchema,
  type AdminNewsDto,
  adminNewsDtoSchema,
  type ApiResponse,
  type BannerData,
  bannerInputSchema,
  type CompetitionOption,
  competitionOptionSchema,
  type FeaturedCompetitionInput,
  featuredCompetitionSchema,
  type FederationSettings,
  federationSettingsSchema,
  type ListNewsQuery,
  listNewsQuerySchema,
  type NewsInput,
  newsInputSchema,
  type PaginatedResponse,
} from '@efed/shared';
import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
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
import { SettingsService } from '../settings/settings.service.js';
import { ContentAdminService } from './content-admin.service.js';

@ApiTags('Administração — Conteúdo')
@ApiCookieAuth()
@ApiProblems(401, 403)
@RequirePermissions('content.manage')
@Controller({ path: 'admin', version: '1' })
export class ContentAdminController {
  constructor(private readonly content: ContentAdminService) {}

  @Get('news')
  @ApiOperation({ summary: 'Notícias (todas as situações), da mais recente à mais antiga' })
  @ApiZodQuery(listNewsQuerySchema)
  @ApiZodResponse(adminNewsDtoSchema, { description: 'Página de notícias.', paginated: true })
  listNews(
    @Query(new ZodValidationPipe(listNewsQuerySchema)) query: ListNewsQuery,
  ): Promise<PaginatedResponse<AdminNewsDto>> {
    return this.content.listNews(query);
  }

  @Get('news/:id')
  @ApiOperation({ summary: 'Uma notícia, com o texto completo' })
  @ApiZodResponse(adminNewsDtoSchema, { description: 'Notícia.' })
  @ApiProblems(404)
  async getNews(@Param('id', new UuidParamPipe()) id: string): Promise<ApiResponse<AdminNewsDto>> {
    return { data: await this.content.getNews(id) };
  }

  @Post('news')
  @ApiOperation({ summary: 'Cria uma notícia (rascunho, agendada ou publicada)' })
  @ApiZodBody(newsInputSchema)
  @ApiZodResponse(adminNewsDtoSchema, { description: 'Notícia criada.', status: 201 })
  @ApiProblems(400, 409)
  async createNews(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(newsInputSchema)) body: NewsInput,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminNewsDto>> {
    return { data: await this.content.createNews(auth, body, requestContextFrom(request)) };
  }

  @Put('news/:id')
  @ApiOperation({
    summary: 'Altera uma notícia',
    description: 'Não há exclusão: para tirar do ar, volte a notícia para rascunho.',
  })
  @ApiZodBody(newsInputSchema)
  @ApiZodResponse(adminNewsDtoSchema, { description: 'Notícia alterada.' })
  @ApiProblems(400, 404)
  async updateNews(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(newsInputSchema)) body: NewsInput,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminNewsDto>> {
    return { data: await this.content.updateNews(auth, id, body, requestContextFrom(request)) };
  }

  @Get('banners')
  @ApiOperation({ summary: 'Banners do hero; `isShowing` marca o que está na HOME agora' })
  @ApiZodResponse(adminBannerDtoSchema, { description: 'Banners.', isArray: true })
  async listBanners(): Promise<ApiResponse<AdminBannerDto[]>> {
    return { data: await this.content.listBanners() };
  }

  @Post('banners')
  @ApiOperation({ summary: 'Cria um banner do hero' })
  @ApiZodBody(bannerInputSchema)
  @ApiZodResponse(adminBannerDtoSchema, { description: 'Banner criado.', status: 201 })
  @ApiProblems(400)
  async createBanner(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(bannerInputSchema)) body: BannerData,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminBannerDto>> {
    return { data: await this.content.createBanner(auth, body, requestContextFrom(request)) };
  }

  @Put('banners/:id')
  @ApiOperation({ summary: 'Altera um banner (desative para tirar da HOME)' })
  @ApiZodBody(bannerInputSchema)
  @ApiZodResponse(adminBannerDtoSchema, { description: 'Banner alterado.' })
  @ApiProblems(400, 404)
  async updateBanner(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(bannerInputSchema)) body: BannerData,
    @Req() request: Request,
  ): Promise<ApiResponse<AdminBannerDto>> {
    return { data: await this.content.updateBanner(auth, id, body, requestContextFrom(request)) };
  }

  @Get('featured-competition')
  @ApiOperation({ summary: 'Competições publicadas que podem ir para o destaque da HOME' })
  @ApiZodResponse(competitionOptionSchema, { description: 'Opções.', isArray: true })
  async competitions(): Promise<ApiResponse<CompetitionOption[]>> {
    return { data: await this.content.competitionOptions() };
  }

  @Put('featured-competition')
  @ApiOperation({ summary: 'Define (ou remove, com nulo) a competição em destaque' })
  @ApiZodBody(featuredCompetitionSchema)
  @ApiZodResponse(competitionOptionSchema, { description: 'Opções atualizadas.', isArray: true })
  @ApiProblems(400)
  async setFeatured(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(featuredCompetitionSchema)) body: FeaturedCompetitionInput,
    @Req() request: Request,
  ): Promise<ApiResponse<CompetitionOption[]>> {
    return {
      data: await this.content.setFeatured(auth, body.competitionId, requestContextFrom(request)),
    };
  }
}

@ApiTags('Administração — Configurações')
@ApiCookieAuth()
@ApiProblems(401, 403)
@RequirePermissions('settings.manage')
@Controller({ path: 'admin/settings', version: '1' })
export class SettingsAdminController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Configurações gerais da federação' })
  @ApiZodResponse(federationSettingsSchema, { description: 'Configurações.' })
  async get(): Promise<ApiResponse<FederationSettings>> {
    return { data: await this.settings.get() };
  }

  @Put()
  @ApiOperation({
    summary: 'Altera as configurações gerais (o nome aparece no portal e nos e-mails)',
  })
  @ApiZodBody(federationSettingsSchema)
  @ApiZodResponse(federationSettingsSchema, { description: 'Configurações salvas.' })
  @ApiProblems(400)
  async update(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(federationSettingsSchema)) body: FederationSettings,
    @Req() request: Request,
  ): Promise<ApiResponse<FederationSettings>> {
    return { data: await this.settings.update(auth, body, requestContextFrom(request)) };
  }
}
