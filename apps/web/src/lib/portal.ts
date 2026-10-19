import type { FormResult, MatchStatus } from '@efed/shared';

/**
 * Formatação de datas do portal. Sempre no fuso da federação, para que servidor e navegador
 * (e quem acessa de outro país) vejam o mesmo horário e a hidratação nunca divirja.
 */
export const FEDERATION_TIME_ZONE = 'America/Sao_Paulo';
const LOCALE = 'pt-BR';

const timeFormat = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: FEDERATION_TIME_ZONE,
});
const civilDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: FEDERATION_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const shortMonthFormat = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' });
const longMonthFormat = new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' });
const weekdayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' });

const DAY_MS = 24 * 60 * 60 * 1000;

function cleanMonth(label: string): string {
  return label.replace('.', '').toUpperCase();
}

/** "18:00", no fuso da federação. */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** Data civil AAAA-MM-DD do instante, no fuso da federação. */
export function civilDay(iso: string | Date): string {
  return civilDayFormat.format(typeof iso === 'string' ? new Date(iso) : iso);
}

function utcMidnight(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** "30 SET" para uma data civil AAAA-MM-DD. */
export function shortDate(date: string): string {
  const day = date.slice(8, 10);
  return `${day} ${cleanMonth(shortMonthFormat.format(utcMidnight(date)))}`;
}

/** "SETEMBRO" para uma data civil AAAA-MM-DD. */
export function monthName(date: string): string {
  return longMonthFormat.format(utcMidnight(date)).toUpperCase();
}

/** "SEG" para uma data civil AAAA-MM-DD. */
export function weekdayShort(date: string): string {
  return weekdayFormat.format(utcMidnight(date)).replace('.', '').toUpperCase();
}

/** Diferença em dias civis (data − hoje), no fuso da federação. */
export function daysFromToday(iso: string, now: Date): number {
  return Math.round(
    (utcMidnight(civilDay(iso)).getTime() - utcMidnight(civilDay(now)).getTime()) / DAY_MS,
  );
}

/** "Hoje", "Amanhã", "Ontem" ou "02 OUT". */
export function dayLabel(iso: string, now: Date): string {
  const diff = daysFromToday(iso, now);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  return shortDate(civilDay(iso));
}

/** "Hoje 18:00", "Amanhã 20:30", "02 OUT 20:30". */
export function kickoffLabel(iso: string, now: Date): string {
  return `${dayLabel(iso, now)} ${formatTime(iso)}`;
}

export const FORM_LABELS: Record<FormResult, string> = {
  W: 'vitória',
  D: 'empate',
  L: 'derrota',
};

/** Letra exibida na sequência de resultados (V, E, D). */
export const FORM_LETTERS: Record<FormResult, string> = { W: 'V', D: 'E', L: 'D' };

/** Tom de status de uma partida que ainda não é oficial. */
export function matchStatusTone(status: MatchStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'AVAILABLE':
      return 'success';
    case 'AWAITING_RESULT':
    case 'AWAITING_CONFIRMATION':
    case 'UNDER_REVIEW':
      return 'warning';
    case 'POSTPONED':
    case 'CANCELED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** "08" — números de rodada sempre com dois dígitos. */
export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Termo de busca vindo da URL: texto simples, aparado e limitado ao que a API aceita. */
export function searchParam(value: string | string[] | undefined): string | undefined {
  const text = (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 60);
  return text ? text : undefined;
}

/** Página vinda da URL (`?pagina=`); qualquer valor inválido vira a primeira. */
export function pageParam(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

const civilDateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeZone: 'UTC' });
const monthYearFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
  timeZone: FEDERATION_TIME_ZONE,
});

/** "01/05/2024" para uma data civil AAAA-MM-DD, sem deslocamento de fuso. */
export function civilDate(date: string): string {
  return civilDateFormat.format(utcMidnight(date));
}

/** "setembro de 2026" para um instante, no fuso da federação. */
export function monthYear(iso: string): string {
  return monthYearFormat.format(new Date(iso));
}
