import { isOfficialMatchStatus, type PublicMatch } from '@efed/shared';
import { cn } from '@/lib/cn';
import { dayLabel, formatTime, pad2 } from '@/lib/portal';
import { MatchState } from './match-state';
import { PlayerName } from './player-name';

/**
 * Linha compacta de partida. No celular vira um cartão de placar: metadados em cima, os dois
 * jogadores nas laterais e o placar (ou o horário) no centro, sempre como protagonista.
 */
export function MatchRow({
  match,
  now,
  showCompetition = true,
  className,
}: {
  match: PublicMatch;
  now: Date;
  showCompetition?: boolean;
  className?: string;
}) {
  const official = isOfficialMatchStatus(match.status);
  const homeWon =
    official &&
    match.homeScore !== null &&
    match.awayScore !== null &&
    match.homeScore > match.awayScore;
  const awayWon =
    official &&
    match.homeScore !== null &&
    match.awayScore !== null &&
    match.awayScore > match.homeScore;
  return (
    <li className={cn('@container', className)}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1.5 py-3.5 @xl:grid-cols-[5.5rem_1fr_auto_1fr_9rem] @xl:gap-x-4">
        <div className="col-span-3 flex items-baseline gap-2 @xl:col-span-1 @xl:flex-col @xl:gap-0.5">
          <span className="type-display text-base text-fg">
            {official ? dayLabel(match.scheduledAt, now) : formatTime(match.scheduledAt)}
          </span>
          <span className="type-caption text-fg-subtle @xl:hidden">
            {showCompetition ? `${match.competition.name} · ` : ''}
            Rodada {pad2(match.round)}
            {official ? '' : ` · ${dayLabel(match.scheduledAt, now)}`}
          </span>
          <MatchState status={match.status} className="ml-auto @xl:ml-0" />
        </div>
        <PlayerName
          player={match.home}
          align="right"
          className={cn('justify-end', homeWon ? '' : official && 'opacity-80')}
        />
        <div
          className="type-display flex min-w-[4.5rem] items-center justify-center gap-2 text-center"
          aria-label={
            official
              ? `${match.home.nickname} ${match.homeScore} a ${match.awayScore} ${match.away.nickname}`
              : `${match.home.nickname} contra ${match.away.nickname}`
          }
        >
          {official ? (
            <>
              <span className={cn('type-score-sm', homeWon ? 'text-fg' : 'text-fg-muted')}>
                {match.homeScore}
              </span>
              <span className="text-sm text-fg-faint" aria-hidden="true">
                x
              </span>
              <span className={cn('type-score-sm', awayWon ? 'text-fg' : 'text-fg-muted')}>
                {match.awayScore}
              </span>
            </>
          ) : (
            <span className="text-sm tracking-widest text-fg-subtle">VS</span>
          )}
        </div>
        <PlayerName player={match.away} className={cn(awayWon ? '' : official && 'opacity-80')} />
        <div className="hidden @xl:block @xl:text-right">
          {showCompetition ? (
            <span className="type-caption block truncate text-fg-muted">
              {match.competition.name}
            </span>
          ) : null}
          <span className="type-caption block text-fg-subtle">Rodada {pad2(match.round)}</span>
        </div>
      </div>
    </li>
  );
}
