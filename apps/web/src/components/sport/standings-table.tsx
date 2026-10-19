import type { StandingRow } from '@efed/shared';
import { cn } from '@/lib/cn';
import { ClubBadge } from './club-badge';
import { FormDots } from './form-dots';

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/**
 * Classificação compacta. O líder recebe só uma marca lateral e um leve realce. No celular
 * some a coluna de clube (o emblema fica ao lado do apelido) e a de forma.
 */
export function StandingsTable({ rows, caption }: { rows: StandingRow[]; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="type-eyebrow text-fg-subtle">
            <th scope="col" className="w-10 py-2 pr-2 pl-3 font-semibold">
              Pos
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              Jogador
            </th>
            <th scope="col" className="hidden py-2 pr-3 font-semibold md:table-cell">
              Clube
            </th>
            <th scope="col" className="w-10 py-2 text-right font-semibold">
              <abbr title="Partidas jogadas" className="no-underline">
                PJ
              </abbr>
            </th>
            <th scope="col" className="w-12 py-2 text-right font-semibold">
              <abbr title="Saldo de gols" className="no-underline">
                SG
              </abbr>
            </th>
            <th scope="col" className="hidden w-32 py-2 pl-4 font-semibold lg:table-cell">
              Forma
            </th>
            <th scope="col" className="w-14 py-2 pr-3 text-right font-semibold">
              <abbr title="Pontos" className="no-underline">
                PTS
              </abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.player.slug}
              className={cn(
                'border-t border-border',
                row.position === 1 && 'bg-accent/[0.06] shadow-[inset_3px_0_0_var(--accent)]',
              )}
            >
              <td className="type-display py-3 pr-2 pl-3 text-lg text-fg-muted tabular">
                {String(row.position).padStart(2, '0')}
              </td>
              <td className="py-3 pr-3">
                <span className="flex items-center gap-2.5">
                  <ClubBadge club={row.player.club} size="sm" className="md:hidden" />
                  <span className="type-display text-lg text-fg">{row.player.nickname}</span>
                </span>
              </td>
              <td className="hidden py-3 pr-3 md:table-cell">
                <span className="flex items-center gap-2 text-fg-muted">
                  <ClubBadge club={row.player.club} size="sm" />
                  <span className="type-small">{row.player.club?.name ?? 'Sem clube'}</span>
                </span>
              </td>
              <td className="type-small py-3 text-right text-fg-muted tabular">{row.played}</td>
              <td className="type-small py-3 text-right text-fg-muted tabular">
                {signed(row.goalDiff)}
              </td>
              <td className="hidden py-3 pl-4 lg:table-cell">
                <FormDots form={row.form} />
              </td>
              <td className="type-display py-3 pr-3 text-right text-xl text-fg tabular">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
