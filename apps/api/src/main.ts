import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.js';
import { configureApp } from './configure-app.js';
import { mountOpenApi } from './openapi.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  configureApp(app);

  const config = app.get(AppConfig);
  if (config.http.openApiEnabled) {
    mountOpenApi(app);
  }

  await app.listen(config.http.port, config.http.host);
  logger.log(`API em http://${config.http.host}:${config.http.port}/api`, 'Bootstrap');
}

void bootstrap();
