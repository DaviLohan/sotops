import { COUNTRY_CODES } from '@efed/shared';

const names = new Intl.DisplayNames(['pt-BR'], { type: 'region' });

export function countryName(code: string): string {
  return names.of(code) ?? code;
}

/** Países em ordem alfabética do nome em português, para listas de seleção. */
export const COUNTRY_OPTIONS = COUNTRY_CODES.map((code) => ({
  code,
  name: countryName(code),
})).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
