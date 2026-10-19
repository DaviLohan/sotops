import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppConfig } from './config/app-config.js';
import { CSRF_HEADER } from './modules/auth/csrf.guard.js';

/**
 * Configuração HTTP compartilhada entre a aplicação real e os testes de integração,
 * para que os testes exercitem exatamente o mesmo pipeline.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);

  app.set('trust proxy', config.http.trustProxyHops);
  app.disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useBodyParser('json', { limit: '100kb' });

  // A API só devolve JSON: a política de conteúdo mais restritiva possível.
  const strictHeaders = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    strictTransportSecurity: config.isProduction,
  });
  // A documentação interativa (fora de produção) precisa carregar seus próprios scripts e estilos.
  const docsHeaders = helmet({ strictTransportSecurity: false });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const isDocs = config.http.openApiEnabled && request.path.startsWith('/api/docs');
    (isDocs ? docsHeaders : strictHeaders)(request, response, next);
  });
  app.use(cookieParser());
  app.enableCors({
    origin: [...config.http.allowedOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', CSRF_HEADER, 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });
  app.enableShutdownHooks();
}
