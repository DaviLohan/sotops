import type { TopPlayer } from '@efed/shared';
import { formatNumber } from '@/lib/format';
import { ClubBadge } from './club-badge';

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** Destaques da temporada: o líder em grande, os quatro seguintes em linhas menores. */
export function TopPlayers({ players }: { players: TopPlayer[] }) {
  const [leader, ...others] = players;
  if (!leader) {
    return null;
  }
  return (
    <div className="grid gap-px border border-border bg-border lg:grid-cols-[1.25fr_1fr]">
      <article className="relative isolate overflow-hidden bg-surface p-6 sm:p-8">
        <span
          aria-hidden="true"
          className="ghost-numeral pointer-events-none absolute -top-3 right-3 -z-10 select-none text-[9rem]"
        >
          1
        </span>
        <p className="type-eyebrow text-accent">#1 da temporada</p>
        <div className="mt-5 flex items-center gap-4">
          <ClubBadge club={leader.player.club} size="xl" />
          <div className="min-w-0">
            <h3 className="type-display type-xl truncate text-fg">{leader.player.nickname}</h3>
            <p className="type-small mt-1 text-fg-muted">
              {leader.player.club?.name ?? 'Sem clube'}
            </p>
          </div>
        </div>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-5">
          <div>
            <dd className="type-stat text-accent">{leader.winRate}%</dd>
            <dt className="type-caption mt-1.5 text-fg-subtle uppercase tracking-wider">
              Aproveitamento
            </dt>
          </div>
          <div>
            <dd className="type-stat text-fg">{formatNumber(leader.wins)}</dd>
            <dt className="type-caption mt-1.5 text-fg-subtle uppercase tracking-wider">
              Vitórias
            </dt>
          </div>
          <div>
            <dd className="type-stat text-fg">{signed(leader.goalDiff)}</dd>
            <dt className="type-caption mt-1.5 text-fg-subtle uppercase tracking-wider">Saldo</dt>
          </div>
        </dl>
      </article>
      <ol className="flex flex-col bg-surface">
        {others.map((entry) => (
          <li
            key={entry.player.slug}
            className="flex flex-1 items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 sm:px-6"
          >
            <span className="type-display w-7 text-2xl text-fg-faint tabular">#{entry.rank}</span>
            <ClubBadge club={entry.player.club} size="md" />
            <div className="min-w-0 flex-1">
              <p className="type-display truncate text-xl text-fg">{entry.player.nickname}</p>
              <p className="type-caption truncate text-fg-subtle">
                {entry.player.club?.name ?? 'Sem clube'}
              </p>
            </div>
            <div className="text-right">
              <p className="type-display text-xl text-fg tabular">{entry.winRate}%</p>
              <p className="type-caption text-fg-subtle">
                {entry.wins} V · {signed(entry.goalDiff)} SG
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
