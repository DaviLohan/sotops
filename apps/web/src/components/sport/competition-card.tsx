import {
  COMPETITION_FORMAT_LABELS,
  type CompetitionCard as CompetitionCardData,
} from '@efed/shared';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { pad2, shortDate } from '@/lib/portal';
import { CompetitionStatus } from './competition-status';

function Figure({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <dt className="type-caption text-fg-subtle uppercase tracking-wider">{label}</dt>
      <dd className="type-display mt-1 text-2xl text-fg tabular">{value}</dd>
    </div>
  );
}

/**
 * Card editorial horizontal de competição. O destaque ocupa a largura toda e ganha o
 * numeral da rodada como elemento gráfico; os demais são mais compactos.
 */
export function CompetitionCard({
  competition,
  featured = false,
  action,
}: {
  competition: CompetitionCardData;
  featured?: boolean;
  action?: ReactNode;
}) {
  const progress =
    competition.matchesTotal > 0
      ? Math.round((competition.matchesPlayed / competition.matchesTotal) * 100)
      : 0;
  const round = competition.currentRound;
  const nextDate =
    competition.status === 'REGISTRATION_OPEN'
      ? competition.registrationClosesOn
      : competition.nextRoundStartsOn;
  const nextLabel =
    competition.status === 'REGISTRATION_OPEN' ? 'Inscrições até' : 'Próxima rodada';

  return (
    <article
      className={cn(
        'clip-notch relative isolate overflow-hidden border border-border bg-surface',
        featured ? 'p-6 sm:p-8 lg:p-10' : 'p-5 sm:p-6',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          competition.status === 'IN_PROGRESS' ? 'bg-accent' : 'bg-brand',
        )}
      />
      {featured && round !== null ? (
        <span
          aria-hidden="true"
          className="ghost-numeral pointer-events-none absolute -right-2 -bottom-6 -z-10 select-none text-[8rem] sm:text-[15rem]"
        >
          {pad2(round)}
        </span>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="type-eyebrow text-fg-subtle">
          {competition.seasonName} · {COMPETITION_FORMAT_LABELS[competition.format]}
        </p>
        <CompetitionStatus status={competition.status} />
      </div>
      <h3 className={cn('type-display mt-3 text-fg', featured ? 'type-xl' : 'type-h2')}>
        {competition.name}
      </h3>
      {competition.description ? (
        <p className="type-body mt-2 max-w-lg text-fg-muted">{competition.description}</p>
      ) : null}

      <dl
        className={cn(
          'mt-6 grid gap-x-8 gap-y-4',
          featured ? 'grid-cols-2 sm:grid-cols-4 lg:max-w-2xl' : 'grid-cols-2',
        )}
      >
        <Figure
          label="Participantes"
          value={
            competition.status === 'REGISTRATION_OPEN'
              ? `${competition.participants}/${competition.maxParticipants}`
              : formatNumber(competition.participants)
          }
        />
        {round !== null && competition.roundsTotal ? (
          <Figure label="Rodada" value={`${pad2(round)}/${pad2(competition.roundsTotal)}`} />
        ) : (
          <Figure
            label="Rodadas"
            value={competition.roundsTotal ? pad2(competition.roundsTotal) : '—'}
          />
        )}
        {competition.matchesTotal > 0 ? (
          <Figure label="Partidas" value={formatNumber(competition.matchesTotal)} />
        ) : null}
        {nextDate ? <Figure label={nextLabel} value={shortDate(nextDate)} /> : null}
      </dl>

      {competition.matchesTotal > 0 ? (
        <div className="mt-6 max-w-2xl">
          <div className="flex items-center justify-between type-caption text-fg-subtle">
            <span>
              {formatNumber(competition.matchesPlayed)} de {formatNumber(competition.matchesTotal)}{' '}
              partidas decididas
            </span>
            <span className="tabular">{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={`Andamento de ${competition.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="mt-2 h-1 bg-surface-elevated"
          >
            <div className="h-full bg-brand-hover" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {action ? <div className="mt-7">{action}</div> : null}
    </article>
  );
}
