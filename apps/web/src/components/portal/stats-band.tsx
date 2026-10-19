import type { FederationStats } from '@efed/shared';
import { formatNumber } from '@/lib/format';
import { SectionHeader } from '../sport/section-header';

const ITEMS: { key: keyof FederationStats; label: string }[] = [
  { key: 'players', label: 'Jogadores' },
  { key: 'clubs', label: 'Clubes' },
  { key: 'matches', label: 'Partidas decididas' },
  { key: 'competitions', label: 'Competições' },
  { key: 'goals', label: 'Gols marcados' },
];

/** A federação em números: faixa tipográfica, sem cards. */
export function StatsBand({ stats }: { stats: FederationStats }) {
  return (
    <section aria-labelledby="numeros" className="border-y border-border bg-canvas-deep">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <SectionHeader id="numeros" eyebrow="Temporada em dados" title="A federação em números" />
        <dl className="mt-10 grid grid-cols-2 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {ITEMS.map((item, index) => (
            <div
              key={item.key}
              className={index === 0 ? 'lg:pr-6' : 'lg:border-l lg:border-border lg:px-6'}
            >
              <dd className="type-display type-xl text-fg tabular">
                {formatNumber(stats[item.key])}
              </dd>
              <dt className="type-eyebrow mt-3 text-fg-subtle">{item.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
