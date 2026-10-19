import type { CompetitionCard, PublicMatch } from '@efed/shared';
import { cn } from '@/lib/cn';
import { dayLabel, formatTime, pad2 } from '@/lib/portal';
import { ClubBadge } from '../sport/club-badge';

function Cell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-[17rem] flex-1 snap-start flex-col justify-center gap-2 px-5 py-4 sm:px-6',
        className,
      )}
    >
      <p className="type-eyebrow text-fg-subtle">{label}</p>
      {children}
    </div>
  );
}

function Duel({ match, score }: { match: PublicMatch; score: boolean }) {
  return (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <ClubBadge club={match.home.club} size="sm" />
      <span className="type-display text-lg text-fg">{match.home.nickname}</span>
      {score ? (
        <span className="type-display text-xl text-accent tabular">
          {match.homeScore} <span className="text-fg-faint">x</span> {match.awayScore}
        </span>
      ) : (
        <span className="type-display text-sm tracking-widest text-fg-subtle">VS</span>
      )}
      <span className="type-display text-lg text-fg">{match.away.nickname}</span>
      <ClubBadge club={match.away.club} size="sm" />
    </div>
  );
}

/**
 * Faixa logo abaixo do hero: último resultado, próxima partida e ponto da temporada.
 * Não há "ao vivo": partidas 1x1 só têm placar depois de jogadas e conferidas.
 */
export function LiveStrip({
  lastResult,
  nextMatch,
  competition,
  now,
}: {
  lastResult: PublicMatch | null;
  nextMatch: PublicMatch | null;
  competition: CompetitionCard | null;
  now: Date;
}) {
  if (!lastResult && !nextMatch && !competition) {
    return null;
  }
  const progress =
    competition && competition.roundsTotal && competition.currentRound
      ? Math.round((competition.currentRound / competition.roundsTotal) * 100)
      : null;
  return (
    <section aria-label="Situação da temporada" className="border-b border-border bg-surface">
      <div
        tabIndex={0}
        role="group"
        aria-label="Resumo da temporada (role para o lado para ver mais)"
        className="mx-auto flex w-full max-w-7xl snap-x snap-mandatory divide-x divide-border overflow-x-auto"
      >
        {lastResult ? (
          <Cell label="Último resultado">
            <Duel match={lastResult} score />
          </Cell>
        ) : null}
        {nextMatch ? (
          <Cell
            label={`Próxima partida · ${dayLabel(nextMatch.scheduledAt, now)} ${formatTime(nextMatch.scheduledAt)}`}
          >
            <Duel match={nextMatch} score={false} />
          </Cell>
        ) : null}
        {competition && competition.roundsTotal && competition.currentRound ? (
          <Cell label={`${competition.name} · Rodada`}>
            <div className="flex items-center gap-4">
              <p className="type-display text-xl text-fg tabular">
                {pad2(competition.currentRound)}{' '}
                <span className="text-fg-faint">/ {pad2(competition.roundsTotal)}</span>
              </p>
              {progress !== null ? (
                <div
                  role="progressbar"
                  aria-label="Andamento da temporada"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  className="h-1 flex-1 bg-surface-elevated"
                >
                  <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
                </div>
              ) : null}
            </div>
          </Cell>
        ) : null}
      </div>
    </section>
  );
}
