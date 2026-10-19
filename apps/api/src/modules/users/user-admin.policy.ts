import { assignableRolesFor, type RoleKey } from '@efed/shared';
import { AppError } from '../../common/errors/app-error.js';

interface Actor {
  id: string;
  roles: RoleKey[];
}

interface Target {
  id: string;
  roles: RoleKey[];
}

/**
 * Políticas por recurso da administração de usuários. São funções puras para que cada
 * regra seja testável sem banco de dados.
 *
 * Regra geral: um ator só administra contas cujos papéis ele mesmo poderia conceder.
 * Assim, um ADMIN não altera outro ADMIN nem um SUPER_ADMIN.
 */
export function assertCanManageAccount(actor: Actor, target: Target): void {
  if (actor.id === target.id) {
    throw new AppError('FORBIDDEN', {
      detail: 'Não é possível alterar a própria conta por esta operação.',
    });
  }
  const assignable = assignableRolesFor(actor.roles);
  if (target.roles.some((role) => !assignable.includes(role))) {
    throw new AppError('FORBIDDEN', {
      detail: 'Você não tem permissão para administrar uma conta com esse nível de acesso.',
    });
  }
}

export interface RoleChange {
  added: RoleKey[];
  removed: RoleKey[];
}

export function diffRoles(current: RoleKey[], next: RoleKey[]): RoleChange {
  return {
    added: next.filter((role) => !current.includes(role)),
    removed: current.filter((role) => !next.includes(role)),
  };
}

export function assertCanAssignRoles(actor: Actor, change: RoleChange): void {
  const assignable = assignableRolesFor(actor.roles);
  const forbidden = [...change.added, ...change.removed].filter(
    (role) => !assignable.includes(role),
  );
  if (forbidden.length > 0) {
    throw new AppError('FORBIDDEN', {
      detail: `Você não pode conceder ou revogar: ${forbidden.join(', ')}.`,
    });
  }
}
