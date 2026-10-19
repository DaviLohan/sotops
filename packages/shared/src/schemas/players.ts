import { z } from 'zod';
import { isCountryCode } from '../countries.js';
import { GAME_PLATFORMS, publicClubSchema } from './public.js';

/** Contratos do perfil esportivo do jogador (Fase 2). */

export const GAME_PLATFORM_LABELS: Record<(typeof GAME_PLATFORMS)[number], string> = {
  PLAYSTATION: 'PlayStation',
  XBOX: 'Xbox',
  PC: 'PC',
  MOBILE: 'Celular',
};

export const nicknameSchema = z
  .string()
  .trim()
  .min(3, 'O apelido deve ter pelo menos 3 caracteres.')
  .max(24, 'O apelido deve ter no máximo 24 caracteres.')
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u, 'Use letras, números, espaço, ponto, hífen ou _.');

/**
 * ID do usuário no eFootball (decisão D2). O formato exato varia por plataforma, então a regra é
 * deliberadamente ampla; a unicidade por plataforma é garantida pelo banco.
 */
export const efootballIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]{3,32}$/, 'Use de 3 a 32 letras, números, ponto, hífen ou _.');

export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isCountryCode, 'Selecione um país da lista.');

export const upsertPlayerProfileSchema = z.object({
  nickname: nicknameSchema,
  efootballId: efootballIdSchema,
  platform: z.enum(GAME_PLATFORMS, 'Selecione a plataforma.'),
  country: countryCodeSchema,
  region: z
    .string()
    .trim()
    .max(60, 'A região deve ter no máximo 60 caracteres.')
    .nullable()
    .transform((value) => (value ? value : null)),
});
export type UpsertPlayerProfileInput = z.input<typeof upsertPlayerProfileSchema>;
export type UpsertPlayerProfile = z.output<typeof upsertPlayerProfileSchema>;

export const myPlayerProfileDtoSchema = z.object({
  id: z.uuid(),
  slug: z.string().describe('Identificador da página pública: /jogadores/{slug}.'),
  nickname: z.string(),
  efootballId: z.string().nullable(),
  platform: z.enum(GAME_PLATFORMS),
  country: z.string(),
  region: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  club: publicClubSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type MyPlayerProfileDto = z.infer<typeof myPlayerProfileDtoSchema>;
