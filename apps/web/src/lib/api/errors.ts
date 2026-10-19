import type { ApiProblem, ErrorCode, FieldError } from '@efed/shared';

/** Erro devolvido pela API no formato problem details. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly detail?: string;
  readonly fieldErrors: FieldError[];
  readonly retryAfterSeconds?: number;

  constructor(problem: ApiProblem, retryAfterSeconds?: number) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
    this.detail = problem.detail;
    this.fieldErrors = problem.errors ?? [];
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const NETWORK_PROBLEM: ApiProblem = {
  status: 0,
  code: 'INTERNAL_ERROR',
  title: 'Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.',
};

export function networkError(): ApiError {
  return new ApiError(NETWORK_PROBLEM);
}

export async function errorFromResponse(response: Response): Promise<ApiError> {
  const retryAfter = Number(response.headers.get('retry-after'));
  try {
    const problem = (await response.json()) as ApiProblem;
    if (typeof problem.code === 'string' && typeof problem.title === 'string') {
      return new ApiError(
        problem,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
      );
    }
  } catch {
    // Corpo ausente ou fora do formato: cai no erro genérico abaixo.
  }
  return new ApiError({
    status: response.status,
    code: 'INTERNAL_ERROR',
    title: 'Ocorreu um erro inesperado. Tente novamente em instantes.',
  });
}

/** Mensagem pronta para exibir ao usuário. */
export function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'ACCOUNT_LOCKED' && error.retryAfterSeconds) {
      const minutes = Math.ceil(error.retryAfterSeconds / 60);
      return `Muitas tentativas. Aguarde ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'} e tente de novo.`;
    }
    return error.message;
  }
  return 'Ocorreu um erro inesperado. Tente novamente em instantes.';
}
