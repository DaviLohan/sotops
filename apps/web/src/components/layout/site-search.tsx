'use client';

import type { ApiResponse, SearchResult } from '@efed/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { ClubBadge } from '@/components/sport/club-badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { apiRequest } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { useDebouncedValue } from '@/lib/use-debounced-value';

/** Busca do cabeçalho: jogadores e clubes, pelo endpoint público de busca. */
export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const q = useDebouncedValue(term.trim(), 250);
  const enabled = open && q.length >= 2;

  const results = useQuery({
    queryKey: ['public-search', q],
    queryFn: ({ signal }) =>
      apiRequest<ApiResponse<SearchResult>>('/public/search', { query: { q }, signal }),
    enabled,
    placeholderData: keepPreviousData,
  });
  const data = enabled ? results.data?.data : undefined;
  const close = () => setOpen(false);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTerm('');
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Buscar jogadores e clubes">
          <Search aria-hidden="true" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-[10vh] left-1/2 z-50 flex max-h-[80vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col border border-border-strong bg-canvas-deep shadow-overlay duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <Dialog.Title className="sr-only">Buscar no portal</Dialog.Title>
          <Dialog.Description className="sr-only">
            Digite pelo menos duas letras do apelido do jogador ou do nome do clube.
          </Dialog.Description>
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Search className="ml-1 size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
            <Input
              type="search"
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              maxLength={60}
              aria-label="Buscar jogadores e clubes"
              placeholder="Jogador ou clube"
              className="border-0 bg-transparent focus-visible:ring-0"
            />
            {results.isFetching && enabled ? <Spinner className="size-4" /> : null}
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Fechar busca">
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto p-3" aria-live="polite">
            {!enabled ? (
              <p className="type-small p-3 text-fg-subtle">Digite pelo menos duas letras.</p>
            ) : results.isError ? (
              <p className="type-small p-3 text-danger">{messageFor(results.error)}</p>
            ) : !data ? null : data.players.length === 0 && data.clubs.length === 0 ? (
              <p className="type-small p-3 text-fg-subtle">Nada encontrado para “{q}”.</p>
            ) : (
              <>
                {data.players.length > 0 ? (
                  <ResultGroup title="Jogadores">
                    {data.players.map((player) => (
                      <li key={player.slug}>
                        <Link
                          href={`/jogadores/${player.slug}` as Route}
                          onClick={close}
                          className="flex items-center gap-3 rounded-sm p-2 hover:bg-surface-raised"
                        >
                          <Avatar name={player.nickname} src={player.avatarUrl} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-fg">{player.nickname}</span>
                          {player.club ? (
                            <span className="type-caption shrink-0 text-fg-subtle">
                              {player.club.tag}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ResultGroup>
                ) : null}
                {data.clubs.length > 0 ? (
                  <ResultGroup title="Clubes">
                    {data.clubs.map((club) => (
                      <li key={club.slug}>
                        <Link
                          href={`/clubes/${club.slug}` as Route}
                          onClick={close}
                          className="flex items-center gap-3 rounded-sm p-2 hover:bg-surface-raised"
                        >
                          <ClubBadge club={club} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-fg">{club.name}</span>
                          <span className="type-caption shrink-0 text-fg-subtle">{club.tag}</span>
                        </Link>
                      </li>
                    ))}
                  </ResultGroup>
                ) : null}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-2">
      <h2 className="type-eyebrow px-2 py-1.5 text-fg-subtle">{title}</h2>
      <ul>{children}</ul>
    </section>
  );
}
