import type { ApiResponse, PublicHome } from '@efed/shared';
import { Trophy } from 'lucide-react';
import Link from 'next/link';
import { CalendarStrip } from '@/components/portal/calendar-strip';
import { FinalCta } from '@/components/portal/final-cta';
import { Hero } from '@/components/portal/hero';
import { LiveStrip } from '@/components/portal/live-strip';
import { NewsSection } from '@/components/portal/news-section';
import { StatsBand } from '@/components/portal/stats-band';
import { UpcomingMatches } from '@/components/portal/upcoming-matches';
import { CompetitionCard } from '@/components/sport/competition-card';
import { MatchRow } from '@/components/sport/match-row';
import { SectionHeader } from '@/components/sport/section-header';
import { StandingsTable } from '@/components/sport/standings-table';
import { TopPlayers } from '@/components/sport/top-players';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getAuthState, publicGet } from '@/lib/api/server';
import { pad2 } from '@/lib/portal';

export default async function HomePage() {
  const [auth, { data: home }] = await Promise.all([
    getAuthState(),
    publicGet<ApiResponse<PublicHome>>('/public/home'),
  ]);
  const signedIn = auth.kind === 'authenticated';
  // Horário de referência vindo da API: servidor e navegador rotulam "hoje" e "amanhã" igual.
  const now = new Date(home.generatedAt);
  const [featured, ...otherCompetitions] = home.featuredCompetition
    ? [
        home.featuredCompetition,
        ...home.competitions.filter((card) => card.slug !== home.featuredCompetition?.slug),
      ]
    : home.competitions;

  return (
    <>
      <Hero
        banner={home.banner}
        competition={home.featuredCompetition}
        nextMatch={home.nextMatch}
        signedIn={signedIn}
        now={now}
      />
      <LiveStrip
        lastResult={home.latestResults[0] ?? null}
        nextMatch={home.nextMatch}
        competition={home.featuredCompetition}
        now={now}
      />

      <section
        id="competicoes"
        aria-labelledby="competicoes-titulo"
        className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <SectionHeader
          id="competicoes-titulo"
          eyebrow={home.season?.name ?? 'Temporada'}
          title="Competições"
          description="Acompanhe as principais competições da Federação."
        />
        {featured ? (
          <div className="mt-10 space-y-6">
            <CompetitionCard
              competition={featured}
              featured
              action={
                featured.status === 'IN_PROGRESS' ? (
                  <Button asChild variant="primary">
                    <Link href="/#classificacao">Ver classificação</Link>
                  </Button>
                ) : featured.status === 'REGISTRATION_OPEN' && !signedIn ? (
                  <Button asChild variant="primary">
                    <Link href="/cadastro">Criar conta para participar</Link>
                  </Button>
                ) : undefined
              }
            />
            {otherCompetitions.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {otherCompetitions.map((competition) => (
                  <CompetitionCard
                    key={competition.slug}
                    competition={competition}
                    action={
                      competition.status === 'REGISTRATION_OPEN' && !signedIn ? (
                        <Button asChild variant="primary" size="sm">
                          <Link href="/cadastro">Criar conta para participar</Link>
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 border border-dashed border-border-strong">
            <EmptyState
              icon={Trophy}
              title="Nenhuma competição publicada"
              description="Quando a federação abrir a primeira temporada, os campeonatos, as inscrições e as tabelas aparecem aqui."
              action={
                signedIn ? undefined : (
                  <Button asChild>
                    <Link href="/cadastro">Criar conta para participar</Link>
                  </Button>
                )
              }
            />
          </div>
        )}
      </section>

      <div className="border-y border-border bg-surface-sunken">
        <div className="mx-auto grid w-full max-w-7xl gap-x-12 gap-y-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8">
          <section
            id="resultados"
            aria-labelledby="resultados-titulo"
            className="min-w-0 scroll-mt-20"
          >
            <SectionHeader
              id="resultados-titulo"
              eyebrow="Rodada a rodada"
              title="Últimos resultados"
            />
            {home.latestResults.length === 0 ? (
              <p className="type-body mt-6 border border-dashed border-border-strong p-6 text-fg-muted">
                Nenhum resultado homologado ainda.
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-border border-y border-border">
                {home.latestResults.map((match) => (
                  <MatchRow key={match.id} match={match} now={now} />
                ))}
              </ul>
            )}
          </section>
          <section id="partidas" aria-labelledby="partidas-titulo" className="min-w-0 scroll-mt-20">
            <SectionHeader id="partidas-titulo" eyebrow="Agenda" title="Próximos confrontos" />
            <div className="mt-6">
              <UpcomingMatches initial={home.upcomingMatches} generatedAt={home.generatedAt} />
            </div>
          </section>
        </div>
      </div>

      <section
        id="classificacao"
        aria-labelledby="classificacao-titulo"
        className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <SectionHeader
          id="classificacao-titulo"
          eyebrow={
            home.standings && home.featuredCompetition?.currentRound
              ? `${home.standings.competition.name} · Rodada ${pad2(home.featuredCompetition.currentRound)}`
              : 'Tabela'
          }
          title="Classificação"
        />
        {home.standings && home.standings.rows.length > 0 ? (
          <div className="mt-8 border border-border bg-surface">
            <StandingsTable
              rows={home.standings.rows}
              caption={`Cinco primeiros colocados de ${home.standings.competition.name}`}
            />
          </div>
        ) : (
          <p className="type-body mt-8 border border-dashed border-border-strong p-6 text-fg-muted">
            A classificação aparece quando a competição em destaque tiver participantes.
          </p>
        )}
      </section>

      {home.topPlayers.length > 0 ? (
        <section
          id="ranking"
          aria-labelledby="ranking-titulo"
          className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8"
        >
          <SectionHeader
            id="ranking-titulo"
            eyebrow={home.season?.name ?? 'Temporada'}
            title="Destaques da temporada"
            description="Aproveitamento de pontos em resultados homologados, com no mínimo três partidas."
          />
          <div className="mt-8">
            <TopPlayers players={home.topPlayers} />
          </div>
        </section>
      ) : null}

      <StatsBand stats={home.stats} />
      <CalendarStrip events={home.calendar} />
      <NewsSection featured={home.featuredNews} items={home.news} />
      <FinalCta signedIn={signedIn} />
    </>
  );
}
