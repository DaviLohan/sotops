import {
  type ApiResponse,
  type MyPlayerProfileDto,
  myPlayerProfileDtoSchema,
  type UpsertPlayerProfile,
  upsertPlayerProfileSchema,
} from '@efed/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requestContextFrom } from '../../common/http/request-context.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { ApiProblems, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi.js';
import { MAX_IMAGE_BYTES } from '../../infra/storage/images.js';
import { CurrentAuth, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthContext } from '../auth/auth.types.js';
import { PlayerProfileService } from './player-profile.service.js';

/**
 * Recebe um único arquivo (sem `dest`, o multer o mantém em memória); o conteúdo é validado e
 * reprocessado pelo serviço.
 */
export const imageUpload = () =>
  FileInterceptor('file', {
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1 },
  });

export const ApiImageUpload = () =>
  ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'PNG, JPEG ou WebP até 2 MB' },
      },
    },
  });

@ApiTags('Jogador')
@ApiCookieAuth()
@ApiProblems(401, 403)
@RequirePermissions('player_profile.manage')
@Controller({ path: 'me/player-profile', version: '1' })
export class PlayerProfileController {
  constructor(private readonly profiles: PlayerProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Perfil esportivo da própria conta (nulo se ainda não foi criado)' })
  @ApiZodResponse(myPlayerProfileDtoSchema.nullable(), { description: 'Perfil ou nulo.' })
  async get(@CurrentAuth() auth: AuthContext): Promise<ApiResponse<MyPlayerProfileDto | null>> {
    return { data: await this.profiles.getMine(auth) };
  }

  @Put()
  @ApiOperation({
    summary: 'Cria ou atualiza o perfil esportivo',
    description: 'O ID do eFootball é único por plataforma (sem diferenciar maiúsculas).',
  })
  @ApiZodBody(upsertPlayerProfileSchema)
  @ApiZodResponse(myPlayerProfileDtoSchema, { description: 'Perfil salvo.' })
  @ApiProblems(400, 409)
  async upsert(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(upsertPlayerProfileSchema)) body: UpsertPlayerProfile,
    @Req() request: Request,
  ): Promise<ApiResponse<MyPlayerProfileDto>> {
    return { data: await this.profiles.upsertMine(auth, body, requestContextFrom(request)) };
  }

  @Post('avatar')
  @UseInterceptors(imageUpload())
  @ApiOperation({
    summary: 'Envia o avatar',
    description:
      'O tipo é conferido pelo conteúdo, não pela extensão. A imagem é recortada em 256×256 e regravada em WebP, sem metadados.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiImageUpload()
  @ApiZodResponse(myPlayerProfileDtoSchema, { description: 'Perfil com o novo avatar.' })
  @ApiProblems(400, 404, 409, 413)
  async uploadAvatar(
    @CurrentAuth() auth: AuthContext,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Req() request: Request,
  ): Promise<ApiResponse<MyPlayerProfileDto>> {
    return {
      data: await this.profiles.setAvatar(auth, file?.buffer, requestContextFrom(request)),
    };
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Remove o avatar' })
  @ApiZodResponse(myPlayerProfileDtoSchema, { description: 'Perfil sem avatar.' })
  @ApiProblems(404, 409)
  async removeAvatar(
    @CurrentAuth() auth: AuthContext,
    @Req() request: Request,
  ): Promise<ApiResponse<MyPlayerProfileDto>> {
    return { data: await this.profiles.removeAvatar(auth, requestContextFrom(request)) };
  }
}
