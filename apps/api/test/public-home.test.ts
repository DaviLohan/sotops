import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from './support/test-app.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe('portal público — HOME', () => {
  let testApp: TestApp;
  const get = (path: string) => request(testApp.app.getHttpServer()).get(`/api/v1${path}`);

  beforeAll(async () => {
    testApp = await TestApp.create();
  });
  afterAll(async () => {
    await testApp.close();
  });
  beforeEach(async () => {
    await testApp.reset();
  });

  async function scenario() {
    const { prisma } = testApp;
    const now = Date.now();
    const season = await prisma.season.create({
      data: {
        slug: 'temporada-teste',
        name: 'Temporada Teste',
        year: 2026,
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
        isCurrent: true,
      },
    });
    const club = await prisma.club.create({
      data: {
        slug: 'clube-teste',
        name: 'Clube Teste',
        tag: 'CLT',
        primaryColor: '#112233',
        secondaryColor: '#FFFFFF',
      },
    });
    const players = [];
    for (const nickname of ['Alfa', 'Bravo', 'Charlie']) {
      const user = await testApp.seedUser();
      players.push(
        await prisma.playerProfile.create({
          data: {
            userId: user.id,
            nickname,
            slug: nickname.toLowerCase(),
            country: 'BR',
            platform: 'PLAYSTATION',
          },
        }),
      );
    }
    const [alfa, bravo, charlie] = players as [
      (typeof players)[0],
      (typeof players)[0],
      (typeof players)[0],
    ];
    await prisma.clubMembership.create({
      data: { clubId: club.id, playerId: alfa.id, startedOn: new Date('2026-01-01') },
    });
    const competition = await prisma.competition.create({
      data: {
        seasonId: season.id,
        slug: 'liga-teste',
        name: 'Liga Teste',
        format: 'LEAGUE',
        status: 'IN_PROGRESS',
        isFeatured: true,
        maxParticipants: 4,
        roundsTotal: 3,
        entries: { create: players.map((player) => ({ playerId: player.id })) },
      },
    });
    const round = await prisma.round.create({
      data: {
        competitionId: competition.id,
        number: 1,
        startsOn: new Date(now - DAY_MS),
        endsOn: new Date(now + 6 * DAY_MS),
      },
    });
    const base = { competitionId: competition.id, roundId: round.id };
    const official = await prisma.match.create({
      data: {
        ...base,
        homePlayerId: alfa.id,
        awayPlayerId: bravo.id,
        scheduledAt: new Date(now - 2 * HOUR_MS),
        status: 'HOMOLOGATED',
        homeScore: 2,
        awayScore: 1,
        homologatedAt: new Date(now - HOUR_MS),
      },
    });
    const unconfirmed = await prisma.match.create({
      data: {
        ...base,
        homePlayerId: bravo.id,
        awayPlayerId: charlie.id,
        scheduledAt: new Date(now - 3 * HOUR_MS),
        status: 'AWAITING_CONFIRMATION',
        homeScore: 9,
        awayScore: 0,
      },
    });
    const upcoming = await prisma.match.create({
      data: {
        ...base,
        homePlayerId: charlie.id,
        awayPlayerId: alfa.id,
        scheduledAt: new Date(now + 2 * DAY_MS),
        status: 'SCHEDULED',
      },
    });
    return { season, competition, round, alfa, bravo, charlie, official, unconfirmed, upcoming };
  }

  it('responde sem sessão, com a HOME vazia e coerente quando não há dados', async () => {
    const response = await get('/public/home').expect(200);
    expect(response.headers['cache-control']).toContain('public');
    expect(response.body.data).toMatchObject({
      banner: null,
      season: null,
      featuredCompetition: null,
      competitions: [],
      nextMatch: null,
      latestResults: [],
      upcomingMatches: [],
      standings: null,
      topPlayers: [],
      featuredNews: null,
      news: [],
      stats: { players: 0, clubs: 0, matches: 0, competitions: 0, goals: 0 },
    });
  });

  it('calcula classificação, resultados e números só com partidas homologadas', async () => {
    await scenario();
    const { data } = (await get('/public/home').expect(200)).body;

    expect(
      data.standings.rows.map((row: { player: { nickname: string } }) => row.player.nickname),
    ).toEqual(['Alfa', 'Charlie', 'Bravo']);
    expect(data.standings.rows[0]).toMatchObject({
      position: 1,
      played: 1,
      won: 1,
      points: 3,
      goalDiff: 1,
      form: ['W'],
    });
    expect(data.standings.rows[0].player.club).toMatchObject({ tag: 'CLT' });
    // Charlie (sem jogos, saldo 0) fica à frente de Bravo (derrota, saldo -1).
    expect(data.standings.rows[1]).toMatchObject({ played: 0, points: 0 });
    expect(data.standings.rows[2]).toMatchObject({ played: 1, lost: 1, goalDiff: -1, form: ['L'] });
    expect(data.stats).toMatchObject({ players: 3, clubs: 1, matches: 1, goals: 3 });
    expect(data.latestResults).toHaveLength(1);
    expect(data.latestResults[0]).toMatchObject({
      homeScore: 2,
      awayScore: 1,
      status: 'HOMOLOGATED',
    });
    expect(data.featuredCompetition).toMatchObject({
      slug: 'liga-teste',
      participants: 3,
      matchesTotal: 3,
      matchesPlayed: 1,
      currentRound: 1,
    });
  });

  it('nunca expõe placar de partida não homologada', async () => {
    const { unconfirmed } = await scenario();
    const { data } = (await get('/public/matches/upcoming?scope=week&limit=30').expect(200)).body;
    expect(data.map((match: { id: string }) => match.id)).toContain(unconfirmed.id);
    for (const match of data as { homeScore: number | null; awayScore: number | null }[]) {
      expect(match.homeScore).toBeNull();
      expect(match.awayScore).toBeNull();
    }
    const home = (await get('/public/home').expect(200)).body.data;
    expect(JSON.stringify(home)).not.toContain('"homeScore":9');
  });

  it('não vaza e-mail, conta nem identificadores de usuário', async () => {
    await scenario();
    const body = (await get('/public/home').expect(200)).text;
    expect(body).not.toContain('@exemplo.test');
    expect(body).not.toMatch(/"(email|username|userId|passwordHash)"/);
  });

  it('esconde competições em rascunho, notícias não publicadas e banners fora da janela', async () => {
    const { season } = await scenario();
    const { prisma } = testApp;
    await prisma.competition.create({
      data: {
        seasonId: season.id,
        slug: 'rascunho',
        name: 'Rascunho',
        format: 'KNOCKOUT',
        status: 'DRAFT',
        maxParticipants: 8,
      },
    });
    const news = (status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED', slug: string, offsetMs: number) =>
      prisma.news.create({
        data: {
          slug,
          title: slug,
          summary: 'Resumo',
          body: 'Corpo',
          category: 'Comunicado',
          status,
          publishedAt: status === 'DRAFT' ? null : new Date(Date.now() + offsetMs),
        },
      });
    await news('PUBLISHED', 'publicada', -HOUR_MS);
    await news('DRAFT', 'rascunho-noticia', 0);
    await news('SCHEDULED', 'agendada-futura', DAY_MS);
    await news('SCHEDULED', 'agendada-vencida', -2 * HOUR_MS);
    await prisma.banner.create({
      data: {
        title: 'Expirado',
        endsAt: new Date(Date.now() - HOUR_MS),
        startsAt: new Date(Date.now() - DAY_MS),
      },
    });
    await prisma.banner.create({ data: { title: 'Ativo', eyebrow: 'Temporada' } });

    const { data } = (await get('/public/home').expect(200)).body;
    expect(data.competitions.map((c: { slug: string }) => c.slug)).toEqual(['liga-teste']);
    expect(data.stats.competitions).toBe(1);
    const slugs = [data.featuredNews, ...data.news]
      .map((item: { slug: string }) => item.slug)
      .sort();
    expect(slugs).toEqual(['agendada-vencida', 'publicada']);
    expect(data.banner).toMatchObject({ title: 'Ativo' });
  });

  it('valida o escopo e o limite dos próximos confrontos', async () => {
    await get('/public/matches/upcoming?scope=mes').expect(400);
    await get('/public/matches/upcoming?limit=0').expect(400);
    await get('/public/matches/upcoming?limit=31').expect(400);
    const response = await get('/public/matches/upcoming').expect(200);
    expect(response.body.data).toEqual([]);
  });

  it('o banco impede uma segunda competição em destaque', async () => {
    const { season } = await scenario();
    await expect(
      testApp.prisma.competition.create({
        data: {
          seasonId: season.id,
          slug: 'outra',
          name: 'Outra',
          format: 'LEAGUE',
          status: 'IN_PROGRESS',
          isFeatured: true,
          maxParticipants: 4,
        },
      }),
    ).rejects.toThrow();
  });

  it('o banco recusa resultado oficial sem placar', async () => {
    const { competition, round, alfa, bravo } = await scenario();
    await expect(
      testApp.prisma.match.create({
        data: {
          competitionId: competition.id,
          roundId: round.id,
          homePlayerId: alfa.id,
          awayPlayerId: bravo.id,
          scheduledAt: new Date(),
          status: 'HOMOLOGATED',
        },
      }),
    ).rejects.toThrow();
  });
});
