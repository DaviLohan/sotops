const LOCALE = 'pt-BR';

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' });
const dayMonthFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});
const numberFormat = new Intl.NumberFormat(LOCALE);
const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** Dia/mês de uma data civil `AAAA-MM-DD`, sem deslocamento de fuso. */
export function formatDayMonth(isoDate: string): string {
  return dayMonthFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "há 5 minutos", "ontem"… `now` é injetável para testes. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) {
      return relativeFormat.format(Math.trunc(seconds / size), unit);
    }
  }
  return 'agora mesmo';
}

/** Resumo legível do navegador e do sistema a partir do User-Agent. */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) {
    return 'Dispositivo desconhecido';
  }
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Navegador';
  const system = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return system ? `${browser} no ${system}` : browser;
}
