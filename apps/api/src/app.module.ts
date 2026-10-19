import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { type ExecutionContext, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ProblemFilter } from './common/errors/problem.filter.js';
import { AppConfig } from './config/app-config.js';
import { ConfigModule } from './config/config.module.js';
import { MailModule } from './infra/mail/mail.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { RedisThrottlerStorage } from './infra/redis/redis-throttler.storage.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { StorageModule } from './infra/storage/storage.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AUTH_RATE_LIMITED } from './modules/auth/auth.decorators.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CsrfGuard } from './modules/auth/csrf.guard.js';
import { PermissionsGuard } from './modules/auth/permissions.guard.js';
import { SessionGuard } from './modules/auth/session.guard.js';
import { ClubsModule } from './modules/clubs/clubs.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { PlayersModule } from './modules/players/players.module.js';
import { PublicModule } from './modules/public/public.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { UsersModule } from './modules/users/users.module.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/** Reaproveita o identificador vindo do proxy quando ele é bem formado; senão gera um novo. */
function requestId(request: IncomingMessage, response: ServerResponse): string {
  const incoming = request.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  response.setHeader('X-Request-Id', id);
  return id;
}

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: requestId,
          // Credenciais e segredos nunca chegam aos logs.
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'req.headers["x-csrf-token"]',
              'res.headers["set-cookie"]',
            ],
            remove: true,
          },
          serializers: {
            req: (request: { id: string; method: string; url: string }) => ({
              id: request.id,
              method: request.method,
              url: request.url.split('?')[0],
            }),
            res: (response: { statusCode: number }) => ({ statusCode: response.statusCode }),
          },
          autoLogging: {
            ignore: (request: IncomingMessage) => request.url?.startsWith('/api/health') ?? false,
          },
          transport:
            config.isProduction || config.isTest
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                },
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    MailModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfig, RedisThrottlerStorage, Reflector],
      useFactory: (config: AppConfig, storage: RedisThrottlerStorage, reflector: Reflector) => ({
        storage,
        throttlers: [
          { name: 'default', ttl: 60_000, limit: config.rateLimit.globalPerMinute },
          {
            // Limite reduzido, aplicado apenas às rotas marcadas com @AuthRateLimited().
            name: 'auth',
            ttl: 60_000,
            limit: config.rateLimit.authPerMinute,
            skipIf: (context: ExecutionContext) =>
              !reflector.get<boolean>(AUTH_RATE_LIMITED, context.getHandler()),
          },
        ],
      }),
    }),
    AuditModule,
    SettingsModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    PublicModule,
    PlayersModule,
    ClubsModule,
    ContentModule,
    MediaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemFilter },
    // A ordem importa: limite de requisições → sessão → CSRF → permissões.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: SessionGuard },
    { provide: APP_GUARD, useExisting: CsrfGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
  ],
})
export class AppModule {}
