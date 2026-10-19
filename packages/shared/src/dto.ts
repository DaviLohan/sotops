import { z } from 'zod';
import { PERMISSIONS, ROLE_KEYS } from './roles.js';
import { USER_STATUSES } from './schemas/admin.js';

/**
 * Formatos de resposta da API. Os schemas são a fonte única: geram os tipos usados
 * pelo frontend e a documentação OpenAPI. Datas trafegam como ISO 8601 em UTC.
 */

const isoDateTime = z.iso.datetime();
const roleKey = z.enum(ROLE_KEYS);
const userStatus = z.enum(USER_STATUSES);

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export const messageDtoSchema = z.object({ message: z.string() });
export type MessageDto = z.infer<typeof messageDtoSchema>;

export const accountDtoSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  username: z.string(),
  displayName: z.string(),
  status: userStatus,
  roles: z.array(roleKey),
  permissions: z.array(z.enum(PERMISSIONS)),
  mfaEnabled: z.boolean(),
  mfaEnrollmentRequired: z
    .boolean()
    .describe('O papel exige MFA e o usuário ainda não cadastrou o segundo fator.'),
  createdAt: isoDateTime,
});
export type AccountDto = z.infer<typeof accountDtoSchema>;

export const authStateDtoSchema = z.object({
  account: accountDtoSchema,
  csrfToken: z
    .string()
    .describe('Token anti-CSRF vinculado à sessão; enviar no cabeçalho X-CSRF-Token.'),
});
export type AuthStateDto = z.infer<typeof authStateDtoSchema>;

export const loginResultDtoSchema = z.discriminatedUnion('status', [
  authStateDtoSchema.extend({ status: z.literal('AUTHENTICATED') }),
  z.object({ status: z.literal('MFA_REQUIRED'), csrfToken: z.string() }),
]);
export type LoginResultDto = z.infer<typeof loginResultDtoSchema>;

export const sessionDtoSchema = z.object({
  id: z.uuid(),
  current: z.boolean(),
  createdAt: isoDateTime,
  lastSeenAt: isoDateTime,
  expiresAt: isoDateTime,
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
});
export type SessionDto = z.infer<typeof sessionDtoSchema>;

export const mfaEnrollmentDtoSchema = z.object({
  secret: z.string().describe('Segredo TOTP em Base32, para digitação manual.'),
  otpauthUri: z.string().describe('URI otpauth:// para gerar o QR code.'),
});
export type MfaEnrollmentDto = z.infer<typeof mfaEnrollmentDtoSchema>;

export const mfaRecoveryCodesDtoSchema = z.object({
  recoveryCodes: z.array(z.string()).describe('Exibidos uma única vez.'),
});
export type MfaRecoveryCodesDto = z.infer<typeof mfaRecoveryCodesDtoSchema>;

export const mfaStatusDtoSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean(),
  enabledAt: isoDateTime.nullable(),
  recoveryCodesRemaining: z.number().int(),
});
export type MfaStatusDto = z.infer<typeof mfaStatusDtoSchema>;

export const adminUserDtoSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  username: z.string(),
  displayName: z.string(),
  status: userStatus,
  roles: z.array(roleKey),
  mfaEnabled: z.boolean(),
  emailVerifiedAt: isoDateTime.nullable(),
  lastLoginAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});
export type AdminUserDto = z.infer<typeof adminUserDtoSchema>;

export const auditLogDtoSchema = z.object({
  id: z.uuid(),
  occurredAt: isoDateTime,
  action: z.string(),
  actor: z.object({ id: z.uuid(), username: z.string(), displayName: z.string() }).nullable(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  ipAddress: z.string().nullable(),
  requestId: z.string().nullable(),
});
export type AuditLogDto = z.infer<typeof auditLogDtoSchema>;

export const dashboardSummaryDtoSchema = z.object({
  users: z.object({
    total: z.number().int(),
    byStatus: z.record(userStatus, z.number().int()),
    registeredLast7Days: z.number().int(),
    registeredPrevious7Days: z.number().int(),
  }),
  roles: z.record(roleKey, z.number().int()),
  security: z.object({
    activeSessions: z.number().int(),
    adminsWithoutMfa: z.number().int(),
    failedLoginsLast24h: z.number().int(),
  }),
  registrationsByDay: z
    .array(z.object({ date: z.iso.date(), count: z.number().int() }))
    .describe('Cadastros por dia (UTC) nos últimos 14 dias, do mais antigo ao mais recente.'),
  generatedAt: isoDateTime,
});
export type DashboardSummaryDto = z.infer<typeof dashboardSummaryDtoSchema>;

export const healthDtoSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.record(z.string(), z.enum(['up', 'down'])),
  version: z.string(),
  uptimeSeconds: z.number(),
});
export type HealthDto = z.infer<typeof healthDtoSchema>;
