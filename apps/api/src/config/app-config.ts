import type { Env } from './env.js';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Configuração tipada da aplicação. É a única porta de entrada para valores de ambiente:
 * nenhum módulo lê `process.env` diretamente.
 */
export class AppConfig {
  readonly isProduction: boolean;
  readonly isTest: boolean;
  readonly logLevel: Env['LOG_LEVEL'];

  readonly http: {
    host: string;
    port: number;
    trustProxyHops: number;
    allowedOrigins: readonly string[];
    openApiEnabled: boolean;
  };

  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly s3Endpoint: string;
  readonly publicWebUrl: string;

  readonly session: {
    cookieName: string;
    secureCookie: boolean;
    idleTtlMs: number;
    adminIdleTtlMs: number;
    absoluteTtlMs: number;
    /** Sessões que aguardam o segundo fator vivem pouco. */
    pendingMfaTtlMs: number;
    /** Intervalo mínimo entre renovações de `last_seen_at`, para não escrever a cada requisição. */
    touchIntervalMs: number;
  };

  readonly security: {
    csrfSecret: string;
    mfaEncryptionKey: Buffer;
    mfaIssuer: string;
    emailVerificationTtlMs: number;
    passwordResetTtlMs: number;
    loginLockThreshold: number;
    loginLockMaxMs: number;
  };

  readonly mail: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
  };

  readonly rateLimit: {
    globalPerMinute: number;
    authPerMinute: number;
  };

  constructor(env: Env) {
    this.isProduction = env.NODE_ENV === 'production';
    this.isTest = env.NODE_ENV === 'test';
    this.logLevel = env.LOG_LEVEL;

    this.http = {
      host: env.API_HOST,
      port: env.API_PORT,
      trustProxyHops: env.TRUST_PROXY_HOPS,
      allowedOrigins: env.ALLOWED_ORIGINS,
      openApiEnabled: env.OPENAPI_ENABLED,
    };

    this.databaseUrl = env.DATABASE_URL;
    this.redisUrl = env.REDIS_URL;
    this.s3Endpoint = env.S3_ENDPOINT;
    this.publicWebUrl = env.PUBLIC_WEB_URL;

    this.session = {
      // O prefixo __Host- exige Secure, Path=/ e ausência de Domain, e por isso só vale com HTTPS.
      cookieName: this.isProduction ? '__Host-efed_session' : 'efed_session',
      secureCookie: this.isProduction,
      idleTtlMs: env.SESSION_IDLE_TTL_MINUTES * MINUTE_MS,
      adminIdleTtlMs: env.ADMIN_SESSION_IDLE_TTL_MINUTES * MINUTE_MS,
      absoluteTtlMs: env.SESSION_ABSOLUTE_TTL_DAYS * DAY_MS,
      pendingMfaTtlMs: 10 * MINUTE_MS,
      touchIntervalMs: MINUTE_MS,
    };

    this.security = {
      csrfSecret: env.CSRF_SECRET,
      mfaEncryptionKey: Buffer.from(env.MFA_ENCRYPTION_KEY, 'base64'),
      mfaIssuer: 'Federação eFootball',
      emailVerificationTtlMs: DAY_MS,
      passwordResetTtlMs: 30 * MINUTE_MS,
      loginLockThreshold: 5,
      loginLockMaxMs: 15 * MINUTE_MS,
    };

    this.mail = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.MAIL_FROM,
    };

    this.rateLimit = {
      globalPerMinute: env.RATE_LIMIT_GLOBAL_PER_MINUTE,
      authPerMinute: env.RATE_LIMIT_AUTH_PER_MINUTE,
    };
  }
}
