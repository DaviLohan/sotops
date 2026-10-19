import { z } from 'zod';
import { ROLE_KEYS } from '../roles.js';

export const USER_STATUSES = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PENDING_VERIFICATION: 'Aguardando verificação',
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  DEACTIVATED: 'Desativado',
};

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export const USER_SORT_FIELDS = ['createdAt', 'username', 'displayName', 'lastLoginAt'] as const;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(ROLE_KEYS).optional(),
  sortBy: z.enum(USER_SORT_FIELDS).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z
    .string()
    .trim()
    .min(5, 'Descreva o motivo com pelo menos 5 caracteres.')
    .max(500, 'O motivo deve ter no máximo 500 caracteres.'),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const setUserRolesSchema = z.object({
  roles: z
    .array(z.enum(ROLE_KEYS))
    .min(1, 'O usuário precisa de pelo menos um papel.')
    .refine((roles) => new Set(roles).size === roles.length, 'Papéis duplicados.'),
});
export type SetUserRolesInput = z.infer<typeof setUserRolesSchema>;

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(100).optional(),
  actorId: z.uuid().optional(),
  entityType: z.string().trim().max(50).optional(),
  entityId: z.string().trim().max(100).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
