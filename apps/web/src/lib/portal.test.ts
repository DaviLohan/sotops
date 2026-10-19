import { describe, expect, it } from 'vitest';
import {
  civilDay,
  dayLabel,
  formatTime,
  kickoffLabel,
  monthName,
  pad2,
  shortDate,
  weekdayShort,
} from './portal';

// 30/09/2026 16:00 em São Paulo.
const NOW = new Date('2026-09-30T19:00:00Z');

describe('datas do portal (fuso da federação)', () => {
  it('mostra o horário de São Paulo independentemente do fuso de quem renderiza', () => {
    expect(formatTime('2026-09-30T21:00:00Z')).toBe('18:00');
    expect(formatTime('2026-10-01T02:59:00Z')).toBe('23:59');
  });

  it('a data civil muda à meia-noite de São Paulo, não à do UTC', () => {
    expect(civilDay('2026-10-01T02:59:00Z')).toBe('2026-09-30');
    expect(civilDay('2026-10-01T03:00:00Z')).toBe('2026-10-01');
  });

  it('rotula hoje, amanhã, ontem e datas distantes', () => {
    expect(dayLabel('2026-09-30T23:30:00Z', NOW)).toBe('Hoje');
    expect(dayLabel('2026-10-01T23:30:00Z', NOW)).toBe('Amanhã');
    expect(dayLabel('2026-09-29T23:30:00Z', NOW)).toBe('Ontem');
    expect(dayLabel('2026-10-04T23:30:00Z', NOW)).toBe('04 OUT');
    expect(kickoffLabel('2026-09-30T23:30:00Z', NOW)).toBe('Hoje 20:30');
  });

  it('formata datas civis, meses e dias da semana', () => {
    expect(shortDate('2026-09-30')).toBe('30 SET');
    expect(monthName('2026-10-06')).toBe('OUTUBRO');
    expect(weekdayShort('2026-10-06')).toBe('TER');
    expect(pad2(8)).toBe('08');
  });
});
