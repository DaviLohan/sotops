import type { ApiResponse, PublicClubProfile } from '@efed/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ClubBadge } from '@/components/sport/club-badge';
import { PlayerCard } from '@/components/sport/player-card';
import { SectionHeader } from '@/components/sport/section-header';
import { ApiError } from '@/lib/api/errors';
import { publicGet } from '@/lib/api/server';
import { civilDate } from '@/lib/portal';

type Params = { params: Promise<{ slug: string }> };

const loadClub = cache(async (slug: string): Promise<PublicClubProfile> => {
  try {
    const { data } = await publicGet<ApiResponse<PublicClubProfile>>(
      `/public/clubs/${encodeURIComponent(slug)}`,
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
  const club = await loadClub((await params).slug);
  return { title: club.name };
}

export default async function ClubPage({ params }: Params) {
  const club = await loadClub((await params).slug);

  return (
    <>
      <div className="border-b border-border bg-surface-sunken">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:px-6 sm:py-16 lg:px-8">
          <ClubBadge club={club} size="xl" className="h-24" />
          <div className="min-w-0">
            <p className="type-eyebrow flex items-center gap-2 text-accent">
              <span className="h-px w-6 bg-accent" aria-hidden="true" />
              Clube · {club.tag}
            </p>
            <h1 className="type-display type-xl mt-2 break-words text-fg">{club.name}</h1>
            <p className="type-body mt-2 text-fg-muted">
              {[
                club.members === 1 ? '1 jogador no elenco' : `${club.members} jogadores no elenco`,
                club.foundedOn ? `fundado em ${civilDate(club.foundedOn)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <section aria-labelledby="elenco-titulo">
          <SectionHeader id="elenco-titulo" eyebrow="Atual" title="Elenco" />
          {club.roster.length === 0 ? (
            <p className="type-body mt-6 border border-dashed border-border-strong p-6 text-fg-muted">
              Nenhum jogador vinculado no momento.
            </p>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {club.roster.map((entry) => (
                <li key={entry.player.slug}>
                  <PlayerCard player={entry.player} aside={`desde ${civilDate(entry.startedOn)}`} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {club.alumni.length > 0 ? (
          <section aria-labelledby="ex-titulo" className="mt-14">
            <SectionHeader id="ex-titulo" eyebrow="Histórico" title="Passaram pelo clube" />
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {club.alumni.map((entry) => (
                <li key={`${entry.player.slug}-${entry.startedOn}`}>
                  <PlayerCard
                    player={entry.player}
                    aside={`${civilDate(entry.startedOn)} – ${civilDate(entry.endedOn)}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
