import type { RoleKey, UserStatus } from '@efed/shared';
import type { BadgeTone } from '@/components/ui/badge';

export const STATUS_TONES: Record<UserStatus, BadgeTone> = {
  ACTIVE: 'success',
  PENDING_VERIFICATION: 'warning',
  SUSPENDED: 'danger',
  DEACTIVATED: 'neutral',
};

export const ROLE_TONES: Record<RoleKey, BadgeTone> = {
  SUPER_ADMIN: 'accent',
  ADMIN: 'brand',
  ORGANIZER: 'info',
  REFEREE: 'info',
  PLAYER: 'neutral',
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.register': 'Cadastro criado',
  'auth.email.verified': 'E-mail confirmado',
  'auth.login.succeeded': 'Login realizado',
  'auth.login.failed': 'Falha de login',
  'auth.mfa.challenge.succeeded': 'Segundo fator aceito',
  'auth.mfa.challenge.failed': 'Segundo fator recusado',
  'auth.logout': 'Logout',
  'auth.password.reset_requested': 'Redefinição de senha solicitada',
  'auth.password.reset': 'Senha redefinida',
  'auth.password.changed': 'Senha alterada',
  'auth.session.revoked': 'Sessão encerrada',
  'auth.sessions.revoked_others': 'Outras sessões encerradas',
  'auth.mfa.enabled': 'MFA ativado',
  'auth.mfa.disabled': 'MFA desativado',
  'auth.mfa.recovery_codes.regenerated': 'Códigos de recuperação regenerados',
  'account.profile.updated': 'Perfil atualizado',
  'admin.user.status_changed': 'Situação da conta alterada',
  'admin.user.roles_changed': 'Papéis alterados',
  'player.profile.created': 'Perfil de jogador criado',
  'player.profile.updated': 'Perfil de jogador atualizado',
  'player.avatar.updated': 'Avatar enviado',
  'player.avatar.removed': 'Avatar removido',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditActionTone(action: string): BadgeTone {
  if (action.endsWith('.failed')) {
    return 'danger';
  }
  if (action.startsWith('admin.')) {
    return 'accent';
  }
  if (action.includes('mfa') || action.includes('password')) {
    return 'info';
  }
  return 'neutral';
}

export const AUDIT_ACTION_GROUPS = [
  { value: '', label: 'Todos os eventos' },
  { value: 'auth.login', label: 'Logins' },
  { value: 'auth.login.failed', label: 'Falhas de login' },
  { value: 'auth.mfa', label: 'Verificação em duas etapas' },
  { value: 'auth.password', label: 'Senhas' },
  { value: 'auth.session', label: 'Sessões' },
  { value: 'auth.register', label: 'Cadastros' },
  { value: 'account.', label: 'Perfil' },
  { value: 'admin.', label: 'Ações administrativas' },
] as const;
