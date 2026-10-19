import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api/errors';

/**
 * Distribui os erros de validação devolvidos pela API nos campos do formulário.
 * Retorna `true` quando ao menos um erro foi associado a um campo conhecido.
 */
export function applyFieldErrors<Values extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<Values>,
  fields: readonly Path<Values>[],
): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  let applied = false;
  for (const fieldError of error.fieldErrors) {
    const field = fields.find((name) => name === fieldError.path);
    if (field) {
      setError(field, { type: 'server', message: fieldError.message });
      applied = true;
    }
  }
  return applied;
}

/** Aceita apenas caminhos internos como destino pós-login (evita redirecionamento aberto). */
export function safeNextPath(next: string | null | undefined, fallback = '/painel'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }
  return next;
}
