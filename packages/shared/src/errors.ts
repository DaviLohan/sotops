/**
 * Códigos de erro estáveis da API. O frontend decide o comportamento pelo `code`,
 * nunca pelo texto da mensagem.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'ACCOUNT_LOCKED',
  'ACCOUNT_SUSPENDED',
  'EMAIL_NOT_VERIFIED',
  'MFA_CHALLENGE_REQUIRED',
  'MFA_ENROLLMENT_REQUIRED',
  'MFA_INVALID_CODE',
  'MFA_ALREADY_ENABLED',
  'MFA_NOT_ENABLED',
  'FORBIDDEN',
  'CSRF_REJECTED',
  'NOT_FOUND',
  'CONFLICT',
  'USERNAME_TAKEN',
  'TOKEN_INVALID',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface FieldError {
  path: string;
  message: string;
}

/** Corpo de erro no formato "problem details" (RFC 9457) com extensões do projeto. */
export interface ApiProblem {
  status: number;
  code: ErrorCode;
  title: string;
  detail?: string;
  errors?: FieldError[];
  requestId?: string;
}
