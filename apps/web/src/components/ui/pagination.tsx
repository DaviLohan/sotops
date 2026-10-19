'use client';

import type { PaginationMeta } from '@efed/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  /** Nome do item no plural, para o resumo ("usuários", "eventos"). */
  itemLabel: string;
  disabled?: boolean;
}

export function Pagination({ meta, onPageChange, itemLabel, disabled = false }: PaginationProps) {
  const first = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const last = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 sm:px-6"
    >
      <p className="tabular text-[0.8125rem] text-fg-muted" aria-live="polite">
        {first}–{last} de {meta.total} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={disabled || meta.page <= 1}
        >
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
        <span className="tabular px-1 text-[0.8125rem] text-fg-muted">
          {meta.page} / {meta.totalPages}
        </span>
        <Button
          size="sm"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={disabled || meta.page >= meta.totalPages}
        >
          Próxima
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
