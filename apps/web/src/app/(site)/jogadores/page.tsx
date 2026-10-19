import type { PaginatedResponse, PublicPlayerListItem } from '@efed/shared';
import { UserSearch } from 'lucide-react';
import type { Metadata } from 'next';
import { LinkPagination } from '@/components/portal/link-pagination';
import { ListSearch } from '@/components/portal/list-search';
import { PortalPageHeader } from '@/components/portal/portal-page-header';
import { PlayerCard } from '@/components/sport/player-card';
import { EmptyState } from '@/components/ui/empty-state';
import { publicGet } from '@/lib/api/server';
import { pageParam, searchParam } from '@/lib/portal';

export const metadata: Metadata = { title: 'Jogadores' };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = searchParam(params.busca);
  const page = pageParam(params.pagina);
  const query = new URLSearchParams({ page: String(page), pageSize: '24' });
  if (search) query.set('search', search);
  const players = await publicGet<PaginatedResponse<PublicPlayerListItem>>(
    `/public/players?${query}`,
  );

  return (
    <>
      <PortalPageHeader
        eyebrow="Federação"
        title="Jogadores"
        description="Quem disputa as competições da federação."
      >
        <ListSearch
          label="Buscar jogadores"
          placeholder="Buscar por apelido"
          defaultValue={search}
        />
      </PortalPageHeader>
      <section
        aria-label="Lista de jogadores"
        className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      >
        {players.data.length === 0 ? (
          <div className="border border-dashed border-border-strong">
            <EmptyState
              icon={UserSearch}
              title={search ? 'Nenhum jogador encontrado' : 'Nenhum jogador cadastrado'}
              description={search ? 'Confira o apelido ou tente parte dele.' : undefined}
            />
          </div>
        ) : (
          <>
            <p className="type-small mb-5 text-fg-subtle">
              {players.meta.total === 1 ? '1 jogador' : `${players.meta.total} jogadores`}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.data.map((player) => (
                <li key={player.slug}>
                  <PlayerCard player={player} />
                </li>
              ))}
            </ul>
            <LinkPagination meta={players.meta} basePath="/jogadores" search={search} />
          </>
        )}
      </section>
    </>
  );
}
