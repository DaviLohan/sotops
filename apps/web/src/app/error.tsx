'use client';

import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="conteudo" className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState
        icon={TriangleAlert}
        title="Algo deu errado"
        description={
          <>
            Não conseguimos carregar esta página. Tente novamente em instantes.
            {error.digest ? (
              <span className="mt-2 block font-mono text-xs text-fg-subtle">
                Código: {error.digest}
              </span>
            ) : null}
          </>
        }
        action={
          <Button variant="primary" onClick={reset}>
            <RotateCw aria-hidden="true" />
            Tentar de novo
          </Button>
        }
      />
    </main>
  );
}
