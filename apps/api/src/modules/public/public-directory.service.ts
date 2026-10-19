import {
  PENDING_MATCH_STATUSES,
  type PaginatedResponse,
  type PlayerRecord,
  type PublicClubListItem,
  type PublicClubProfile,
  type PublicListQuery,
  type PublicPlayerListItem,
  type PublicPlayerProfile,
  type SearchResult,
} from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { paginated, toSkipTake } from '../../common/http/pagination.js';
import { dateOnly } from '../../common/time/federation-time.js';
import type { Club, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { toPublicClub } from '../clubs/club-mappers.js';
import {
  matchInclude,
  OFFICIAL_STATUSES,
  type PlayerRow,
  playerInclude,
  toMatch,
  toPlayer,
} from './public.service.js';

const RECENT_MATCHES = 10;
const UPCOMING_MATCHES = 5;
const CLUB_ALUMNI = 12;
const SEARCH_LIMIT = 5;

/** Jogador só aparece no portal enquanto a conta está ativa (suspensos e pendentes, não). */
const visiblePlayer = { user: { status: 'ACTIVE' } } satisfies Prisma.PlayerProfileWhereInput;

function toListItem(row: PlayerRow): PublicPlayerListItem {
  return { ...toPlayer(row), platform: row.platform };
}

function toClubListItem(club: Club, members: number): PublicClubListItem {
  return {
    ...toPublicClub(club),
    members,
    foundedOn: club.foundedOn ? dateOnly(club.foundedOn) : null,
  };
}

function playerSearch(search: string | undefined): Prisma.PlayerProfileWhereInput {
  return search
    ? {
        OR: [
          { nickname: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search.toLowerCase() } },
        ],
      }
    : {};
}

function clubSearch(search: string | undefined): Prisma.ClubWhereInput {
  return search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { tag: { contains: search.toUpperCase() } },
        ],
      }
    : {};
}

const activeMembers = {
  _count: { select: { memberships: { where: { endedOn: null, player: visiblePlayer } } } },
} satisfies Prisma.ClubInclude;

/** Jogadores, clubes e busca do portal. Sem sessão e sem dado de conta. */
@Injectable()
export class PublicDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async players(query: PublicListQuery): Promise<PaginatedResponse<PublicPlayerListItem>> {
    const where = { ...visiblePlayer, ...playerSearch(query.search) };
    const [rows, total] = await Promise.all([
      this.prisma.playerProfile.findMany({
        where,
        include: playerInclude,
        orderBy: [{ nickname: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.playerProfile.count({ where }),
    ]);
    return paginated(rows.map(toListItem), total, query);
  }

  async player(slug: string, now = new Date()): Promise<PublicPlayerProfile> {
    const row = await this.prisma.playerProfile.findFirst({
      where: { slug, ...visiblePlayer },
      include: {
        ...playerInclude,
        user: { select: { createdAt: true } },
      },
    });
    if (!row) {
      throw new AppError('NOT_FOUND');
    }
    const involves = { OR: [{ homePlayerId: row.id }, { awayPlayerId: row.id }] };
    const [memberships, official, upcoming] = await Promise.all([
      this.prisma.clubMembership.findMany({
        where: { playerId: row.id },
        include: { club: true },
        orderBy: [{ startedOn: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.match.findMany({
        where: { ...involves, status: { in: OFFICIAL_STATUSES } },
        include: matchInclude,
        orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.match.findMany({
        where: {
          ...involves,
          status: { in: [...PENDING_MATCH_STATUSES] },
          scheduledAt: { gte: now },
          competition: { status: { not: 'DRAFT' } },
        },
        include: matchInclude,
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        take: UPCOMING_MATCHES,
      }),
    ]);

    const record: PlayerRecord = {
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    };
    for (const match of official) {
      const home = match.homePlayerId === row.id;
      const own = (home ? match.homeScore : match.awayScore) ?? 0;
      const other = (home ? match.awayScore : match.homeScore) ?? 0;
      record.played += 1;
      record.goalsFor += own;
      record.goalsAgainst += other;
      if (own > other) record.won += 1;
      else if (own < other) record.lost += 1;
      else record.drawn += 1;
    }

    return {
      ...toListItem(row),
      region: row.region,
      memberSince: row.user.createdAt.toISOString(),
      memberships: memberships.map((membership) => ({
        club: toPublicClub(membership.club),
        startedOn: dateOnly(membership.startedOn),
        endedOn: membership.endedOn ? dateOnly(membership.endedOn) : null,
      })),
      record,
      recentMatches: official.slice(0, RECENT_MATCHES).map(toMatch),
      upcomingMatches: upcoming.map(toMatch),
    };
  }

  async clubs(query: PublicListQuery): Promise<PaginatedResponse<PublicClubListItem>> {
    const where: Prisma.ClubWhereInput = { status: 'ACTIVE', ...clubSearch(query.search) };
    const [rows, total] = await Promise.all([
      this.prisma.club.findMany({
        where,
        include: activeMembers,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.club.count({ where }),
    ]);
    return paginated(
      rows.map((club) => toClubListItem(club, club._count.memberships)),
      total,
      query,
    );
  }

  /** Clubes inativos continuam com página: o histórico de quem passou por eles aponta para cá. */
  async club(slug: string): Promise<PublicClubProfile> {
    const club = await this.prisma.club.findUnique({ where: { slug }, include: activeMembers });
    if (!club) {
      throw new AppError('NOT_FOUND');
    }
    const [roster, alumni] = await Promise.all([
      this.prisma.clubMembership.findMany({
        where: { clubId: club.id, endedOn: null, player: visiblePlayer },
        include: { player: { include: playerInclude } },
        orderBy: [{ startedOn: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.clubMembership.findMany({
        where: { clubId: club.id, endedOn: { not: null }, player: visiblePlayer },
        include: { player: { include: playerInclude } },
        orderBy: [{ endedOn: 'desc' }, { id: 'desc' }],
        take: CLUB_ALUMNI,
      }),
    ]);
    return {
      ...toClubListItem(club, club._count.memberships),
      roster: roster.map((membership) => ({
        player: toListItem(membership.player),
        startedOn: dateOnly(membership.startedOn),
      })),
      alumni: alumni.map((membership) => ({
        player: toListItem(membership.player),
        startedOn: dateOnly(membership.startedOn),
        endedOn: dateOnly(membership.endedOn as Date),
      })),
    };
  }

  async search(q: string): Promise<SearchResult> {
    const [players, clubs] = await Promise.all([
      this.prisma.playerProfile.findMany({
        where: { ...visiblePlayer, ...playerSearch(q) },
        include: playerInclude,
        orderBy: [{ nickname: 'asc' }, { id: 'asc' }],
        take: SEARCH_LIMIT,
      }),
      this.prisma.club.findMany({
        where: { status: 'ACTIVE', ...clubSearch(q) },
        include: activeMembers,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: SEARCH_LIMIT,
      }),
    ]);
    return {
      players: players.map(toListItem),
      clubs: clubs.map((club) => toClubListItem(club, club._count.memberships)),
    };
  }
}
