import type { ErrorCode, FieldError } from '@efed/shared';

interface AppErrorOptions {
  detail?: string;
  errors?: FieldError[];
  /** Segundos até uma nova tentativa fazer sentido (vira o cabeçalho Retry-After). */
  retryAfterSeconds?: number;
  cause?: unknown;
}

const TITLES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Os dados enviados são inválidos.',
  UNAUTHENTICATED: 'É necessário entrar na sua conta.',
  INVALID_CREDENTIALS: 'E-mail, nome de usuário ou senha incorretos.',
  ACCOUNT_LOCKED: 'Conta temporariamente bloqueada por excesso de tentativas.',
  ACCOUNT_SUSPENDED: 'Esta conta está suspensa.',
  EMAIL_NOT_VERIFIED: 'Confirme seu e-mail antes de entrar.',
  MFA_CHALLENGE_REQUIRED: 'Informe o código de verificação em duas etapas.',
  MFA_ENROLLMENT_REQUIRED: 'Seu papel exige verificação em duas etapas ativa.',
  MFA_INVALID_CODE: 'Código de verificação inválido.',
  MFA_ALREADY_ENABLED: 'A verificação em duas etapas já está ativa.',
  MFA_NOT_ENABLED: 'A verificação em duas etapas não está ativa.',
  FORBIDDEN: 'Você não tem permissão para realizar esta ação.',
  CSRF_REJECTED: 'A requisição foi recusada por segurança. Recarregue a página e tente novamente.',
  NOT_FOUND: 'Recurso não encontrado.',
  CONFLICT: 'A operação conflita com o estado atual do recurso.',
  USERNAME_TAKEN: 'Este nome de usuário já está em uso.',
  TOKEN_INVALID: 'O link é inválido ou expirou.',
  RATE_LIMITED: 'Muitas requisições. Aguarde um instante e tente novamente.',
  INTERNAL_ERROR: 'Ocorreu um erro inesperado.',
};

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 429,
  ACCOUNT_SUSPENDED: 403,
  EMAIL_NOT_VERIFIED: 403,
  MFA_CHALLENGE_REQUIRED: 403,
  MFA_ENROLLMENT_REQUIRED: 403,
  MFA_INVALID_CODE: 401,
  MFA_ALREADY_ENABLED: 409,
  MFA_NOT_ENABLED: 409,
  FORBIDDEN: 403,
  CSRF_REJECTED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  USERNAME_TAKEN: 409,
  TOKEN_INVALID: 400,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Erro de domínio da aplicação. Carrega um código estável; o status HTTP e o título
 * são derivados dele para que a mesma falha sempre produza a mesma resposta.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: FieldError[];
  readonly retryAfterSeconds?: number;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    super(options.detail ?? TITLES[code], { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.title = TITLES[code];
    this.detail = options.detail;
    this.errors = options.errors;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function titleForCode(code: ErrorCode): string {
  return TITLES[code];
}
