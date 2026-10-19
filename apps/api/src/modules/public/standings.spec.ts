import { describe, expect, it } from 'vitest';
import { accumulateTotals, rankTotals, winRate, type OfficialResult } from './standings.js';

const at = (day: number): Date => new Date(Date.UTC(2026, 8, day));
const result = (
  home: string,
  homeScore: number,
  awayScore: number,
  away: string,
  day: number,
): OfficialResult => ({
  homePlayerId: home,
  awayPlayerId: away,
  homeScore,
  awayScore,
  decidedAt: at(day),
});

describe('accumulateTotals', () => {
  it('pontua 3-1-0 e soma gols dos dois lados', () => {
    const totals = accumulateTotals([result('a', 3, 1, 'b', 1), result('b', 2, 2, 'c', 2)]);
    expect(totals.get('a')).toMatchObject({ played: 1, won: 1, points: 3, goalDiff: 2 });
    expect(totals.get('b')).toMatchObject({
      played: 2,
      drawn: 1,
      lost: 1,
      points: 1,
      goalDiff: -2,
    });
    expect(totals.get('c')).toMatchObject({ played: 1, drawn: 1, points: 1, goalDiff: 0 });
  });

  it('inclui jogadores sem partida com tudo zerado', () => {
    const totals = accumulateTotals([], ['x']);
    expect(totals.get('x')).toMatchObject({ played: 0, points: 0, form: [] });
  });

  it('mantém só os cinco últimos resultados, em ordem cronológica', () => {
    // Dias 1 a 6: empate no dia 2 e vitórias nos demais. Chegam fora de ordem.
    const games = [1, 2, 3, 4, 5, 6].map((day) => result('a', day === 2 ? 0 : 1, 0, 'b', day));
    const totals = accumulateTotals([...games].reverse());
    expect(totals.get('a')?.form).toEqual(['D', 'W', 'W', 'W', 'W']);
  });

  it('o resultado não depende da ordem em que as partidas chegam', () => {
    const games = [result('a', 1, 0, 'b', 1), result('a', 0, 2, 'c', 2), result('b', 1, 1, 'c', 3)];
    const forward = accumulateTotals(games).get('a');
    const backward = accumulateTotals([...games].reverse()).get('a');
    expect(backward).toEqual(forward);
  });
});

describe('rankTotals', () => {
  const nicknames: Record<string, string> = { a: 'Alfa', b: 'Bravo', c: 'Charlie' };
  const nick = (id: string): string => nicknames[id] ?? id;

  it('desempata por vitórias, saldo, gols pró e, por fim, apelido', () => {
    const base = { played: 4, drawn: 0, lost: 0, goalsAgainst: 0, form: [] };
    const rows = rankTotals(
      [
        { ...base, playerId: 'c', won: 2, points: 7, goalDiff: 3, goalsFor: 5 },
        { ...base, playerId: 'b', won: 2, points: 7, goalDiff: 3, goalsFor: 5 },
        { ...base, playerId: 'a', won: 3, points: 7, goalDiff: 1, goalsFor: 4 },
      ],
      nick,
    );
    expect(rows.map((row) => row.playerId)).toEqual(['a', 'b', 'c']);
  });
});

describe('winRate', () => {
  it('é 0 sem partidas e arredonda o percentual de pontos disputados', () => {
    expect(winRate({ played: 0, points: 0 })).toBe(0);
    expect(winRate({ played: 8, points: 19 })).toBe(79);
    expect(winRate({ played: 3, points: 9 })).toBe(100);
  });
});
