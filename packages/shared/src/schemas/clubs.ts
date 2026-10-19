import { z } from 'zod';
import { paginationQuerySchema } from './admin.js';
import { publicClubSchema } from './public.js';

/** Contratos de clubes, vínculos e transferências (Fase 2, decisão D3). */

const isoDate = z.iso.date();
const isoDateTime = z.iso.datetime();

export const CLUB_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type ClubStatus = (typeof CLUB_STATUSES)[number];
export const CLUB_STATUS_LABELS: Record<ClubStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

export const TRANSFER_STATUSES = [
  'PENDING_CLUB',
  'PENDING_ADMIN',
  'APPROVED',
  'REJECTED',
  'CANCELED',
] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];
export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  PENDING_CLUB: 'Aguardando o clube',
  PENDING_ADMIN: 'Aguardando a federação',
  APPROVED: 'Aprovada',
  REJECTED: 'Recusada',
  CANCELED: 'Cancelada',
};
export const OPEN_TRANSFER_STATUSES = ['PENDING_CLUB', 'PENDING_ADMIN'] as const;

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use uma cor no formato #RRGGBB.')
  .transform((value) => value.toUpperCase());

const reason = z
  .string()
  .trim()
  .min(5, 'Descreva o motivo com pelo menos 5 caracteres.')
  .max(500, 'O motivo deve ter no máximo 500 caracteres.');

// --- Administração de clubes --------------------------------------------------------------

export const clubInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'O nome deve ter pelo menos 3 caracteres.')
    .max(60, 'O nome deve ter no máximo 60 caracteres.'),
  tag: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,4}$/, 'A sigla tem de 2 a 4 letras ou números.'),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  foundedOn: isoDate.nullable(),
  status: z.enum(CLUB_STATUSES),
  /** Nome de usuário do responsável (aceita pedidos de entrada); nulo = sem responsável. */
  managerUsername: z
    .string()
    .trim()
    .toLowerCase()
    .nullable()
    .transform((value) => (value ? value : null)),
});
export type ClubInput = z.input<typeof clubInputSchema>;
export type ClubData = z.output<typeof clubInputSchema>;

export const listClubsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(60).optional(),
  status: z.enum(CLUB_STATUSES).optional(),
});
export type ListClubsQuery = z.infer<typeof listClubsQuerySchema>;

export const userRefSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  displayName: z.string(),
});
export type UserRef = z.infer<typeof userRefSchema>;

export const adminClubDtoSchema = publicClubSchema.extend({
  id: z.uuid(),
  status: z.enum(CLUB_STATUSES),
  foundedOn: isoDate.nullable(),
  manager: userRefSchema.nullable(),
  members: z.number().int().describe('Jogadores com vínculo ativo.'),
  createdAt: isoDateTime,
});
export type AdminClubDto = z.infer<typeof adminClubDtoSchema>;

// --- Vínculos e transferências ------------------------------------------------------------

export const membershipDtoSchema = z.object({
  club: publicClubSchema,
  startedOn: isoDate,
  /** Nulo enquanto o vínculo está ativo. */
  endedOn: isoDate.nullable(),
});
export type MembershipDto = z.infer<typeof membershipDtoSchema>;

export const transferPlayerSchema = z.object({
  slug: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
});

export const transferDtoSchema = z.object({
  id: z.uuid(),
  player: transferPlayerSchema,
  fromClub: publicClubSchema.nullable(),
  toClub: publicClubSchema,
  status: z.enum(TRANSFER_STATUSES),
  note: z.string().nullable(),
  decisionReason: z.string().nullable(),
  createdAt: isoDateTime,
  clubDecidedAt: isoDateTime.nullable(),
  decidedAt: isoDateTime.nullable(),
});
export type TransferDto = z.infer<typeof transferDtoSchema>;

export const myClubDtoSchema = z.object({
  current: membershipDtoSchema.nullable(),
  history: z
    .array(membershipDtoSchema)
    .describe('Vínculos encerrados, do mais recente ao mais antigo.'),
  openTransfer: transferDtoSchema.nullable(),
  /** Pedidos recentes já decididos, para o jogador acompanhar o resultado. */
  recentTransfers: z.array(transferDtoSchema),
});
export type MyClubDto = z.infer<typeof myClubDtoSchema>;

export const requestTransferSchema = z.object({
  toClubSlug: z.string().trim().min(1, 'Selecione o clube.').max(60),
  note: z
    .string()
    .trim()
    .max(300, 'A mensagem deve ter no máximo 300 caracteres.')
    .nullable()
    .transform((value) => (value ? value : null)),
});
export type RequestTransferInput = z.input<typeof requestTransferSchema>;
export type RequestTransfer = z.output<typeof requestTransferSchema>;

export const rejectTransferSchema = z.object({ reason });
export type RejectTransferInput = z.infer<typeof rejectTransferSchema>;

export const listTransfersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(TRANSFER_STATUSES).default('PENDING_ADMIN'),
});
export type ListTransfersQuery = z.infer<typeof listTransfersQuerySchema>;
