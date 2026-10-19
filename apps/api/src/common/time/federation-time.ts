/**
 * "Hoje", "amanhã" e "semana" seguem o fuso da federação, não o do servidor.
 * O Brasil não adota horário de verão desde 2019, então o deslocamento é fixo (UTC-03:00).
 */
export const FEDERATION_TIME_ZONE = 'America/Sao_Paulo';
const OFFSET_HOURS = -3;
const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: FEDERATION_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data civil (AAAA-MM-DD) do instante no fuso da federação. */
export function federationDate(instant: Date): string {
  return dateFormatter.format(instant);
}

/** Primeiro instante (UTC) do dia civil informado no fuso da federação. */
export function startOfFederationDay(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - OFFSET_HOURS * 60 * 60 * 1000);
}

export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * DAY_MS);
}

/** Intervalo [início, fim) de "hoje", "amanhã" ou dos próximos sete dias (incluindo hoje). */
export function scopeInterval(
  scope: 'today' | 'tomorrow' | 'week',
  now: Date,
): { from: Date; to: Date } {
  const todayStart = startOfFederationDay(federationDate(now));
  switch (scope) {
    case 'today':
      return { from: todayStart, to: addDays(todayStart, 1) };
    case 'tomorrow':
      return { from: addDays(todayStart, 1), to: addDays(todayStart, 2) };
    case 'week':
      return { from: todayStart, to: addDays(todayStart, 7) };
  }
}

/** Data `@db.Date` (meia-noite UTC) como AAAA-MM-DD. */
export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
