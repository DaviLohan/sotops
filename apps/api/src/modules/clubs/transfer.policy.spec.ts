import { describe, expect, it } from 'vitest';
import {
  assertCanRequestTransfer,
  assertManagesClub,
  initialTransferStatus,
} from './transfer.policy.js';

const club = { id: 'c1', status: 'ACTIVE' as const, managerUserId: 'gestor' };

describe('regras de transferência', () => {
  it('passa pelo responsável do clube quando há um', () => {
    expect(initialTransferStatus(club, 'jogador')).toBe('PENDING_CLUB');
  });

  it('vai direto à federação sem responsável ou quando o pedido é do próprio responsável', () => {
    expect(initialTransferStatus({ ...club, managerUserId: null }, 'jogador')).toBe(
      'PENDING_ADMIN',
    );
    expect(initialTransferStatus(club, 'gestor')).toBe('PENDING_ADMIN');
  });

  it('recusa clube inativo e o clube atual do jogador', () => {
    expect(() => assertCanRequestTransfer({ ...club, status: 'INACTIVE' }, null)).toThrow(
      /não está aceitando/,
    );
    expect(() => assertCanRequestTransfer(club, 'c1')).toThrow(/já faz parte/);
    expect(() => assertCanRequestTransfer(club, 'c2')).not.toThrow();
    expect(() => assertCanRequestTransfer(club, null)).not.toThrow();
  });

  it('só o responsável decide pelo clube', () => {
    expect(() => assertManagesClub(club, 'gestor')).not.toThrow();
    expect(() => assertManagesClub(club, 'outro')).toThrow();
    expect(() => assertManagesClub({ managerUserId: null }, 'outro')).toThrow();
  });
});
