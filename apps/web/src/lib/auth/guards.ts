import 'server-only';
import { redirect } from 'next/navigation';
import { type AuthState, getAuthState } from '@/lib/api/server';

type Authenticated = Extract<AuthState, { kind: 'authenticated' }>;

/**
 * Garante uma sessão completa nas áreas autenticadas. O redirecionamento é conveniência de
 * navegação: quem protege os dados é a API, que valida a sessão em cada chamada.
 */
export async function requireSession(): Promise<Authenticated> {
  const state = await getAuthState();
  if (state.kind !== 'authenticated') {
    redirect('/entrar');
  }
  return state;
}

/** Páginas de acesso (entrar, cadastro) não fazem sentido para quem já está autenticado. */
export async function redirectIfAuthenticated(): Promise<void> {
  const state = await getAuthState();
  if (state.kind === 'authenticated') {
    redirect('/painel');
  }
}
