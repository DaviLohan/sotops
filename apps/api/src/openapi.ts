import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppConfig } from './config/app-config.js';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = app.get(AppConfig);
  const builder = new DocumentBuilder()
    .setTitle('Federação eFootball 1x1 — API')
    .setDescription(
      [
        'API REST versionada da federação.',
        '',
        '- **Autenticação**: cookie de sessão HttpOnly definido por `POST /api/v1/auth/login`.',
        '- **CSRF**: requisições autenticadas que alteram estado enviam `X-CSRF-Token` (obtido no login ou em `GET /api/v1/auth/me`).',
        '- **Sucesso**: envelope `{ data }`; listas paginadas usam `{ data, meta }`.',
        '- **Erros**: `application/problem+json` com `code` estável.',
      ].join('\n'),
    )
    .setVersion('1')
    .addCookieAuth(config.session.cookieName)
    .build();
  return SwaggerModule.createDocument(app, builder);
}

export function mountOpenApi(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app), {
    jsonDocumentUrl: 'api/docs/openapi.json',
    customSiteTitle: 'Federação eFootball — API',
  });
}
