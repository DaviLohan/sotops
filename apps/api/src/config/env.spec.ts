import { describe, expect, it } from 'vitest';
import { AppConfig } from './app-config.js';
import { parseEnv } from './env.js';

const valid = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://efed:segredo-forte@db:5432/efed',
  REDIS_URL: 'redis://redis:6379',
  S3_ENDPOINT: 'http://minio:9000/',
  ALLOWED_ORIGINS: 'https://federacao.example.com/, https://www.federacao.example.com',
  PUBLIC_WEB_URL: 'https://federacao.example.com/',
  CSRF_SECRET: 'x'.repeat(48),
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  MAIL_FROM: 'Federação <nao-responda@example.com>',
};

describe('configuração por variáveis de ambiente', () => {
  it('aplica padrões e normaliza origens', () => {
    const env = parseEnv(valid);
    expect(env.API_PORT).toBe(3001);
    expect(env.OPENAPI_ENABLED).toBe(false);
    expect(env.ALLOWED_ORIGINS).toEqual([
      'https://federacao.example.com',
      'https://www.federacao.example.com',
    ]);
    expect(env.PUBLIC_WEB_URL).toBe('https://federacao.example.com');
    expect(env.S3_ENDPOINT).toBe('http://minio:9000');
  });

  it('lista todas as variáveis inválidas de uma vez', () => {
    expect(() =>
      parseEnv({
        ...valid,
        DATABASE_URL: undefined,
        CSRF_SECRET: 'curto',
        MFA_ENCRYPTION_KEY: 'abc',
      }),
    ).toThrow(/DATABASE_URL[\s\S]*CSRF_SECRET[\s\S]*MFA_ENCRYPTION_KEY/);
  });

  it('recusa iniciar em produção com segredos de exemplo', () => {
    expect(() =>
      parseEnv({
        ...valid,
        NODE_ENV: 'production',
        CSRF_SECRET: 'dev-only-change-me-csrf-secret-0123456789abcdef',
        MFA_ENCRYPTION_KEY: Buffer.from('dev-only-change-me-mfa-key-32byt').toString('base64'),
      }),
    ).toThrow(/CSRF_SECRET ainda usa um valor de exemplo[\s\S]*MFA_ENCRYPTION_KEY ainda usa/);
  });

  it('exige HTTPS nas origens em produção', () => {
    expect(() =>
      parseEnv({
        ...valid,
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'http://federacao.example.com',
      }),
    ).toThrow(/precisa usar HTTPS/);
    expect(() => parseEnv({ ...valid, NODE_ENV: 'production' })).not.toThrow();
  });

  it('usa cookie com prefixo __Host- e Secure somente em produção', () => {
    const production = new AppConfig(parseEnv({ ...valid, NODE_ENV: 'production' }));
    expect(production.session).toMatchObject({
      cookieName: '__Host-efed_session',
      secureCookie: true,
    });

    const development = new AppConfig(parseEnv(valid));
    expect(development.session).toMatchObject({ cookieName: 'efed_session', secureCookie: false });
  });
});
