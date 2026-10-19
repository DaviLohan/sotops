import { z } from 'zod';
import { paginationQuerySchema } from './admin.js';
import { upsertPlayerProfileSchema } from './players.js';
import { COMPETITION_STATUSES, GAME_PLATFORMS, publicClubSchema } from './public.js';

/** Contratos do painel de conteúdo, configurações e gestão de jogadores (Fase 2). */

const isoDateTime = z.iso.datetime();
const offsetDateTime = z.iso.datetime({ offset: true });

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .transform((value) => (value ? value : null));

// --- Configurações gerais ---------------------------------------------------------------

export const DEFAULT_FEDERATION_NAME = 'Federação eFootball 1x1';

export const federationSettingsSchema = z.object({
  federationName: z
    .string()
    .trim()
    .min(3, 'O nome deve ter pelo menos 3 caracteres.')
    .max(60, 'O nome deve ter no máximo 60 caracteres.'),
});
export type FederationSettings = z.infer<typeof federationSettingsSchema>;

// --- Notícias ---------------------------------------------------------------------------

export const NEWS_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED'] as const;
export type NewsStatus = (typeof NEWS_STATUSES)[number];
export const NEWS_STATUS_LABELS: Record<NewsStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  PUBLISHED: 'Publicada',
};

export const newsInputSchema = z
  .object({
    title: z.string().trim().min(5, 'O título deve ter pelo menos 5 caracteres.').max(140),
    summary: z.string().trim().min(10, 'O resumo deve ter pelo menos 10 caracteres.').max(300),
    body: z.string().trim().min(20, 'O texto deve ter pelo menos 20 caracteres.').max(20_000),
    category: z.string().trim().min(2, 'Informe a categoria.').max(40),
    status: z.enum(NEWS_STATUSES),
    /** Obrigatório para agendar; ao publicar sem data, vale o momento da publicação. */
    publishedAt: offsetDateTime.nullable(),
    isFeatured: z.boolean(),
  })
  .refine((news) => news.status !== 'SCHEDULED' || news.publishedAt !== null, {
    path: ['publishedAt'],
    message: 'Informe a data e a hora da publicação.',
  });
export type NewsInput = z.infer<typeof newsInputSchema>;

export const listNewsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(NEWS_STATUSES).optional(),
});
export type ListNewsQuery = z.infer<typeof listNewsQuerySchema>;

export const adminNewsDtoSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  category: z.string(),
  status: z.enum(NEWS_STATUSES),
  publishedAt: isoDateTime.nullable(),
  isFeatured: z.boolean(),
  /** Visível no portal agora (publicada, ou agendada com data já alcançada). */
  isLive: z.boolean(),
  author: z.object({ username: z.string(), displayName: z.string() }).nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type AdminNewsDto = z.infer<typeof adminNewsDtoSchema>;

// --- Banners do hero --------------------------------------------------------------------

/** Caminho interno (`/clubes`) ou endereço HTTPS. Nunca `javascript:` ou outro esquema. */
const safeHref = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) => /^\/(?!\/)[^\s\\]*$/.test(value) || /^https:\/\/[^\s]+$/.test(value),
    'Use um caminho interno (começando com /) ou um endereço https://.',
  );

export const bannerInputSchema = z
  .object({
    eyebrow: optionalText(60, 'O sobretítulo deve ter no máximo 60 caracteres.'),
    title: z.string().trim().min(3, 'O título deve ter pelo menos 3 caracteres.').max(120),
    subtitle: optionalText(200, 'O subtítulo deve ter no máximo 200 caracteres.'),
    ctaLabel: optionalText(40, 'O texto do botão deve ter no máximo 40 caracteres.'),
    ctaHref: safeHref.nullable().or(z.literal('').transform(() => null)),
    isActive: z.boolean(),
    startsAt: offsetDateTime.nullable(),
    endsAt: offsetDateTime.nullable(),
  })
  .refine((banner) => (banner.ctaLabel === null) === (banner.ctaHref === null), {
    path: ['ctaHref'],
    message: 'Informe o texto e o destino do botão, ou deixe os dois vazios.',
  })
  .refine(
    (banner) =>
      !banner.startsAt || !banner.endsAt || Date.parse(banner.endsAt) > Date.parse(banner.startsAt),
    { path: ['endsAt'], message: 'O fim deve ser depois do início.' },
  );
export type BannerInput = z.input<typeof bannerInputSchema>;
export type BannerData = z.output<typeof bannerInputSchema>;

export const adminBannerDtoSchema = z.object({
  id: z.uuid(),
  eyebrow: z.string().nullable(),
  title: z.string(),
  subtitle: z.string().nullable(),
  ctaLabel: z.string().nullable(),
  ctaHref: z.string().nullable(),
  isActive: z.boolean(),
  startsAt: isoDateTime.nullable(),
  endsAt: isoDateTime.nullable(),
  /** É o banner exibido na HOME neste momento. */
  isShowing: z.boolean(),
  createdAt: isoDateTime,
});
export type AdminBannerDto = z.infer<typeof adminBannerDtoSchema>;

// --- Competição em destaque -------------------------------------------------------------

export const featuredCompetitionSchema = z.object({ competitionId: z.uuid().nullable() });
export type FeaturedCompetitionInput = z.infer<typeof featuredCompetitionSchema>;

export const competitionOptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  seasonName: z.string(),
  status: z.enum(COMPETITION_STATUSES),
  isFeatured: z.boolean(),
});
export type CompetitionOption = z.infer<typeof competitionOptionSchema>;

// --- Gestão de jogadores ----------------------------------------------------------------

export const listPlayersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(60).optional(),
});
export type ListPlayersQuery = z.infer<typeof listPlayersQuerySchema>;

export const adminPlayerDtoSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  nickname: z.string(),
  efootballId: z.string().nullable(),
  platform: z.enum(GAME_PLATFORMS),
  country: z.string(),
  region: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  club: publicClubSchema.nullable(),
  user: z.object({
    id: z.uuid(),
    username: z.string(),
    displayName: z.string(),
    status: z.string(),
  }),
  createdAt: isoDateTime,
});
export type AdminPlayerDto = z.infer<typeof adminPlayerDtoSchema>;

/** Correção do perfil pela federação: os mesmos campos do jogador, com motivo na auditoria. */
export const adminUpdatePlayerSchema = upsertPlayerProfileSchema.extend({
  reason: z
    .string()
    .trim()
    .min(5, 'Descreva o motivo com pelo menos 5 caracteres.')
    .max(500, 'O motivo deve ter no máximo 500 caracteres.'),
});
export type AdminUpdatePlayerInput = z.input<typeof adminUpdatePlayerSchema>;
export type AdminUpdatePlayer = z.output<typeof adminUpdatePlayerSchema>;
