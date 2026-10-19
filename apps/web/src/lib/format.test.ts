import { describe, expect, it } from 'vitest';
import { describeUserAgent, formatDayMonth, formatRelative } from './format';

const NOW = Date.parse('2026-09-30T12:00:00Z');

describe('formatRelative', () => {
  it('descreve intervalos recentes e antigos em português', () => {
    expect(formatRelative('2026-09-30T11:59:40Z', NOW)).toBe('agora mesmo');
    expect(formatRelative('2026-09-30T11:55:00Z', NOW)).toBe('há 5 minutos');
    expect(formatRelative('2026-09-30T09:00:00Z', NOW)).toBe('há 3 horas');
    expect(formatRelative('2026-09-29T12:00:00Z', NOW)).toBe('ontem');
    expect(formatRelative('2026-07-01T12:00:00Z', NOW)).toBe('há 3 meses');
  });
});

describe('formatDayMonth', () => {
  it('não desloca a data civil por causa do fuso', () => {
    expect(formatDayMonth('2026-09-30')).toBe('30/09');
    expect(formatDayMonth('2026-01-01')).toBe('01/01');
  });
});

describe('describeUserAgent', () => {
  it('resume navegador e sistema', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      ),
    ).toBe('Chrome no Windows');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari no iOS');
    expect(
      describeUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'),
    ).toBe('Firefox no Linux');
  });

  it('lida com ausência de informação', () => {
    expect(describeUserAgent(null)).toBe('Dispositivo desconhecido');
    expect(describeUserAgent('curl/8.5.0')).toBe('Navegador');
  });
});
