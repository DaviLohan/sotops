import type { CalendarEvent } from '@efed/shared';
import { cn } from '@/lib/cn';
import { monthName, weekdayShort } from '@/lib/portal';
import { SectionHeader } from '../sport/section-header';

const KIND_STYLE: Record<CalendarEvent['kind'], string> = {
  ROUND: 'border-fg-faint text-fg-muted',
  REGISTRATION_CLOSES: 'border-accent text-accent',
  STARTS: 'border-brand-hover text-link',
  ENDS: 'border-success text-success',
};

/** Calendário competitivo: os próximos marcos, agrupados por mês. */
export function CalendarStrip({ events }: { events: CalendarEvent[] }) {
  const months: { name: string; events: CalendarEvent[] }[] = [];
  for (const event of events) {
    const name = monthName(event.date);
    const last = months.at(-1);
    if (last && last.name === name) {
      last.events.push(event);
    } else {
      months.push({ name, events: [event] });
    }
  }
  return (
    <section
      aria-labelledby="calendario"
      className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <SectionHeader
        id="calendario"
        eyebrow="Próximos marcos"
        title="Calendário competitivo"
        description="Rodadas, inscrições, inícios de campeonato e finais."
      />
      {months.length === 0 ? (
        <p className="type-body mt-8 border border-dashed border-border-strong p-6 text-fg-muted">
          Nenhum marco marcado para os próximos meses.
        </p>
      ) : (
        <div className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {months.map((month) => (
            <div key={month.name}>
              <h3 className="type-display type-h3 border-b border-border-strong pb-3 text-fg">
                {month.name}
              </h3>
              <ol>
                {month.events.map((event) => (
                  <li
                    key={`${event.date}-${event.kind}-${event.competition.slug}`}
                    className="flex gap-4 border-b border-border py-3.5"
                  >
                    <div className="w-11 shrink-0 text-center">
                      <p className="type-display text-2xl text-fg tabular">
                        {event.date.slice(8, 10)}
                      </p>
                      <p className="type-caption text-fg-subtle">{weekdayShort(event.date)}</p>
                    </div>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'type-small inline-block border-l-2 pl-2 font-semibold',
                          KIND_STYLE[event.kind],
                        )}
                      >
                        {event.title}
                      </p>
                      <p className="type-small mt-0.5 truncate text-fg-muted">
                        {event.competition.name}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
