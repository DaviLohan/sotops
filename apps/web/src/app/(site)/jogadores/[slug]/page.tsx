import { GAME_PLATFORM_LABELS, type ApiResponse, type PublicPlayerProfile } from '@efed/shared';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ClubBadge } from '@/components/sport/club-badge';
import { MatchRow } from '@/components/sport/match-row';
import { SectionHeader } from '@/components/sport/section-header';
import { Avatar } from '@/components/ui/avatar';
import { ApiError } from '@/lib/api/errors';
import { publicGet } from '@/lib/api/server';
import { countryName } from '@/lib/countries';
import { civilDate, monthYear } from '@/lib/portal';

type Params = { params: Promise<{ slug: string }> };

/** Um único pedido por renderização, compartilhado entre os metadados e a página. */
const loadPlayer = cache(async (slug: string): Promise<PublicPlayerProfile> => {
  try {
    const { data } = await publicGet<ApiResponse<PublicPlayerProfile>>(
      `/public/players/${encodeURIComponent(slug)}`,
    );
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const player = await loadPlayer((await params).slug);
  return { title: player.nickname };
}

export default async function PlayerPage({ params }: Params) {
  const player = await loadPlayer((await params).slug);
  const now = new Date();
  const { record } = player;
  const stats = [
    { label: 'Jogos', value: record.played },
    { label: 'Vitórias', value: record.won },
    { label: 'Empates', value: record.drawn },
    { label: 'Derrotas', value: record.lost },
    { label: 'Gols pró', value: record.goalsFor },
    { label: 'Gols contra', value: record.goalsAgainst },
  ];

  return (
    <>
      <div className="border-b border-border bg-surface-sunken">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:px-6 sm:py-16 lg:px-8">
          <Avatar name={player.nickname} src={player.avatarUrl} size="xl" />
          <div className="min-w-0">
            <p className="type-eyebrow flex items-center gap-2 text-accent">
              <span className="h-px w-6 bg-accent" aria-hidden="true" />
              Jogador
            </p>
            <h1 className="type-display type-xl mt-2 break-words text-fg">{player.nickname}</h1>
            <p className="type-body mt-2 text-fg-muted">
              {[countryName(player.country), player.region, GAME_PLATFORM_LABELS[player.platform]]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="type-small mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-fg-muted">
              {player.club ? (
                <Link
                  href={`/clubes/${player.club.slug}` as Route}
                  className="flex items-center gap-2 hover:text-fg"
                >
                  <ClubBadge club={player.club} size="sm" />
                  {player.club.name}
                </Link>
              ) : (
                <span className="flex items-center gap-2">
                  <ClubBadge club={null} size="sm" />
                  Sem clube
                </span>
              )}
              <span>Na federação desde {monthYear(player.memberSince)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <section aria-labelledby="campanha-titulo">
          <SectionHeader
            id="campanha-titulo"
            eyebrow="Resultados oficiais"
            title="Campanha"
            description="Somente partidas homologadas pela federação."
          />
          <dl className="mt-6 grid grid-cols-3 border-t border-l border-border sm:grid-cols-6">
            {stats.map((stat) => (
              <div key={stat.label} className="border-r border-b border-border p-4">
                <dt className="type-caption text-fg-subtle">{stat.label}</dt>
                <dd className="type-display type-stat mt-1 text-fg">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-14 grid gap-x-12 gap-y-14 lg:grid-cols-2">
          <section aria-labelledby="recentes-titulo" className="min-w-0">
            <SectionHeader id="recentes-titulo" eyebrow="Histórico" title="Últimos resultados" />
            {player.recentMatches.length === 0 ? (
              <p className="type-body mt-6 border border-dashed border-border-strong p-6 text-fg-muted">
                Nenhuma partida oficial ainda.
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-border border-y border-border">
                {player.recentMatches.map((match) => (
                  <MatchRow key={match.id} match={match} now={now} />
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="proximas-titulo" className="min-w-0">
            <SectionHeader id="proximas-titulo" eyebrow="Agenda" title="Próximas partidas" />
            {player.upcomingMatches.length === 0 ? (
              <p className="type-body mt-6 border border-dashed border-border-strong p-6 text-fg-muted">
                Nenhuma partida marcada.
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-border border-y border-border">
                {player.upcomingMatches.map((match) => (
                  <MatchRow key={match.id} match={match} now={now} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <section aria-labelledby="clubes-titulo" className="mt-14">
          <SectionHeader id="clubes-titulo" eyebrow="Vínculos" title="Clubes" />
          {player.memberships.length === 0 ? (
            <p className="type-body mt-6 border border-dashed border-border-strong p-6 text-fg-muted">
              Ainda não defendeu nenhum clube.
            </p>
          ) : (
            <ol className="mt-6 divide-y divide-border border-y border-border">
              {player.memberships.map((membership) => (
                <li
                  key={`${membership.club.slug}-${membership.startedOn}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <Link
                    href={`/clubes/${membership.club.slug}` as Route}
                    className="flex items-center gap-3 text-fg hover:text-accent"
                  >
                    <ClubBadge club={membership.club} />
                    <span className="type-display type-h3">{membership.club.name}</span>
                  </Link>
                  <span className="type-small text-fg-muted">
                    {membership.endedOn
                      ? `${civilDate(membership.startedOn)} – ${civilDate(membership.endedOn)}`
                      : `Desde ${civilDate(membership.startedOn)}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
