'use client';

import type { AccountDto, Permission } from '@efed/shared';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';
import { apiRequest } from '@/lib/api/client';

interface SessionValue {
  account: AccountDto;
  csrfToken: string;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ value, children }: { value: SessionValue; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession só pode ser usado dentro das áreas autenticadas.');
  }
  return session;
}

/** Controla apenas o que a interface mostra; a autorização real é feita pela API. */
export function useCan(permission: Permission): boolean {
  return useSession().account.permissions.includes(permission);
}

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Cliente da API para a sessão atual: anexa o token anti-CSRF nas alterações. */
export function useApi() {
  const { csrfToken } = useSession();

  const get = useCallback(
    <T,>(
      path: string,
      query?: Record<string, string | number | undefined | null>,
      signal?: AbortSignal,
    ) => apiRequest<T>(path, { query, signal }),
    [],
  );
  const send = useCallback(
    <T,>(method: Method, path: string, body?: unknown) =>
      apiRequest<T>(path, { method, body, csrfToken }),
    [csrfToken],
  );

  return useMemo(() => ({ get, send }), [get, send]);
}
