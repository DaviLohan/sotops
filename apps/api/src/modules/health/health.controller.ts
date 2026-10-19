import { type HealthDto, healthDtoSchema } from '@efed/shared';
import { Controller, Get, Inject, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { AppConfig } from '../../config/app-config.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { REDIS } from '../../infra/redis/redis.module.js';
import { Public } from '../auth/auth.decorators.js';

const VERSION = process.env.npm_package_version ?? '0.1.0';
/** Uma dependência que não responde neste prazo conta como fora do ar. */
const PROBE_TIMEOUT_MS = 2_000;
const healthJsonSchema = z.toJSONSchema(healthDtoSchema, { target: 'openapi-3.0' });

@ApiTags('Saúde')
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: AppConfig,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness: o processo está respondendo' })
  @ApiResponse({ status: 200, schema: healthJsonSchema as Record<string, unknown> })
  live(): HealthDto {
    return {
      status: 'ok',
      checks: {},
      version: VERSION,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: dependências (PostgreSQL, Redis e MinIO) acessíveis' })
  @ApiResponse({ status: 200, schema: healthJsonSchema as Record<string, unknown> })
  @ApiResponse({ status: 503, schema: healthJsonSchema as Record<string, unknown> })
  async ready(@Res({ passthrough: true }) response: Response): Promise<HealthDto> {
    const [database, redis, storage] = await Promise.all([
      this.check(() => this.prisma.$queryRaw`SELECT 1`),
      this.check(() => this.redis.ping()),
      this.check(async () => {
        // Rota de saúde do MinIO: não exige credenciais.
        const res = await fetch(`${this.config.s3Endpoint}/minio/health/live`, {
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        if (!res.ok) {
          throw new Error(`MinIO respondeu ${res.status}`);
        }
      }),
    ]);
    const healthy = database === 'up' && redis === 'up' && storage === 'up';
    if (!healthy) {
      response.status(503);
    }
    return {
      status: healthy ? 'ok' : 'degraded',
      checks: { database, redis, storage },
      version: VERSION,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  private async check(probe: () => Promise<unknown>): Promise<'up' | 'down'> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('tempo esgotado')), PROBE_TIMEOUT_MS);
    });
    try {
      await Promise.race([probe(), timeout]);
      return 'up';
    } catch {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
