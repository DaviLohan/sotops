import type { RoleKey } from '@efed/shared';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../common/errors/app-error.js';
import { assertCanAssignRoles, assertCanManageAccount, diffRoles } from './user-admin.policy.js';

const actor = (roles: RoleKey[], id = 'ator') => ({ id, roles });
const target = (roles: RoleKey[], id = 'alvo') => ({ id, roles });

describe('políticas de administração de usuários', () => {
  it('nunca permite administrar a própria conta', () => {
    expect(() =>
      assertCanManageAccount(actor(['SUPER_ADMIN']), target(['PLAYER'], 'ator')),
    ).toThrow(AppError);
  });

  it('permite ao administrador gerenciar contas operacionais', () => {
    expect(() =>
      assertCanManageAccount(actor(['ADMIN']), target(['PLAYER', 'REFEREE', 'ORGANIZER'])),
    ).not.toThrow();
  });

  it('impede o administrador de gerenciar contas administrativas', () => {
    expect(() => assertCanManageAccount(actor(['ADMIN']), target(['ADMIN']))).toThrow(AppError);
    expect(() =>
      assertCanManageAccount(actor(['ADMIN']), target(['PLAYER', 'SUPER_ADMIN'])),
    ).toThrow(AppError);
  });

  it('permite ao superadministrador gerenciar qualquer outra conta', () => {
    expect(() =>
      assertCanManageAccount(actor(['SUPER_ADMIN']), target(['SUPER_ADMIN'])),
    ).not.toThrow();
  });

  it('nega tudo a quem não tem papel administrativo', () => {
    expect(() => assertCanManageAccount(actor(['PLAYER']), target(['PLAYER']))).toThrow(AppError);
    expect(() =>
      assertCanManageAccount(actor(['ORGANIZER', 'REFEREE']), target(['PLAYER'])),
    ).toThrow(AppError);
  });

  it('calcula papéis concedidos e revogados', () => {
    expect(diffRoles(['PLAYER', 'REFEREE'], ['PLAYER', 'ORGANIZER'])).toEqual({
      added: ['ORGANIZER'],
      removed: ['REFEREE'],
    });
    expect(diffRoles(['PLAYER'], ['PLAYER'])).toEqual({ added: [], removed: [] });
  });

  it('valida cada papel concedido ou revogado contra o que o ator pode atribuir', () => {
    expect(() =>
      assertCanAssignRoles(actor(['ADMIN']), { added: ['REFEREE'], removed: ['PLAYER'] }),
    ).not.toThrow();
    expect(() => assertCanAssignRoles(actor(['ADMIN']), { added: ['ADMIN'], removed: [] })).toThrow(
      AppError,
    );
    expect(() =>
      assertCanAssignRoles(actor(['ADMIN']), { added: [], removed: ['SUPER_ADMIN'] }),
    ).toThrow(AppError);
    expect(() =>
      assertCanAssignRoles(actor(['SUPER_ADMIN']), { added: ['SUPER_ADMIN'], removed: ['ADMIN'] }),
    ).not.toThrow();
  });
});
