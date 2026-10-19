import type { FormResult } from '@efed/shared';

export interface OfficialResult {
  homePlayerId: string;
  awayPlayerId: string;
  homeScore: number;
  awayScore: number;
  /** Instante usado para ordenar a sequência de resultados. */
  decidedAt: Date;
}

export interface PlayerTotals {
  playerId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: FormResult[];
}

export const POINTS = { win: 3, draw: 1, loss: 0 } as const;
const FORM_LENGTH = 5;

/**
 * Totais por jogador a partir de resultados oficiais. Jogadores sem partida entram zerados
 * quando informados em `playerIds`. Função pura: a mesma entrada sempre gera a mesma saída.
 */
export function accumulateTotals(
  results: readonly OfficialResult[],
  playerIds: readonly string[] = [],
): Map<string, PlayerTotals> {
  const totals = new Map<string, PlayerTotals>();
  const entry = (playerId: string): PlayerTotals => {
    let current = totals.get(playerId);
    if (!current) {
      current = {
        playerId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
        form: [],
      };
      totals.set(playerId, current);
    }
    return current;
  };
  for (const id of playerIds) {
    entry(id);
  }

  const ordered = [...results].sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime());
  for (const result of ordered) {
    const sides = [
      { id: result.homePlayerId, for: result.homeScore, against: result.awayScore },
      { id: result.awayPlayerId, for: result.awayScore, against: result.homeScore },
    ];
    for (const side of sides) {
      const row = entry(side.id);
      row.played += 1;
      row.goalsFor += side.for;
      row.goalsAgainst += side.against;
      row.goalDiff = row.goalsFor - row.goalsAgainst;
      if (side.for > side.against) {
        row.won += 1;
        row.points += POINTS.win;
        row.form.push('W');
      } else if (side.for === side.against) {
        row.drawn += 1;
        row.points += POINTS.draw;
        row.form.push('D');
      } else {
        row.lost += 1;
        row.points += POINTS.loss;
        row.form.push('L');
      }
    }
  }
  for (const row of totals.values()) {
    row.form = row.form.slice(-FORM_LENGTH);
  }
  return totals;
}

/**
 * Critérios de desempate desta etapa: pontos, vitórias, saldo, gols pró e, por último, ordem
 * alfabética do apelido (determinística). Confronto direto e critério administrativo entram com o
 * motor de classificação da Fase 5, onde passam a ser configuráveis por competição.
 */
export function rankTotals<T extends PlayerTotals>(
  rows: readonly T[],
  nicknameOf: (playerId: string) => string,
): T[] {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      nicknameOf(a.playerId).localeCompare(nicknameOf(b.playerId), 'pt-BR'),
  );
}

/** Aproveitamento de pontos em percentual inteiro (0–100). */
export function winRate(totals: Pick<PlayerTotals, 'played' | 'points'>): number {
  if (totals.played === 0) {
    return 0;
  }
  return Math.round((totals.points / (POINTS.win * totals.played)) * 100);
}
