import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { ApiProblems } from '../../common/openapi/zod-openapi.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { Public } from '../auth/auth.decorators.js';

/** Pastas públicas do armazenamento. Evidências de partida nunca passam por aqui. */
export const PUBLIC_MEDIA_FOLDERS = ['avatars', 'crests'] as const;
export type PublicMediaFolder = (typeof PUBLIC_MEDIA_FOLDERS)[number];

const FILE_PATTERN = /^[0-9a-f-]{36}\.webp$/;

/** Endereço público de um objeto gravado pela API. */
export function mediaUrl(key: string | null): string | null {
  return key ? `/api/v1/media/${key}` : null;
}

@ApiTags('Portal público')
@Public()
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  @Get(':folder/:file')
  @ApiOperation({ summary: 'Imagem pública (avatar de jogador ou escudo de clube)' })
  @ApiProduces('image/webp')
  @ApiProblems(404)
  async get(
    @Param('folder') folder: string,
    @Param('file') file: string,
    @Res() response: Response,
  ): Promise<void> {
    if (!(PUBLIC_MEDIA_FOLDERS as readonly string[]).includes(folder) || !FILE_PATTERN.test(file)) {
      throw new AppError('NOT_FOUND');
    }
    const object = await this.storage.get(`${folder}/${file}`);
    if (!object) {
      throw new AppError('NOT_FOUND');
    }
    // Cada envio gera um nome novo: o conteúdo de uma URL nunca muda.
    response.setHeader('Content-Type', object.contentType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (object.contentLength !== undefined) {
      response.setHeader('Content-Length', String(object.contentLength));
    }
    object.body.pipe(response);
  }
}
