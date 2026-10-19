import {
  type ApiResponse,
  type PaginatedResponse,
  type PublicClubListItem,
  publicClubListItemSchema,
  type PublicClubProfile,
  publicClubProfileSchema,
  type PublicHome,
  publicHomeSchema,
  type PublicListQuery,
  publicListQuerySchema,
  type PublicMatch,
  publicMatchSchema,
  type PublicPlayerListItem,
  publicPlayerListItemSchema,
  type PublicPlayerProfile,
  publicPlayerProfileSchema,
  type SearchQuery,
  searchQuerySchema,
  type SearchResult,
  searchResultSchema,
  type UpcomingMatchesQuery,
  upcomingMatchesQuerySchema,
} from '@efed/shared';
import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { ApiProblems, ApiZodQuery, ApiZodResponse } from '../../common/openapi/zod-openapi.js';
import { Public } from '../auth/auth.decorators.js';
import { PublicDirectoryService } from './public-directory.service.js';
import { PublicService } from './public.service.js';

/** Cache curto e compartilhável: as respostas não dependem de sessão nem de cookie. */
const PUBLIC_CACHE = 'public, max-age=10, stale-while-revalidate=50';

@ApiTags('Portal público')
@Public()
@ApiProblems(400)
@Controller({ path: 'public', version: '1' })
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly directory: PublicDirectoryService,
  ) {}

  @Get('home')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Tudo o que a HOME do portal exibe, em uma chamada' })
  @ApiZodResponse(publicHomeSchema, { description: 'Conteúdo da HOME.' })
  async home(): Promise<ApiResponse<PublicHome>> {
    return { data: await this.publicService.home() };
  }

  @Get('matches/upcoming')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Próximos confrontos de hoje, de amanhã ou da semana' })
  @ApiZodQuery(upcomingMatchesQuerySchema)
  @ApiZodResponse(publicMatchSchema, { description: 'Partidas do período.', isArray: true })
  async upcoming(
    @Query(new ZodValidationPipe(upcomingMatchesQuerySchema)) query: UpcomingMatchesQuery,
  ): Promise<ApiResponse<PublicMatch[]>> {
    return { data: await this.publicService.upcoming(query.scope, query.limit) };
  }

  @Get('players')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Jogadores com conta ativa, em ordem alfabética, com busca' })
  @ApiZodQuery(publicListQuerySchema)
  @ApiZodResponse(publicPlayerListItemSchema, {
    description: 'Página de jogadores.',
    paginated: true,
  })
  players(
    @Query(new ZodValidationPipe(publicListQuerySchema)) query: PublicListQuery,
  ): Promise<PaginatedResponse<PublicPlayerListItem>> {
    return this.directory.players(query);
  }

  @Get('players/:slug')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Perfil público do jogador: clube, histórico e partidas oficiais' })
  @ApiZodResponse(publicPlayerProfileSchema, { description: 'Perfil.' })
  @ApiProblems(404)
  async player(@Param('slug') slug: string): Promise<ApiResponse<PublicPlayerProfile>> {
    return { data: await this.directory.player(slug) };
  }

  @Get('clubs')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Clubes ativos, em ordem alfabética, com busca por nome ou sigla' })
  @ApiZodQuery(publicListQuerySchema)
  @ApiZodResponse(publicClubListItemSchema, { description: 'Página de clubes.', paginated: true })
  clubs(
    @Query(new ZodValidationPipe(publicListQuerySchema)) query: PublicListQuery,
  ): Promise<PaginatedResponse<PublicClubListItem>> {
    return this.directory.clubs(query);
  }

  @Get('clubs/:slug')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Página do clube: elenco atual e ex-jogadores' })
  @ApiZodResponse(publicClubProfileSchema, { description: 'Clube.' })
  @ApiProblems(404)
  async club(@Param('slug') slug: string): Promise<ApiResponse<PublicClubProfile>> {
    return { data: await this.directory.club(slug) };
  }

  @Get('search')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Busca de jogadores e clubes (até 5 de cada)' })
  @ApiZodQuery(searchQuerySchema)
  @ApiZodResponse(searchResultSchema, { description: 'Resultados.' })
  async search(
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
  ): Promise<ApiResponse<SearchResult>> {
    return { data: await this.directory.search(query.q) };
  }
}
