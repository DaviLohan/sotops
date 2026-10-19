import type { PaginatedResponse, PublicClubListItem } from '@efed/shared';
import { Shield } from 'lucide-react';
import type { Metadata } from 'next';
import { LinkPagination } from '@/components/portal/link-pagination';
import { ListSearch } from '@/components/portal/list-search';
import { PortalPageHeader } from '@/components/portal/portal-page-header';
import { ClubCard } from '@/components/sport/club-card';
import { EmptyState } from '@/components/ui/empty-state';
import { publicGet } from '@/lib/api/server';
import { pageParam, searchParam } from '@/lib/portal';

export const metadata: Metadata = { title: 'Clubes' };

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = searchParam(params.busca);
  const page = pageParam(params.pagina);
  const query = new URLSearchParams({ page: String(page), pageSize: '24' });
  if (search) query.set('search', search);
  const clubs = await publicGet<PaginatedResponse<PublicClubListItem>>(`/public/clubs?${query}`);

  return (
    <>
      <PortalPageHeader
        eyebrow="Federação"
        title="Clubes"
        description="Os clubes filiados e seus elencos."
      >
        <ListSearch
          label="Buscar clubes"
          placeholder="Buscar por nome ou sigla"
          defaultValue={search}
        />
      </PortalPageHeader>
      <section
        aria-label="Lista de clubes"
        className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      >
        {clubs.data.length === 0 ? (
          <div className="border border-dashed border-border-strong">
            <EmptyState
              icon={Shield}
              title={search ? 'Nenhum clube encontrado' : 'Nenhum clube cadastrado'}
              description={search ? 'Confira o nome ou tente pela sigla.' : undefined}
            />
          </div>
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clubs.data.map((club) => (
                <li key={club.slug}>
                  <ClubCard club={club} />
                </li>
              ))}
            </ul>
            <LinkPagination meta={clubs.meta} basePath="/clubes" search={search} />
          </>
        )}
      </section>
    </>
  );
}
