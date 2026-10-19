import { z } from 'zod';

/**
 * Contratos do portal público (sem sessão). Nada aqui expõe e-mail, conta ou dado pessoal
 * além do apelido competitivo. Classificação, ranking e estatísticas são calculados a partir
 * de partidas homologadas.
 */

const isoDateTime = z.iso.datetime();
const isoDate = z.iso.date();

export const MATCH_STATUSES = [
  'SCHEDULED',
  'AVAILABLE',
  'AWAITING_RESULT',
  'AWAITING_CONFIRMATION',
  'UNDER_REVIEW',
  'HOMOLOGATED',
  'POSTPONED',
  'CANCELED',
  'WALKOVER',
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  SCHEDULED: 'Agendada',
  AVAILABLE: 'Liberada',
  AWAITING_RESULT: 'Aguardando resultado',
  AWAITING_CONFIRMATION: 'Aguardando confirmação',
  UNDER_REVIEW: 'Em análise',
  HOMOLOGATED: 'Final',
  POSTPONED: 'Adiada',
  CANCELED: 'Cancelada',
  WALKOVER: 'W.O.',
};

/** Estados em que o placar é oficial e pode ser exibido. */
export const OFFICIAL_MATCH_STATUSES = ['HOMOLOGATED', 'WALKOVER'] as const;
export function isOfficialMatchStatus(status: MatchStatus): boolean {
  return (OFFICIAL_MATCH_STATUSES as readonly string[]).includes(status);
}

/** Estados de uma partida que ainda vai (ou está por) acontecer. */
export const PENDING_MATCH_STATUSES = [
  'SCHEDULED',
  'AVAILABLE',
  'AWAITING_RESULT',
  'AWAITING_CONFIRMATION',
  'UNDER_REVIEW',
] as const satisfies readonly MatchStatus[];

export const COMPETITION_FORMATS = ['LEAGUE', 'GROUPS', 'KNOCKOUT'] as const;
export const COMPETITION_FORMAT_LABELS: Record<(typeof COMPETITION_FORMATS)[number], string> = {
  LEAGUE: 'Pontos corridos',
  GROUPS: 'Fase de grupos',
  KNOCKOUT: 'Mata-mata',
};

export const COMPETITION_STATUSES = [
  'DRAFT',
  'REGISTRATION_OPEN',
  'IN_PROGRESS',
  'FINISHED',
] as const;
export const COMPETITION_STATUS_LABELS: Record<(typeof COMPETITION_STATUSES)[number], string> = {
  DRAFT: 'Em preparação',
  REGISTRATION_OPEN: 'Inscrições abertas',
  IN_PROGRESS: 'Em andamento',
  FINISHED: 'Encerrada',
};

export const GAME_PLATFORMS = ['PLAYSTATION', 'XBOX', 'PC', 'MOBILE'] as const;

export const publicClubSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tag: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
});
export type PublicClub = z.infer<typeof publicClubSchema>;

export const publicPlayerSchema = z.object({
  slug: z.string(),
  nickname: z.string(),
  country: z.string(),
  club: publicClubSchema.nullable(),
});
export type PublicPlayer = z.infer<typeof publicPlayerSchema>;

export const publicMatchSchema = z.object({
  id: z.uuid(),
  competition: z.object({ slug: z.string(), name: z.string() }),
  round: z.number().int(),
  scheduledAt: isoDateTime,
  status: z.enum(MATCH_STATUSES),
  home: publicPlayerSchema,
  away: publicPlayerSchema,
  /** Nulos enquanto o resultado não é oficial. */
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
});
export type PublicMatch = z.infer<typeof publicMatchSchema>;

export const formResultSchema = z.enum(['W', 'D', 'L']);
export type FormResult = z.infer<typeof formResultSchema>;

export const standingRowSchema = z.object({
  position: z.number().int(),
  player: publicPlayerSchema,
  played: z.number().int(),
  won: z.number().int(),
  drawn: z.number().int(),
  lost: z.number().int(),
  goalsFor: z.number().int(),
  goalsAgainst: z.number().int(),
  goalDiff: z.number().int(),
  points: z.number().int(),
  /** Até cinco resultados, do mais antigo para o mais recente. */
  form: z.array(formResultSchema),
});
export type StandingRow = z.infer<typeof standingRowSchema>;

export const competitionCardSchema = z.object({
  slug: z.string(),
  name: z.string(),
  seasonName: z.string(),
  format: z.enum(COMPETITION_FORMATS),
  status: z.enum(COMPETITION_STATUSES),
  description: z.string().nullable(),
  participants: z.number().int(),
  maxParticipants: z.number().int(),
  roundsTotal: z.number().int().nullable(),
  /** Rodada em curso; nulo quando a competição não começou ou já terminou. */
  currentRound: z.number().int().nullable(),
  matchesTotal: z.number().int(),
  matchesPlayed: z.number().int(),
  nextRoundStartsOn: isoDate.nullable(),
  registrationClosesOn: isoDate.nullable(),
  startsOn: isoDate.nullable(),
});
export type CompetitionCard = z.infer<typeof competitionCardSchema>;

export const topPlayerSchema = z.object({
  rank: z.number().int(),
  player: publicPlayerSchema,
  played: z.number().int(),
  wins: z.number().int(),
  goalDiff: z.number().int(),
  /** Percentual de aproveitamento de pontos (0 a 100), arredondado. */
  winRate: z.number().int(),
});
export type TopPlayer = z.infer<typeof topPlayerSchema>;

export const federationStatsSchema = z.object({
  players: z.number().int(),
  clubs: z.number().int(),
  matches: z.number().int().describe('Partidas com resultado oficial.'),
  competitions: z.number().int(),
  goals: z.number().int(),
});
export type FederationStats = z.infer<typeof federationStatsSchema>;

export const CALENDAR_EVENT_KINDS = ['ROUND', 'REGISTRATION_CLOSES', 'STARTS', 'ENDS'] as const;
export const calendarEventSchema = z.object({
  date: isoDate,
  kind: z.enum(CALENDAR_EVENT_KINDS),
  title: z.string(),
  competition: z.object({ slug: z.string(), name: z.string() }),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const newsItemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: isoDateTime,
});
export type NewsItem = z.infer<typeof newsItemSchema>;

export const bannerSchema = z.object({
  eyebrow: z.string().nullable(),
  title: z.string(),
  subtitle: z.string().nullable(),
  imageUrl: z.string().nullable(),
  ctaLabel: z.string().nullable(),
  ctaHref: z.string().nullable(),
});
export type Banner = z.infer<typeof bannerSchema>;

export const publicHomeSchema = z.object({
  generatedAt: isoDateTime,
  banner: bannerSchema.nullable(),
  season: z.object({ slug: z.string(), name: z.string() }).nullable(),
  featuredCompetition: competitionCardSchema.nullable(),
  competitions: z.array(competitionCardSchema),
  nextMatch: publicMatchSchema.nullable(),
  latestResults: z.array(publicMatchSchema),
  upcomingMatches: z.array(publicMatchSchema),
  standings: z
    .object({
      competition: z.object({ slug: z.string(), name: z.string() }),
      rows: z.array(standingRowSchema),
    })
    .nullable(),
  topPlayers: z.array(topPlayerSchema),
  stats: federationStatsSchema,
  calendar: z.array(calendarEventSchema),
  featuredNews: newsItemSchema.nullable(),
  news: z.array(newsItemSchema),
});
export type PublicHome = z.infer<typeof publicHomeSchema>;

export const UPCOMING_SCOPES = ['today', 'tomorrow', 'week'] as const;
export type UpcomingScope = (typeof UPCOMING_SCOPES)[number];
export const upcomingMatchesQuerySchema = z.object({
  scope: z.enum(UPCOMING_SCOPES).default('today'),
  limit: z.coerce.number().int().min(1).max(30).default(8),
});
export type UpcomingMatchesQuery = z.infer<typeof upcomingMatchesQuerySchema>;
