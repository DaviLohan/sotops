import { z } from 'zod';

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const commaSeparatedOrigins = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter((origin) => origin.length > 0),
  )
  .pipe(z.array(z.url()).min(1));

const base64Key32 = z
  .string()
  .refine(
    (value) => Buffer.from(value, 'base64').length === 32,
    'deve ser uma chave de 32 bytes em Base64 (gere com: openssl rand -base64 32)',
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  /** Quantidade de proxies reversos confiáveis à frente da API (0 = conexão direta). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  OPENAPI_ENABLED: booleanFromString.default(false),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  /** Armazenamento compatível com S3 (MinIO): avatares, escudos e, depois, evidências. */
  S3_ENDPOINT: z.url().transform((value) => value.replace(/\/$/, '')),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'nome de bucket S3 inválido')
    .default('efed'),
  S3_ACCESS_KEY: z.string().min(3),
  S3_SECRET_KEY: z.string().min(8, 'deve ter pelo menos 8 caracteres'),

  /** Origens autorizadas a chamar a API com credenciais (separadas por vírgula). */
  ALLOWED_ORIGINS: commaSeparatedOrigins,
  /** URL pública do frontend, usada nos links enviados por e-mail. */
  PUBLIC_WEB_URL: z.url().transform((value) => value.replace(/\/$/, '')),

  SESSION_IDLE_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .default(60 * 24 * 7),
  SESSION_ABSOLUTE_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  /** Contas com papel administrativo expiram por inatividade mais cedo. */
  ADMIN_SESSION_IDLE_TTL_MINUTES: z.coerce.number().int().min(5).default(120),

  CSRF_SECRET: z.string().min(32, 'deve ter pelo menos 32 caracteres'),
  MFA_ENCRYPTION_KEY: base64Key32,

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: booleanFromString.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(3),

  RATE_LIMIT_GLOBAL_PER_MINUTE: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().min(1).default(10),
});

export type Env = z.infer<typeof envSchema>;

const PLACEHOLDER_MARKERS = ['change-me', 'changeme', 'dev-only'];

function assertProductionSecrets(env: Env): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }
  const problems: string[] = [];
  const secrets: Record<string, string> = {
    CSRF_SECRET: env.CSRF_SECRET,
    MFA_ENCRYPTION_KEY: Buffer.from(env.MFA_ENCRYPTION_KEY, 'base64').toString('latin1'),
    DATABASE_URL: env.DATABASE_URL,
    S3_SECRET_KEY: env.S3_SECRET_KEY,
  };
  for (const [name, value] of Object.entries(secrets)) {
    if (PLACEHOLDER_MARKERS.some((marker) => value.toLowerCase().includes(marker))) {
      problems.push(`${name} ainda usa um valor de exemplo`);
    }
  }
  for (const origin of new Set([...env.ALLOWED_ORIGINS, env.PUBLIC_WEB_URL])) {
    if (!origin.startsWith('https://')) {
      problems.push(`a origem ${origin} precisa usar HTTPS em produção`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Configuração insegura para produção:\n- ${problems.join('\n- ')}`);
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${details}`);
  }
  assertProductionSecrets(result.data);
  return result.data;
}
