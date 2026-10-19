'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/errors';
import { navigateWithReload } from '@/lib/navigation';

/** Quando a sessão expira no meio do uso, leva a pessoa ao login e de volta para onde estava. */
function handleExpiredSession(error: unknown): void {
  if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
    const next = `${window.location.pathname}${window.location.search}`;
    navigateWithReload(`/entrar?next=${encodeURIComponent(next)}`);
  }
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleExpiredSession }),
    mutationCache: new MutationCache({ onError: handleExpiredSession }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Erros de permissão ou validação não melhoram com novas tentativas.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
