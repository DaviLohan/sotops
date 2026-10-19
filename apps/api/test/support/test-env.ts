import 'reflect-metadata';

/**
 * Ambiente dos testes. O banco padrão é o `efed_test` criado pelo docker-compose.dev.yml;
 * defina TEST_DATABASE_URL / TEST_REDIS_URL / TEST_S3_ENDPOINT para apontar para outra instância.
 */
export const TEST_ORIGIN = 'http://localhost:3000';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://efed:dev-only-change-me-postgres@127.0.0.1:5432/efed_test?schema=public';

export const TEST_REDIS_URL =
  process.env.TEST_REDIS_URL ?? 'redis://:dev-only-change-me-redis@127.0.0.1:6379/1';

export const TEST_S3_ENDPOINT = process.env.TEST_S3_ENDPOINT ?? 'http://127.0.0.1:9000';

export const TEST_MFA_KEY = Buffer.alloc(32, 7);

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: TEST_DATABASE_URL,
  REDIS_URL: TEST_REDIS_URL,
  S3_ENDPOINT: TEST_S3_ENDPOINT,
  S3_BUCKET: 'efed-test',
  S3_ACCESS_KEY: process.env.TEST_S3_ACCESS_KEY ?? 'efed',
  S3_SECRET_KEY: process.env.TEST_S3_SECRET_KEY ?? 'dev-only-change-me-minio',
  ALLOWED_ORIGINS: TEST_ORIGIN,
  PUBLIC_WEB_URL: TEST_ORIGIN,
  CSRF_SECRET: 'test-csrf-secret-test-csrf-secret-test',
  MFA_ENCRYPTION_KEY: TEST_MFA_KEY.toString('base64'),
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '2525',
  MAIL_FROM: 'Testes <testes@federacao.local>',
  TRUST_PROXY_HOPS: '1',
  // Limites altos por padrão; o teste de limite de requisições cria uma aplicação com limite baixo.
  RATE_LIMIT_GLOBAL_PER_MINUTE: '100000',
  RATE_LIMIT_AUTH_PER_MINUTE: '100000',
});
