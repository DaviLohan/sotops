import 'server-only';
import {
  type AccountDto,
  type ApiResponse,
  type AuthStateDto,
  DEFAULT_FEDERATION_NAME,
  type FederationSettings,
} from '@efed/shared';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { errorFromResponse } from './errors';

const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001').replace(
  /\/$/,
  '',
);
const SESSION_COOKIE_NAMES = ['__Host-efed_session', 'efed_session'];

/** Cabeçalhos repassados à API para que sessão, auditoria e limites enxerguem o cliente real. */
async function forwardedHeaders(): Promise<Record<string, string>> {
  const [cookieStore, incoming] = await Promise.all([cookies(), headers()]);
  const forwarded: Record<string, string> = {
    Accept: 'application/json',
    Cookie: cookieStore.toString(),
  };
  for (const name of ['x-forwarded-for', 'user-agent', 'x-request-id']) {
    const value = incoming.get(name);
    if (value) {
      forwarded[name] = value;
    }
  }
  return forwarded;
}

/** Leitura da API em Server Components. Sempre sem cache: os dados dependem da sessão. */
export async function serverGet<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${API_INTERNAL_URL}/api/v1${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, { headers: await forwardedHeaders(), cache: 'no-store' });
  if (!response.ok) {
    throw await errorFromResponse(response);
  }
  return (await response.json()) as T;
}

/**
 * Leitura de dados públicos (sem sessão). Não repassa cookies e pode ser reaproveitada por
 * alguns segundos: a HOME muda em minutos, não em milissegundos, e o portal aguenta picos.
 */
export async function publicGet<T>(
  path: string,
  revalidateSeconds = 15,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_INTERNAL_URL}/api/v1${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: revalidateSeconds },
    signal,
  });
  if (!response.ok) {
    throw await errorFromResponse(response);
  }
  return (await response.json()) as T;
}

export type AuthState =
  | { kind: 'authenticated'; account: AccountDto; csrfToken: string }
  | { kind: 'anonymous' }
  /** Senha aceita, mas a sessão ainda aguarda o segundo fator. */
  | { kind: 'mfa_pending' };

/**
 * Estado de autenticação da requisição atual, resolvido uma única vez por renderização.
 * A decisão de acesso é sempre da API; o frontend apenas reflete a resposta.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const cookieStore = await cookies();
  if (!SESSION_COOKIE_NAMES.some((name) => cookieStore.has(name))) {
    return { kind: 'anonymous' };
  }
  try {
    const { data } = await serverGet<ApiResponse<AuthStateDto>>('/auth/me');
    return { kind: 'authenticated', ...data };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'MFA_CHALLENGE_REQUIRED') {
      return { kind: 'mfa_pending' };
    }
    if (
      error instanceof Error &&
      'status' in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return { kind: 'anonymous' };
    }
    throw error;
  }
});

/**
 * Nome da federação (configurável no painel, decisão D10). Se a API não responder em 2 s, o nome
 * padrão: o título e o rodapé nunca derrubam nem penduram uma página.
 */
export const getFederationName = cache(async (): Promise<string> => {
  try {
    const { data } = await publicGet<ApiResponse<FederationSettings>>(
      '/public/settings',
      60,
      AbortSignal.timeout(2_000),
    );
    return data.federationName;
  } catch {
    return DEFAULT_FEDERATION_NAME;
  }
});
