import {
  publicHomeSchema,
  publicMatchSchema,
  type ApiResponse,
  type PublicHome,
  type PublicMatch,
  type UpcomingMatchesQuery,
  upcomingMatchesQuerySchema,
} from '@efed/shared';
import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { ApiProblems, ApiZodQuery, ApiZodResponse } from '../../common/openapi/zod-openapi.js';
import { Public } from '../auth/auth.decorators.js';
import { PublicService } from './public.service.js';

/** Cache curto e compartilhável: as respostas não dependem de sessão nem de cookie. */
const PUBLIC_CACHE = 'public, max-age=10, stale-while-revalidate=50';

@ApiTags('Portal público')
@Public()
@ApiProblems(400)
@Controller({ path: 'public', version: '1' })
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

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
}
