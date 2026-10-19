import {
  type CalendarEvent,
  type CompetitionCard,
  type FederationStats,
  isOfficialMatchStatus,
  type MatchStatus,
  type NewsItem,
  PENDING_MATCH_STATUSES,
  type PublicHome,
  type PublicMatch,
  type PublicPlayer,
  type StandingRow,
  type TopPlayer,
  type UpcomingScope,
} from '@efed/shared';
import { Injectable } from '@nestjs/common';
import {
  addDays,
  dateOnly,
  federationDate,
  scopeInterval,
  startOfFederationDay,
} from '../../common/time/federation-time.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { toPublicClub } from '../clubs/club-mappers.js';
import { mediaUrl } from '../media/media.controller.js';
import { accumulateTotals, type OfficialResult, rankTotals, winRate } from './standings.js';

const HOME_STANDINGS_SIZE = 5;
const HOME_TOP_PLAYERS = 5;
const HOME_LATEST_RESULTS = 6;
const HOME_UPCOMING = 8;
const HOME_COMPETITIONS = 3;
const HOME_NEWS = 4;
const HOME_CALENDAR_DAYS = 120;
const HOME_CALENDAR_EVENTS = 12;
/** Jogador só entra no destaque da temporada com esta quantidade mínima de partidas. */
const TOP_PLAYER_MIN_MATCHES = 3;

export const playerInclude = {
  memberships: { where: { endedOn: null }, include: { club: true }, take: 1 },
} satisfies Prisma.PlayerProfileInclude;

export const matchInclude = {
  competition: { select: { slug: true, name: true } },
  round: { select: { number: true } },
  home: { include: playerInclude },
  away: { include: playerInclude },
} satisfies Prisma.MatchInclude;

type MatchRow = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;
export type PlayerRow = Prisma.PlayerProfileGetPayload<{ include: typeof playerInclude }>;

export function toPlayer(row: PlayerRow): PublicPlayer {
  const club = row.memberships[0]?.club;
  return {
    slug: row.slug,
    nickname: row.nickname,
    country: row.country,
    avatarUrl: mediaUrl(row.avatarKey),
    club: club ? toPublicClub(club) : null,
  };
}

/** O placar só sai da API quando o resultado é oficial. */
export function toMatch(row: MatchRow): PublicMatch {
  const official = isOfficialMatchStatus(row.status);
  return {
    id: row.id,
    competition: row.competition,
    round: row.round.number,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    home: toPlayer(row.home),
    away: toPlayer(row.away),
    homeScore: official ? row.homeScore : null,
    awayScore: official ? row.awayScore : null,
  };
}

function toNews(row: {
  slug: string;
  title: string;
  summary: string;
  category: string;
  imageUrl: string | null;
  publishedAt: Date | null;
}): NewsItem {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category,
    imageUrl: row.imageUrl,
    // Garantido pelo CHECK news_published_at_check para notícias públicas.
    publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
  };
}

export const OFFICIAL_STATUSES: MatchStatus[] = ['HOMOLOGATED', 'WALKOVER'];

/** Leitura pública. Nada aqui depende de sessão e nada devolve dado de conta. */
@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async home(now = new Date()): Promise<PublicHome> {
    const season =
      (await this.prisma.season.findFirst({ where: { isCurrent: true } })) ??
      (await this.prisma.season.findFirst({ orderBy: { startsOn: 'desc' } }));

    const featured = await this.prisma.competition.findFirst({
      where: { isFeatured: true, status: { not: 'DRAFT' } },
    });
    const competitionRows = await this.prisma.competition.findMany({
      where: { status: { not: 'DRAFT' }, ...(season ? { seasonId: season.id } : {}) },
      include: { season: { select: { name: true } } },
    });
    const statusOrder = { IN_PROGRESS: 0, REGISTRATION_OPEN: 1, FINISHED: 2, DRAFT: 3 } as const;
    competitionRows.sort(
      (a, b) =>
        Number(b.id === featured?.id) - Number(a.id === featured?.id) ||
        statusOrder[a.status] - statusOrder[b.status] ||
        a.name.localeCompare(b.name, 'pt-BR'),
    );
    const cards = await this.competitionCards(competitionRows.slice(0, HOME_COMPETITIONS), now);
    const featuredCard = featured
      ? (cards.find((card) => card.slug === featured.slug) ??
        (
          await this.competitionCards(
            await this.prisma.competition.findMany({
              where: { id: featured.id },
              include: { season: { select: { name: true } } },
            }),
            now,
          )
        )[0] ??
        null)
      : null;

    const [
      latest,
      upcoming,
      nextMatch,
      standings,
      topPlayers,
      stats,
      calendar,
      banner,
      news,
      featuredRow,
    ] = await Promise.all([
      this.latestResults(HOME_LATEST_RESULTS),
      this.upcoming('today', HOME_UPCOMING, now),
      this.nextMatch(featured?.id, now),
      featured ? this.standings(featured.id, featured.slug, featured.name) : null,
      season ? this.topPlayers(season.id) : [],
      this.stats(),
      this.calendar(now),
      this.activeBanner(now),
      this.publishedNews(now, HOME_NEWS + 1),
      this.prisma.news.findFirst({
        where: {
          isFeatured: true,
          status: { in: ['PUBLISHED', 'SCHEDULED'] },
          publishedAt: { lte: now },
        },
        orderBy: { publishedAt: 'desc' },
      }),
    ]);

    const featuredNews = featuredRow ?? news[0] ?? null;
    return {
      generatedAt: now.toISOString(),
      banner,
      season: season ? { slug: season.slug, name: season.name } : null,
      featuredCompetition: featuredCard,
      competitions: cards,
      nextMatch,
      latestResults: latest,
      upcomingMatches: upcoming,
      standings,
      topPlayers,
      stats,
      calendar,
      featuredNews: featuredNews ? toNews(featuredNews) : null,
      news: news
        .filter((item) => item.slug !== featuredNews?.slug)
        .slice(0, HOME_NEWS)
        .map(toNews),
    };
  }

  /** Partidas que ainda vão acontecer (ou aguardam resultado) no intervalo do escopo. */
  async upcoming(scope: UpcomingScope, limit: number, now = new Date()): Promise<PublicMatch[]> {
    const { from, to } = scopeInterval(scope, now);
    const rows = await this.prisma.match.findMany({
      where: {
        status: { in: [...PENDING_MATCH_STATUSES] },
        scheduledAt: { gte: from, lt: to },
        competition: { status: { not: 'DRAFT' } },
      },
      include: matchInclude,
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map(toMatch);
  }

  private async latestResults(limit: number): Promise<PublicMatch[]> {
    const rows = await this.prisma.match.findMany({
      where: { status: { in: OFFICIAL_STATUSES }, competition: { status: { not: 'DRAFT' } } },
      include: matchInclude,
      orderBy: [{ homologatedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map(toMatch);
  }

  /** Próxima partida a começar, dando preferência à competição em destaque. */
  private async nextMatch(featuredId: string | undefined, now: Date): Promise<PublicMatch | null> {
    const where = {
      status: { in: ['SCHEDULED', 'AVAILABLE'] as MatchStatus[] },
      scheduledAt: { gte: now },
      competition: { status: { not: 'DRAFT' as const } },
    };
    const orderBy = [{ scheduledAt: 'asc' as const }, { id: 'asc' as const }];
    const row =
      (featuredId
        ? await this.prisma.match.findFirst({
            where: { ...where, competitionId: featuredId },
            include: matchInclude,
            orderBy,
          })
        : null) ?? (await this.prisma.match.findFirst({ where, include: matchInclude, orderBy }));
    return row ? toMatch(row) : null;
  }

  private async officialResults(where: Prisma.MatchWhereInput): Promise<OfficialResult[]> {
    const rows = await this.prisma.match.findMany({
      where: { ...where, status: { in: OFFICIAL_STATUSES } },
      select: {
        homePlayerId: true,
        awayPlayerId: true,
        homeScore: true,
        awayScore: true,
        homologatedAt: true,
        scheduledAt: true,
      },
    });
    return rows.flatMap((row) =>
      row.homeScore === null || row.awayScore === null
        ? []
        : [
            {
              homePlayerId: row.homePlayerId,
              awayPlayerId: row.awayPlayerId,
              homeScore: row.homeScore,
              awayScore: row.awayScore,
              decidedAt: row.homologatedAt ?? row.scheduledAt,
            },
          ],
    );
  }

  private async standings(
    competitionId: string,
    slug: string,
    name: string,
  ): Promise<{ competition: { slug: string; name: string }; rows: StandingRow[] }> {
    const [entries, results] = await Promise.all([
      this.prisma.competitionEntry.findMany({
        where: { competitionId },
        include: { player: { include: playerInclude } },
      }),
      this.officialResults({ competitionId }),
    ]);
    const players = new Map(entries.map((entry) => [entry.playerId, entry.player]));
    const totals = accumulateTotals(results, [...players.keys()]);
    const ranked = rankTotals([...totals.values()], (id) => players.get(id)?.nickname ?? id);
    const rows = ranked.flatMap((row, index) => {
      const player = players.get(row.playerId);
      return player && index < HOME_STANDINGS_SIZE
        ? [
            {
              position: index + 1,
              player: toPlayer(player),
              played: row.played,
              won: row.won,
              drawn: row.drawn,
              lost: row.lost,
              goalsFor: row.goalsFor,
              goalsAgainst: row.goalsAgainst,
              goalDiff: row.goalDiff,
              points: row.points,
              form: row.form,
            },
          ]
        : [];
    });
    return { competition: { slug, name }, rows };
  }

  private async topPlayers(seasonId: string): Promise<TopPlayer[]> {
    const results = await this.officialResults({ competition: { seasonId } });
    const totals = [...accumulateTotals(results).values()].filter(
      (row) => row.played >= TOP_PLAYER_MIN_MATCHES,
    );
    if (totals.length === 0) {
      return [];
    }
    const profiles = await this.prisma.playerProfile.findMany({
      where: { id: { in: totals.map((row) => row.playerId) } },
      include: playerInclude,
    });
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    const ranked = [...totals].sort(
      (a, b) =>
        winRate(b) - winRate(a) ||
        b.goalDiff - a.goalDiff ||
        b.won - a.won ||
        (byId.get(a.playerId)?.nickname ?? '').localeCompare(
          byId.get(b.playerId)?.nickname ?? '',
          'pt-BR',
        ),
    );
    return ranked.flatMap((row, index) => {
      const profile = byId.get(row.playerId);
      return profile && index < HOME_TOP_PLAYERS
        ? [
            {
              rank: index + 1,
              player: toPlayer(profile),
              played: row.played,
              wins: row.won,
              goalDiff: row.goalDiff,
              winRate: winRate(row),
            },
          ]
        : [];
    });
  }

  private async stats(): Promise<FederationStats> {
    const [players, clubs, matches, competitions, goals] = await Promise.all([
      this.prisma.playerProfile.count(),
      this.prisma.club.count(),
      this.prisma.match.count({ where: { status: { in: OFFICIAL_STATUSES } } }),
      this.prisma.competition.count({ where: { status: { not: 'DRAFT' } } }),
      this.prisma.match.aggregate({
        where: { status: { in: OFFICIAL_STATUSES } },
        _sum: { homeScore: true, awayScore: true },
      }),
    ]);
    return {
      players,
      clubs,
      matches,
      competitions,
      goals: (goals._sum.homeScore ?? 0) + (goals._sum.awayScore ?? 0),
    };
  }

  private async competitionCards(
    rows: {
      id: string;
      slug: string;
      name: string;
      format: CompetitionCard['format'];
      status: CompetitionCard['status'];
      description: string | null;
      maxParticipants: number;
      roundsTotal: number | null;
      registrationClosesOn: Date | null;
      startsOn: Date | null;
      season: { name: string };
    }[],
    now: Date,
  ): Promise<CompetitionCard[]> {
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const today = startOfFederationDay(federationDate(now));
    const [entryGroups, matchGroups, nextRounds] = await Promise.all([
      this.prisma.competitionEntry.groupBy({
        by: ['competitionId'],
        where: { competitionId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.match.groupBy({
        by: ['competitionId', 'status'],
        where: { competitionId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.round.groupBy({
        by: ['competitionId'],
        where: { competitionId: { in: ids }, startsOn: { gt: today } },
        _min: { startsOn: true },
      }),
    ]);

    // Rodada em curso: a que contém hoje; se nenhuma contém (intervalo entre rodadas ou atraso),
    // a de menor número que ainda tem partida não decidida.
    const [todayRounds, pendingRounds] = await Promise.all([
      this.prisma.round.findMany({
        where: { competitionId: { in: ids }, startsOn: { lte: today }, endsOn: { gte: today } },
        select: { competitionId: true, number: true },
      }),
      this.prisma.round.findMany({
        where: {
          competitionId: { in: ids },
          matches: { some: { status: { notIn: [...OFFICIAL_STATUSES, 'CANCELED'] } } },
        },
        select: { competitionId: true, number: true },
      }),
    ]);
    const currentRoundByCompetition = new Map<string, number>();
    for (const round of pendingRounds) {
      const known = currentRoundByCompetition.get(round.competitionId);
      if (known === undefined || round.number < known) {
        currentRoundByCompetition.set(round.competitionId, round.number);
      }
    }
    for (const round of todayRounds) {
      currentRoundByCompetition.set(round.competitionId, round.number);
    }

    return rows.map((row) => {
      const matches = matchGroups.filter((group) => group.competitionId === row.id);
      const total = matches.reduce((sum, group) => sum + group._count._all, 0);
      const played = matches
        .filter((group) => isOfficialMatchStatus(group.status))
        .reduce((sum, group) => sum + group._count._all, 0);
      const nextRound = nextRounds.find((group) => group.competitionId === row.id)?._min.startsOn;
      return {
        slug: row.slug,
        name: row.name,
        seasonName: row.season.name,
        format: row.format,
        status: row.status,
        description: row.description,
        participants: entryGroups.find((group) => group.competitionId === row.id)?._count._all ?? 0,
        maxParticipants: row.maxParticipants,
        roundsTotal: row.roundsTotal,
        currentRound: currentRoundByCompetition.get(row.id) ?? null,
        matchesTotal: total,
        matchesPlayed: played,
        nextRoundStartsOn: nextRound ? dateOnly(nextRound) : null,
        registrationClosesOn: row.registrationClosesOn ? dateOnly(row.registrationClosesOn) : null,
        startsOn: row.startsOn ? dateOnly(row.startsOn) : null,
      };
    });
  }

  private async calendar(now: Date): Promise<CalendarEvent[]> {
    const today = startOfFederationDay(federationDate(now));
    const until = addDays(today, HOME_CALENDAR_DAYS);
    const window = { gte: today, lt: until };
    const [rounds, competitions] = await Promise.all([
      this.prisma.round.findMany({
        where: { startsOn: window, competition: { status: { not: 'DRAFT' } } },
        include: { competition: { select: { slug: true, name: true } } },
        orderBy: { startsOn: 'asc' },
        take: HOME_CALENDAR_EVENTS,
      }),
      this.prisma.competition.findMany({
        where: {
          status: { not: 'DRAFT' },
          OR: [{ registrationClosesOn: window }, { startsOn: window }, { endsOn: window }],
        },
        select: {
          slug: true,
          name: true,
          registrationClosesOn: true,
          startsOn: true,
          endsOn: true,
        },
      }),
    ]);
    const inWindow = (value: Date | null): value is Date =>
      value !== null && value >= today && value < until;
    const events: CalendarEvent[] = rounds.map((round) => ({
      date: dateOnly(round.startsOn),
      kind: 'ROUND',
      title: `Rodada ${String(round.number).padStart(2, '0')}`,
      competition: round.competition,
    }));
    for (const competition of competitions) {
      const ref = { slug: competition.slug, name: competition.name };
      if (inWindow(competition.registrationClosesOn)) {
        events.push({
          date: dateOnly(competition.registrationClosesOn),
          kind: 'REGISTRATION_CLOSES',
          title: 'Fim das inscrições',
          competition: ref,
        });
      }
      if (inWindow(competition.startsOn)) {
        events.push({
          date: dateOnly(competition.startsOn),
          kind: 'STARTS',
          title: 'Início do campeonato',
          competition: ref,
        });
      }
      if (inWindow(competition.endsOn)) {
        events.push({
          date: dateOnly(competition.endsOn),
          kind: 'ENDS',
          title: 'Final',
          competition: ref,
        });
      }
    }
    return events
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'pt-BR'))
      .slice(0, HOME_CALENDAR_EVENTS);
  }

  private async activeBanner(now: Date): Promise<PublicHome['banner']> {
    const banner = await this.prisma.banner.findFirst({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return banner
      ? {
          eyebrow: banner.eyebrow,
          title: banner.title,
          subtitle: banner.subtitle,
          imageUrl: banner.imageUrl,
          ctaLabel: banner.ctaLabel,
          ctaHref: banner.ctaHref,
        }
      : null;
  }

  /** Notícias visíveis ao público: publicadas, ou agendadas cuja hora já passou. */
  private publishedNews(now: Date, limit: number) {
    return this.prisma.news.findMany({
      where: { status: { in: ['PUBLISHED', 'SCHEDULED'] }, publishedAt: { lte: now } },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }
}
