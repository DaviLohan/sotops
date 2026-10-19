import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from './support/test-app.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('portal público — jogadores, clubes e busca', () => {
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
    const lions = await prisma.club.create({
      data: {
        slug: 'leoes-do-norte',
        name: 'Leões do Norte',
        tag: 'LDN',
        primaryColor: '#112233',
        secondaryColor: '#FFFFFF',
        foundedOn: new Date('2021-05-01'),
      },
    });
    const closed = await prisma.club.create({
      data: {
        slug: 'clube-fechado',
        name: 'Clube Fechado',
        tag: 'CFE',
        primaryColor: '#333333',
        secondaryColor: '#999999',
        status: 'INACTIVE',
      },
    });
    const profiles: Record<string, string> = {};
    for (const [nickname, status] of [
      ['Alfa', 'ACTIVE'],
      ['Bravo', 'ACTIVE'],
      ['Suspenso', 'SUSPENDED'],
    ] as const) {
      const user = await testApp.seedUser({ status });
      const profile = await prisma.playerProfile.create({
        data: {
          userId: user.id,
          nickname,
          slug: nickname.toLowerCase(),
          country: 'BR',
          region: nickname === 'Alfa' ? 'Bahia' : null,
          platform: 'XBOX',
          efootballId: `ID-${nickname}`,
        },
      });
      profiles[nickname] = profile.id;
    }
    const alfa = profiles.Alfa as string;
    const bravo = profiles.Bravo as string;
    await prisma.clubMembership.createMany({
      data: [
        {
          clubId: closed.id,
          playerId: alfa,
          startedOn: new Date('2023-01-01'),
          endedOn: new Date('2024-01-01'),
        },
        { clubId: lions.id, playerId: alfa, startedOn: new Date('2024-01-01') },
        {
          clubId: lions.id,
          playerId: profiles.Suspenso as string,
          startedOn: new Date('2024-02-01'),
        },
      ],
    });

    const season = await prisma.season.create({
      data: {
        slug: 't',
        name: 'T',
        year: 2026,
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    });
    const competition = await prisma.competition.create({
      data: {
        seasonId: season.id,
        slug: 'liga',
        name: 'Liga',
        format: 'LEAGUE',
        status: 'IN_PROGRESS',
        maxParticipants: 4,
      },
    });
    const round = await prisma.round.create({
      data: {
        competitionId: competition.id,
        number: 1,
        startsOn: new Date(now - 10 * DAY_MS),
        endsOn: new Date(now + 10 * DAY_MS),
      },
    });
    const base = { competitionId: competition.id, roundId: round.id };
    await prisma.match.createMany({
      data: [
        // Vitória de Alfa em casa, derrota fora e um empate: só os oficiais contam.
        {
          ...base,
          homePlayerId: alfa,
          awayPlayerId: bravo,
          scheduledAt: new Date(now - 3 * DAY_MS),
          status: 'HOMOLOGATED',
          homeScore: 3,
          awayScore: 1,
          homologatedAt: new Date(now - 3 * DAY_MS),
        },
        {
          ...base,
          homePlayerId: bravo,
          awayPlayerId: alfa,
          scheduledAt: new Date(now - 2 * DAY_MS),
          status: 'HOMOLOGATED',
          homeScore: 2,
          awayScore: 0,
          homologatedAt: new Date(now - 2 * DAY_MS),
        },
        {
          ...base,
          homePlayerId: alfa,
          awayPlayerId: bravo,
          scheduledAt: new Date(now - DAY_MS),
          status: 'WALKOVER',
          homeScore: 1,
          awayScore: 1,
          homologatedAt: new Date(now - DAY_MS),
        },
        {
          ...base,
          homePlayerId: bravo,
          awayPlayerId: alfa,
          scheduledAt: new Date(now - DAY_MS / 2),
          status: 'UNDER_REVIEW',
          homeScore: 9,
          awayScore: 0,
        },
        {
          ...base,
          homePlayerId: alfa,
          awayPlayerId: bravo,
          scheduledAt: new Date(now + 2 * DAY_MS),
          status: 'SCHEDULED',
        },
      ],
    });
    return { lions, closed };
  }

  it('lista só jogadores com conta ativa, com busca e paginação', async () => {
    await scenario();
    const all = await get('/public/players').expect(200);
    expect(all.body.data.map((p: { nickname: string }) => p.nickname)).toEqual(['Alfa', 'Bravo']);
    expect(all.body.meta).toMatchObject({ total: 2, page: 1 });
    expect(all.headers['cache-control']).toContain('public');

    const found = await get('/public/players?search=BRA').expect(200);
    expect(found.body.data).toHaveLength(1);
    expect(found.body.data[0]).toMatchObject({ slug: 'bravo', platform: 'XBOX', club: null });

    const paged = await get('/public/players?pageSize=1&page=2').expect(200);
    expect(paged.body.data.map((p: { slug: string }) => p.slug)).toEqual(['bravo']);
    await get('/public/players?pageSize=500').expect(400);
  });

  it('monta o perfil com histórico de clubes e campanha só de partidas oficiais', async () => {
    const { lions, closed } = await scenario();
    const response = await get('/public/players/alfa').expect(200);
    const profile = response.body.data;
    expect(profile).toMatchObject({
      slug: 'alfa',
      nickname: 'Alfa',
      region: 'Bahia',
      club: { slug: lions.slug, crestUrl: null },
      record: { played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 4 },
    });
    expect(profile.memberships).toEqual([
      expect.objectContaining({
        club: expect.objectContaining({ slug: lions.slug }),
        endedOn: null,
      }),
      expect.objectContaining({
        club: expect.objectContaining({ slug: closed.slug }),
        startedOn: '2023-01-01',
        endedOn: '2024-01-01',
      }),
    ]);
    expect(profile.recentMatches).toHaveLength(3);
    expect(profile.upcomingMatches).toHaveLength(1);
    // Partida em análise não aparece com placar em lugar nenhum.
    expect(JSON.stringify(profile)).not.toContain('"homeScore":9');

    const body = JSON.stringify(response.body);
    for (const leak of ['email', 'username', 'userId', 'efootballId', 'exemplo.test']) {
      expect(body).not.toContain(leak);
    }
  });

  it('esconde jogador suspenso e responde 404 para quem não existe', async () => {
    await scenario();
    await get('/public/players/suspenso').expect(404);
    await get('/public/players/ninguem').expect(404);
  });

  it('lista clubes ativos e mostra elenco e ex-jogadores, inclusive de clube inativo', async () => {
    const { lions, closed } = await scenario();
    const list = await get('/public/clubs').expect(200);
    expect(list.body.data).toEqual([
      expect.objectContaining({ slug: lions.slug, members: 1, foundedOn: '2021-05-01' }),
    ]);

    const page = await get(`/public/clubs/${lions.slug}`).expect(200);
    expect(page.body.data.roster.map((r: { player: { slug: string } }) => r.player.slug)).toEqual([
      'alfa',
    ]);
    expect(page.body.data.alumni).toEqual([]);

    const old = await get(`/public/clubs/${closed.slug}`).expect(200);
    expect(old.body.data.roster).toEqual([]);
    expect(old.body.data.alumni).toEqual([
      expect.objectContaining({
        player: expect.objectContaining({ slug: 'alfa' }),
        endedOn: '2024-01-01',
      }),
    ]);
    await get('/public/clubs/nao-existe').expect(404);
  });

  it('busca jogadores e clubes, exigindo ao menos 2 caracteres', async () => {
    await scenario();
    const short = await get('/public/search?q=a').expect(400);
    expect(short.body.code).toBe('VALIDATION_FAILED');

    const result = await get('/public/search?q=le').expect(200);
    expect(result.body.data.clubs.map((c: { slug: string }) => c.slug)).toEqual(['leoes-do-norte']);
    expect(result.body.data.players).toEqual([]);

    const byTag = await get('/public/search?q=ldn').expect(200);
    expect(byTag.body.data.clubs).toHaveLength(1);
    const players = await get('/public/search?q=alf').expect(200);
    expect(players.body.data.players.map((p: { slug: string }) => p.slug)).toEqual(['alfa']);
  });
});
