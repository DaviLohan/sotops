import type { TransferStatus } from '@efed/shared';
import { AppError } from '../../common/errors/app-error.js';

interface ClubRef {
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
  managerUserId: string | null;
}

/**
 * Regras de transferência (decisão D3): o jogador pede; o responsável do clube de destino aceita;
 * a federação aprova. Clube sem responsável — ou o próprio responsável pedindo para entrar —
 * vai direto para a federação.
 */
export function initialTransferStatus(target: ClubRef, requesterUserId: string): TransferStatus {
  return target.managerUserId && target.managerUserId !== requesterUserId
    ? 'PENDING_CLUB'
    : 'PENDING_ADMIN';
}

export function assertCanRequestTransfer(target: ClubRef, currentClubId: string | null): void {
  if (target.status !== 'ACTIVE') {
    throw new AppError('CONFLICT', { detail: 'Este clube não está aceitando jogadores.' });
  }
  if (target.id === currentClubId) {
    throw new AppError('CONFLICT', { detail: 'Você já faz parte deste clube.' });
  }
}

export function assertManagesClub(club: Pick<ClubRef, 'managerUserId'>, userId: string): void {
  if (club.managerUserId !== userId) {
    throw new AppError('FORBIDDEN');
  }
}
