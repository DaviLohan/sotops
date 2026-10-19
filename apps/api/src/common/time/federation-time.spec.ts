import { describe, expect, it } from 'vitest';
import { federationDate, scopeInterval, startOfFederationDay } from './federation-time.js';

describe('tempo da federação (America/Sao_Paulo)', () => {
  it('usa a data civil de São Paulo, não a do UTC', () => {
    // 01:30 UTC de 1º/out ainda é 22:30 de 30/set em São Paulo.
    expect(federationDate(new Date('2026-10-01T01:30:00Z'))).toBe('2026-09-30');
    expect(federationDate(new Date('2026-10-01T03:00:00Z'))).toBe('2026-10-01');
  });

  it('o dia começa às 03:00 UTC', () => {
    expect(startOfFederationDay('2026-09-30').toISOString()).toBe('2026-09-30T03:00:00.000Z');
  });

  it('calcula hoje, amanhã e semana como intervalos contíguos', () => {
    const now = new Date('2026-10-01T01:30:00Z'); // 30/set, 22:30 em São Paulo
    const today = scopeInterval('today', now);
    const tomorrow = scopeInterval('tomorrow', now);
    const week = scopeInterval('week', now);
    expect(today.from.toISOString()).toBe('2026-09-30T03:00:00.000Z');
    expect(today.to.toISOString()).toBe(tomorrow.from.toISOString());
    expect(tomorrow.to.toISOString()).toBe('2026-10-02T03:00:00.000Z');
    expect(week.from.toISOString()).toBe(today.from.toISOString());
    expect(week.to.toISOString()).toBe('2026-10-07T03:00:00.000Z');
  });
});
