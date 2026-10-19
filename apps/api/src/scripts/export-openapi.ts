/**
 * Exporta o contrato OpenAPI para docs/openapi.json sem abrir a porta HTTP.
 *
 *   pnpm --filter @efed/api build && pnpm --filter @efed/api openapi:export
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../app.module.js';
import { configureApp } from '../configure-app.js';
import { buildOpenApiDocument } from '../openapi.js';

async function main(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  configureApp(app);
  await app.init();
  const target = path.resolve(import.meta.dirname, '../../../../docs/openapi.json');
  writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`);
  await app.close();
  console.log(`Contrato exportado para ${target}`);
}

void main();
