'use client';

import { type ApiResponse, type PublicMatch, type UpcomingScope } from '@efed/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarX2, RotateCw } from 'lucide-react';
import { Tabs } from 'radix-ui';
import { useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { MatchRow } from '../sport/match-row';

const TABS: { value: UpcomingScope; label: string; empty: string }[] = [
  { value: 'today', label: 'Hoje', empty: 'Nenhum confronto marcado para hoje.' },
  { value: 'tomorrow', label: 'Amanhã', empty: 'Nenhum confronto marcado para amanhã.' },
  { value: 'week', label: 'Semana', empty: 'Nenhum confronto marcado para os próximos sete dias.' },
];

function Panel({
  scope,
  initial,
  now,
}: {
  scope: UpcomingScope;
  initial: PublicMatch[];
  now: Date;
}) {
  const query = useQuery({
    queryKey: ['public', 'upcoming', scope],
    queryFn: async ({ signal }) =>
      (
        await apiRequest<ApiResponse<PublicMatch[]>>('/public/matches/upcoming', {
          query: { scope, limit: 8 },
          signal,
        })
      ).data,
    // "Hoje" já chega renderizado pelo servidor; as outras abas são buscadas ao abrir.
    initialData: scope === 'today' ? initial : undefined,
    staleTime: 30_000,
  });
  const empty = TABS.find((tab) => tab.value === scope)?.empty ?? '';

  if (query.isPending) {
    return (
      <div className="space-y-3 py-4" aria-busy="true" aria-label="Carregando confrontos">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-14" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="type-body text-fg-muted">Não foi possível carregar os confrontos.</p>
        <Button size="sm" onClick={() => void query.refetch()}>
          <RotateCw aria-hidden="true" /> Tentar de novo
        </Button>
      </div>
    );
  }
  if (query.data.length === 0) {
    return (
      <div className="flex items-center gap-3 py-8 text-fg-muted">
        <CalendarX2 className="size-5 shrink-0 text-fg-faint" aria-hidden="true" />
        <p className="type-body">{empty}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {query.data.map((match) => (
        <MatchRow key={match.id} match={match} now={now} />
      ))}
    </ul>
  );
}

/** Próximos confrontos com filtro por período. */
export function UpcomingMatches({
  initial,
  generatedAt,
}: {
  initial: PublicMatch[];
  generatedAt: string;
}) {
  const [scope, setScope] = useState<UpcomingScope>('today');
  const now = new Date(generatedAt);
  return (
    <Tabs.Root value={scope} onValueChange={(value) => setScope(value as UpcomingScope)}>
      <Tabs.List
        aria-label="Período dos confrontos"
        className="flex gap-1 border-b border-border-strong"
      >
        {TABS.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className="type-eyebrow -mb-px border-b-2 border-transparent px-4 py-3 text-fg-subtle transition-colors duration-150 hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg"
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {TABS.map((tab) => (
        <Tabs.Content key={tab.value} value={tab.value} className="outline-none">
          <Panel scope={tab.value} initial={initial} now={now} />
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
