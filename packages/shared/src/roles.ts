/**
 * Papéis e permissões da federação.
 *
 * Os papéis são dados de referência persistidos na tabela `roles` (inseridos por migration).
 * O mapeamento papel → permissões vive no código porque muda junto com as funcionalidades
 * e precisa ser revisado em code review; a verificação acontece sempre no backend.
 */

export const ROLE_KEYS = ['SUPER_ADMIN', 'ADMIN', 'ORGANIZER', 'REFEREE', 'PLAYER'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  SUPER_ADMIN: 'Superadministrador',
  ADMIN: 'Administrador',
  ORGANIZER: 'Organizador',
  REFEREE: 'Árbitro',
  PLAYER: 'Jogador',
};

export const PERMISSIONS = [
  'admin.access',
  'dashboard.read',
  'users.read',
  'users.manage_status',
  'users.manage_roles',
  'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ADMIN_PERMISSIONS: readonly Permission[] = [
  'admin.access',
  'dashboard.read',
  'users.read',
  'users.manage_status',
  'users.manage_roles',
  'audit.read',
];

/**
 * ORGANIZER e REFEREE já existem como papéis atribuíveis, mas só recebem permissões
 * quando os módulos que administram forem implementados (Fases 3 e 5).
 */
export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  ORGANIZER: [],
  REFEREE: [],
  PLAYER: [],
};

/** Papéis que só operam com autenticação multifator ativa. */
export const MFA_REQUIRED_ROLES: readonly RoleKey[] = ['SUPER_ADMIN', 'ADMIN'];

/** Papéis que cada papel administrativo pode conceder ou revogar. */
export const ASSIGNABLE_ROLES: Record<RoleKey, readonly RoleKey[]> = {
  SUPER_ADMIN: ROLE_KEYS,
  ADMIN: ['ORGANIZER', 'REFEREE', 'PLAYER'],
  ORGANIZER: [],
  REFEREE: [],
  PLAYER: [],
};

export function permissionsForRoles(roles: readonly RoleKey[]): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      granted.add(permission);
    }
  }
  return PERMISSIONS.filter((permission) => granted.has(permission));
}

export function hasPermission(roles: readonly RoleKey[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export function requiresMfa(roles: readonly RoleKey[]): boolean {
  return roles.some((role) => MFA_REQUIRED_ROLES.includes(role));
}

export function assignableRolesFor(actorRoles: readonly RoleKey[]): RoleKey[] {
  const assignable = new Set<RoleKey>();
  for (const role of actorRoles) {
    for (const target of ASSIGNABLE_ROLES[role]) {
      assignable.add(target);
    }
  }
  return ROLE_KEYS.filter((role) => assignable.has(role));
}
