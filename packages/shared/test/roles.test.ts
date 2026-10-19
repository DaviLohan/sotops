import { describe, expect, it } from 'vitest';
import {
  assignableRolesFor,
  hasPermission,
  PERMISSIONS,
  permissionsForRoles,
  requiresMfa,
} from '../src/roles.js';

describe('papéis e permissões', () => {
  it('concede todas as permissões ao superadministrador', () => {
    expect(permissionsForRoles(['SUPER_ADMIN'])).toEqual([...PERMISSIONS]);
  });

  it('não concede permissões administrativas ao jogador', () => {
    expect(permissionsForRoles(['PLAYER'])).toEqual([]);
    expect(hasPermission(['PLAYER'], 'admin.access')).toBe(false);
  });

  it('une as permissões de vários papéis sem duplicar', () => {
    const permissions = permissionsForRoles(['PLAYER', 'ADMIN', 'ADMIN']);
    expect(new Set(permissions).size).toBe(permissions.length);
    expect(permissions).toContain('users.manage_roles');
  });

  it('exige MFA apenas dos papéis administrativos', () => {
    expect(requiresMfa(['PLAYER'])).toBe(false);
    expect(requiresMfa(['ORGANIZER', 'REFEREE'])).toBe(false);
    expect(requiresMfa(['PLAYER', 'ADMIN'])).toBe(true);
    expect(requiresMfa(['SUPER_ADMIN'])).toBe(true);
  });

  it('impede que administradores concedam papéis administrativos', () => {
    expect(assignableRolesFor(['ADMIN'])).toEqual(['ORGANIZER', 'REFEREE', 'PLAYER']);
    expect(assignableRolesFor(['SUPER_ADMIN'])).toContain('SUPER_ADMIN');
    expect(assignableRolesFor(['PLAYER'])).toEqual([]);
  });
});
