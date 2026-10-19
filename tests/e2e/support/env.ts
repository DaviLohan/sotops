/**
 * Ambiente isolado dos testes end-to-end: portas, banco e Redis próprios, para não tocar
 * nos dados de desenvolvimento. Sobrescreva E2E_DATABASE_URL / E2E_REDIS_URL se necessário.
 */
export const WEB_PORT = 3100;
export const API_PORT = 3101;
export const SMTP_PORT = 2526;
export const MAIL_API_PORT = 2527;

export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const MAIL_API_URL = `http://127.0.0.1:${MAIL_API_PORT}`;

export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://efed:dev-only-change-me-postgres@127.0.0.1:5432/efed_e2e?schema=public';
export const REDIS_URL =
  process.env.E2E_REDIS_URL ?? 'redis://:dev-only-change-me-redis@127.0.0.1:6379/2';

export const SEED_PASSWORD = 'desenvolvimento-123';

export const apiEnv: Record<string, string> = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'warn',
  API_HOST: '127.0.0.1',
  API_PORT: String(API_PORT),
  DATABASE_URL,
  REDIS_URL,
  S3_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000',
  S3_BUCKET: 'efed-e2e',
  S3_ACCESS_KEY: process.env.E2E_S3_ACCESS_KEY ?? 'efed',
  S3_SECRET_KEY: process.env.E2E_S3_SECRET_KEY ?? 'dev-only-change-me-minio',
  ALLOWED_ORIGINS: WEB_URL,
  PUBLIC_WEB_URL: WEB_URL,
  CSRF_SECRET: 'e2e-csrf-secret-e2e-csrf-secret-e2e-csrf',
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: String(SMTP_PORT),
  SMTP_SECURE: 'false',
  MAIL_FROM: 'E2E <e2e@federacao.local>',
  OPENAPI_ENABLED: 'false',
  RATE_LIMIT_GLOBAL_PER_MINUTE: '100000',
  RATE_LIMIT_AUTH_PER_MINUTE: '100000',
};
