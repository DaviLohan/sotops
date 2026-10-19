import type { PaginationMeta } from '@efed/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Paginação por links (renderizada no servidor), preservando a busca. */
export function LinkPagination({
  meta,
  basePath,
  search,
}: {
  meta: PaginationMeta;
  basePath: string;
  search?: string;
}) {
  if (meta.totalPages <= 1) {
    return null;
  }
  const href = (page: number) => {
    const params = new URLSearchParams();
    if (search) params.set('busca', search);
    if (page > 1) params.set('pagina', String(page));
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ''}` as Route;
  };
  return (
    <nav aria-label="Paginação" className="mt-10 flex items-center justify-between gap-4">
      {meta.page > 1 ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={href(meta.page - 1)} rel="prev">
            <ChevronLeft aria-hidden="true" />
            Anterior
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="type-small text-fg-subtle">
        Página {meta.page} de {meta.totalPages}
      </p>
      {meta.page < meta.totalPages ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={href(meta.page + 1)} rel="next">
            Próxima
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
