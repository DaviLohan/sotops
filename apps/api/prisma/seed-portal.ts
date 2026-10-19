/**
 * SEED DO PORTAL — dados fictícios de demonstração (clubes, apelidos, campeonatos, resultados,
 * notícias). Nunca roda em produção e nada aqui é usado por código de aplicação.
 *
 * Todas as datas são relativas a "agora": a Liga Principal sempre está na rodada 8, com
 * resultados ontem, jogos hoje e nos próximos dias — a HOME nasce viva em qualquer dia do seed.
 * É idempotente: se a temporada de demonstração já existe, não faz nada.
 */
import type { MatchStatus, PrismaClient } from '../src/generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_MS = 3 * 60 * 60 * 1000; // America/Sao_Paulo = UTC-03:00

const CLUBS: { name: string; tag: string; primary: string; secondary: string }[] = [
  { name: 'Tempestade FC', tag: 'TMP', primary: '#1D4ED8', secondary: '#F5F500' },
  { name: 'Corsários do Norte', tag: 'CRS', primary: '#7F1D1D', secondary: '#F8FAFF' },
  { name: 'Real Esquina', tag: 'RSQ', primary: '#F8FAFF', secondary: '#0B1029' },
  { name: 'Aurora United', tag: 'AUR', primary: '#C2410C', secondary: '#FDE68A' },
  { name: 'Sporting Ribeira', tag: 'RIB', primary: '#166534', secondary: '#F8FAFF' },
  { name: 'Dínamo Central', tag: 'DCE', primary: '#0B1029', secondary: '#22D3EE' },
  { name: 'Guardiões da Serra', tag: 'GDS', primary: '#3F3F46', secondary: '#F97316' },
  { name: 'Fúria Azul', tag: 'FAZ', primary: '#2445FF', secondary: '#F8FAFF' },
  { name: 'Atlântico SC', tag: 'ATL', primary: '#0E7490', secondary: '#F8FAFF' },
  { name: 'Vulcão FC', tag: 'VUL', primary: '#B91C1C', secondary: '#111827' },
  { name: 'Legião 27', tag: 'L27', primary: '#6D28D9', secondary: '#F5F500' },
  { name: 'Nebulosa EC', tag: 'NEB', primary: '#312E81', secondary: '#C4B5FD' },
];

const PLAYERS: {
  nickname: string;
  country: string;
  platform: 'PLAYSTATION' | 'XBOX' | 'PC' | 'MOBILE';
}[] = [
  { nickname: 'Raposa', country: 'BR', platform: 'PLAYSTATION' },
  { nickname: 'Kaiser', country: 'BR', platform: 'PLAYSTATION' },
  { nickname: 'Tatu', country: 'BR', platform: 'XBOX' },
  { nickname: 'Jotinha', country: 'BR', platform: 'PLAYSTATION' },
  { nickname: 'Furacao', country: 'BR', platform: 'PC' },
  { nickname: 'Maverick', country: 'PT', platform: 'PLAYSTATION' },
  { nickname: 'Cometa', country: 'BR', platform: 'MOBILE' },
  { nickname: 'Dragao', country: 'BR', platform: 'PLAYSTATION' },
  { nickname: 'Pantera', country: 'AR', platform: 'XBOX' },
  { nickname: 'Sniper', country: 'BR', platform: 'PLAYSTATION' },
  { nickname: 'Bruxo', country: 'BR', platform: 'PC' },
  { nickname: 'Tigrao', country: 'BR', platform: 'PLAYSTATION' },
  { nickname: 'Vendaval', country: 'UY', platform: 'PLAYSTATION' },
  { nickname: 'Mirage', country: 'BR', platform: 'XBOX' },
  { nickname: 'Lobinho', country: 'BR', platform: 'PLAYSTATION' },
  { nickname: 'Faisca', country: 'BR', platform: 'MOBILE' },
  { nickname: 'Rochedo', country: 'BR', platform: 'PLAYSTATION' },
  { nickname: 'Ciclone', country: 'PT', platform: 'PC' },
  { nickname: 'Zeus', country: 'BR', platform: 'PLAYSTATION' },
  { nickname: 'Nitro', country: 'BR', platform: 'XBOX' },
  { nickname: 'Vesuvio', country: 'BR', platform: 'PLAYSTATION' },
  { nickname: 'Falcao', country: 'BR', platform: 'PLAYSTATION' },
  { nickname: 'Trovao', country: 'BR', platform: 'PC' },
  { nickname: 'Astro', country: 'BR', platform: 'PLAYSTATION' },
];

/** PRNG determinístico: o mesmo seed gera sempre as mesmas campanhas. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(random: () => number, lambda: number): number {
  const limit = Math.exp(-lambda);
  let goals = 0;
  let product = random();
  while (product > limit && goals < 9) {
    goals += 1;
    product *= random();
  }
  return goals;
}

/** Método do círculo: todo par se enfrenta uma vez; ninguém joga duas vezes na mesma rodada. */
function roundRobin(ids: string[]): [string, string][][] {
  const players = [...ids];
  const rounds: [string, string][][] = [];
  for (let round = 0; round < players.length - 1; round += 1) {
    const pairs: [string, string][] = [];
    for (let index = 0; index < players.length / 2; index += 1) {
      const a = players[index] as string;
      const b = players[players.length - 1 - index] as string;
      pairs.push((round + index) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    players.splice(1, 0, players.pop() as string);
  }
  return rounds;
}

/** Instante (UTC) de um horário civil do fuso da federação, `dayOffset` dias após `baseDay`. */
function at(baseDay: Date, dayOffset: number, hour: number, minute = 0): Date {
  return new Date(
    baseDay.getTime() + dayOffset * DAY_MS + (hour * 60 + minute) * 60_000 + OFFSET_MS,
  );
}

function startOfLocalDay(now: Date): Date {
  const local = new Date(now.getTime() - OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** Imagem do hero (arquivo em apps/web/public). */
const HERO_IMAGE = '/hero/arena.jpg';

const SLOTS: [number, number][] = [
  [18, 0],
  [19, 30],
  [20, 30],
  [21, 30],
];

export async function seedPortal(prisma: PrismaClient, passwordHash: string): Promise<void> {
  const now = new Date();
  const today = startOfLocalDay(now); // meia-noite local, expressa em UTC-naïve (só para datas civis)
  const year = today.getUTCFullYear();

  if (await prisma.season.findUnique({ where: { slug: `temporada-${year}` } })) {
    // Bancos já semeados antes da imagem do hero passam a usá-la.
    await prisma.banner.updateMany({ where: { imageUrl: null }, data: { imageUrl: HERO_IMAGE } });
    console.log('= portal (temporada de demonstração já existe)');
    return;
  }

  const civil = (offsetDays: number): Date => new Date(today.getTime() + offsetDays * DAY_MS);
  const random = mulberry32(2026);

  // --- Clubes ---------------------------------------------------------------
  const clubIds: string[] = [];
  for (const club of CLUBS) {
    const created = await prisma.club.create({
      data: {
        slug: club.name
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        name: club.name,
        tag: club.tag,
        primaryColor: club.primary,
        secondaryColor: club.secondary,
        foundedOn: civil(-(400 + Math.floor(random() * 900))),
      },
    });
    clubIds.push(created.id);
  }

  // --- Jogadores (contas fictícias + perfil competitivo) -----------------------------
  const profileIds: string[] = [];
  for (const [index, player] of PLAYERS.entries()) {
    const slug = player.nickname.toLowerCase();
    const user = await prisma.user.create({
      data: {
        email: `${slug}@seed.federacao.local`,
        username: slug,
        displayName: player.nickname,
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        privacyNoticeVersion: 'seed',
        privacyNoticeAcceptedAt: new Date(),
        roles: { create: [{ role: { connect: { key: 'PLAYER' } } }] },
      },
    });
    const profile = await prisma.playerProfile.create({
      data: {
        userId: user.id,
        nickname: player.nickname,
        slug,
        country: player.country,
        platform: player.platform,
      },
    });
    profileIds.push(profile.id);
    // Os 20 primeiros têm clube (alguns clubes com dois jogadores); os demais são agentes livres.
    if (index < 20) {
      await prisma.clubMembership.create({
        data: {
          clubId: clubIds[index % clubIds.length] as string,
          playerId: profile.id,
          startedOn: civil(-(60 + Math.floor(random() * 300))),
        },
      });
    }
  }

  // Força de cada jogador (0–1), para que a tabela tenha líderes e lanternas coerentes.
  const strength = new Map(profileIds.map((id) => [id, random()]));
  const goalsFor = (attacker: string, defender: string, homeBoost: number): number => {
    const a = 0.6 + 0.9 * (strength.get(attacker) ?? 0.5);
    const d = 0.6 + 0.9 * (strength.get(defender) ?? 0.5);
    return poisson(random, Math.max(0.35, 1.45 * (a / Math.sqrt(d)) * homeBoost));
  };

  // --- Temporada e competições ------------------------------------------------
  const season = await prisma.season.create({
    data: {
      slug: `temporada-${year}`,
      name: `Temporada ${year}`,
      year,
      startsOn: new Date(Date.UTC(year, 0, 1)),
      endsOn: new Date(Date.UTC(year, 11, 31)),
      isCurrent: true,
    },
  });

  const yesterday = -1;
  const leaguePlayers = profileIds.slice(0, 16);
  const leagueRounds = roundRobin(leaguePlayers);
  const league = await prisma.competition.create({
    data: {
      seasonId: season.id,
      slug: `liga-principal-${year}`,
      name: 'Liga Principal',
      format: 'LEAGUE',
      status: 'IN_PROGRESS',
      isFeatured: true,
      maxParticipants: 16,
      roundsTotal: leagueRounds.length,
      description: 'Pontos corridos, turno único. Todos enfrentam todos.',
      startsOn: civil(yesterday - 7 * 7),
      endsOn: civil(yesterday + 7 * 7 + 6),
      entries: { create: leaguePlayers.map((playerId) => ({ playerId })) },
    },
  });

  const currentRound = 8;
  for (const [roundIndex, pairs] of leagueRounds.entries()) {
    const number = roundIndex + 1;
    const startOffset = yesterday + (number - currentRound) * 7;
    const round = await prisma.round.create({
      data: {
        competitionId: league.id,
        number,
        startsOn: civil(startOffset),
        endsOn: civil(startOffset + 6),
      },
    });
    for (const [pairIndex, [home, away]] of pairs.entries()) {
      // Rodada atual: horários fixos em relação a hoje; demais: espalhados pela semana.
      let scheduledAt: Date;
      if (number === currentRound) {
        // [dias após ontem, hora, minuto]: ontem (resultados), hoje, amanhã e os dias seguintes.
        const plan: [number, number, number][] = [
          [0, 19, 0],
          [0, 21, 0],
          [1, 18, 0],
          [1, 20, 30],
          [2, 19, 0],
          [2, 21, 0],
          [3, 20, 30],
          [4, 20, 30],
        ];
        const [day, hour, minute] = plan[pairIndex] as [number, number, number];
        scheduledAt = at(today, yesterday + day, hour, minute);
      } else {
        const [hour, minute] = SLOTS[pairIndex % SLOTS.length] as [number, number];
        scheduledAt = at(today, startOffset + (pairIndex % 7), hour, minute);
      }

      let status: MatchStatus;
      if (number < currentRound) {
        status = 'HOMOLOGATED';
      } else if (number === currentRound) {
        const minutesAhead = (scheduledAt.getTime() - now.getTime()) / 60_000;
        status =
          pairIndex < 2
            ? 'HOMOLOGATED'
            : minutesAhead < -30
              ? 'AWAITING_RESULT'
              : minutesAhead < 120
                ? 'AVAILABLE'
                : 'SCHEDULED';
      } else {
        status = 'SCHEDULED';
      }
      // Dois casos de fluxo em andamento na rodada anterior, para o painel ter o que mostrar.
      if (number === currentRound - 1 && pairIndex === 6) status = 'AWAITING_CONFIRMATION';
      if (number === currentRound - 1 && pairIndex === 7) status = 'UNDER_REVIEW';

      const decided = status === 'HOMOLOGATED';
      const homeScore = decided ? goalsFor(home, away, 1.12) : null;
      const awayScore = decided ? goalsFor(away, home, 1) : null;
      await prisma.match.create({
        data: {
          competitionId: league.id,
          roundId: round.id,
          homePlayerId: home,
          awayPlayerId: away,
          scheduledAt,
          status,
          homeScore,
          awayScore,
          homologatedAt: decided ? new Date(scheduledAt.getTime() + 25 * 60_000) : null,
        },
      });
    }
  }

  // Copa em fase de inscrição.
  const cupEntrants = [...profileIds.slice(4, 14), ...profileIds.slice(20, 23)];
  await prisma.competition.create({
    data: {
      seasonId: season.id,
      slug: `copa-federacao-${year}`,
      name: 'Copa Federação',
      format: 'KNOCKOUT',
      status: 'REGISTRATION_OPEN',
      maxParticipants: 32,
      roundsTotal: 5,
      description: 'Mata-mata em partida única. Sorteio após o encerramento das inscrições.',
      registrationClosesOn: civil(9),
      startsOn: civil(14),
      endsOn: civil(49),
      entries: { create: cupEntrants.map((playerId) => ({ playerId })) },
    },
  });

  // Liga de abertura, já encerrada.
  const openingPlayers = [
    profileIds[0],
    profileIds[3],
    profileIds[7],
    profileIds[9],
    profileIds[11],
    profileIds[15],
  ] as string[];
  const openingRounds = roundRobin(openingPlayers);
  const openingStart = -100;
  const opening = await prisma.competition.create({
    data: {
      seasonId: season.id,
      slug: `liga-de-abertura-${year}`,
      name: 'Liga de Abertura',
      format: 'LEAGUE',
      status: 'FINISHED',
      maxParticipants: 6,
      roundsTotal: openingRounds.length,
      description: 'Competição de estreia da temporada.',
      startsOn: civil(openingStart),
      endsOn: civil(openingStart + openingRounds.length * 7 - 1),
      entries: { create: openingPlayers.map((playerId) => ({ playerId })) },
    },
  });
  for (const [roundIndex, pairs] of openingRounds.entries()) {
    const startOffset = openingStart + roundIndex * 7;
    const round = await prisma.round.create({
      data: {
        competitionId: opening.id,
        number: roundIndex + 1,
        startsOn: civil(startOffset),
        endsOn: civil(startOffset + 6),
      },
    });
    for (const [pairIndex, [home, away]] of pairs.entries()) {
      const [hour, minute] = SLOTS[pairIndex % SLOTS.length] as [number, number];
      const scheduledAt = at(today, startOffset + pairIndex, hour, minute);
      await prisma.match.create({
        data: {
          competitionId: opening.id,
          roundId: round.id,
          homePlayerId: home,
          awayPlayerId: away,
          scheduledAt,
          status: 'HOMOLOGATED',
          homeScore: goalsFor(home, away, 1.12),
          awayScore: goalsFor(away, home, 1),
          homologatedAt: new Date(scheduledAt.getTime() + 25 * 60_000),
        },
      });
    }
  }

  // --- Banner e notícias ----------------------------------------------------------
  await prisma.banner.create({
    data: {
      eyebrow: `Temporada ${year}`,
      title: 'A nova era do eFootball competitivo.',
      imageUrl: HERO_IMAGE,
      subtitle: 'Compita. Suba no ranking. Construa sua história.',
      ctaLabel: 'Entrar na arena',
      ctaHref: '/cadastro',
    },
  });

  const hoursAgo = (hours: number): Date => new Date(now.getTime() - hours * 60 * 60_000);
  const news = [
    {
      slug: 'rodada-7-fecha-com-lideranca-isolada',
      title: 'Rodada 7 fecha com liderança isolada na Liga Principal',
      summary:
        'A tabela se abriu depois de uma sequência de resultados apertados. Veja como ficou o topo e quem ainda sonha com o título.',
      category: 'Resultados',
      hours: 20,
      featured: true,
    },
    {
      slug: 'inscricoes-abertas-copa-federacao',
      title: 'Inscrições abertas para a Copa Federação',
      summary:
        'Mata-mata em partida única, 32 vagas e sorteio aberto. As inscrições vão até o dia anunciado no calendário.',
      category: 'Competições',
      hours: 52,
      featured: false,
    },
    {
      slug: 'regulamento-prazo-para-confirmar-resultados',
      title: 'Regulamento: prazo para confirmar resultados',
      summary:
        'Quem joga tem até 24 horas para confirmar ou contestar o placar enviado pelo adversário. Entenda o fluxo.',
      category: 'Regulamento',
      hours: 100,
      featured: false,
    },
    {
      slug: 'liga-de-abertura-tem-campeao',
      title: 'Liga de Abertura tem campeão definido',
      summary:
        'Seis jogadores, cinco rodadas e uma decisão na última partida. Relembre a campanha que levou o troféu.',
      category: 'Competições',
      hours: 170,
      featured: false,
    },
    {
      slug: 'como-enviar-a-captura-de-tela-do-resultado',
      title: 'Como enviar a captura de tela do resultado',
      summary:
        'Sem recortes, sem edição e com a tela de resultado inteira: o passo a passo para o seu placar ser aceito de primeira.',
      category: 'Guia',
      hours: 240,
      featured: false,
    },
  ];
  for (const item of news) {
    await prisma.news.create({
      data: {
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        body: `${item.summary}\n\n(Texto de demonstração do seed.)`,
        category: item.category,
        status: 'PUBLISHED',
        publishedAt: hoursAgo(item.hours),
        isFeatured: item.featured,
      },
    });
  }
  // Rascunho e agendada: existem no banco, mas não aparecem no portal.
  await prisma.news.create({
    data: {
      slug: 'rascunho-calendario-do-segundo-semestre',
      title: 'Calendário do segundo semestre',
      summary: 'Rascunho em preparação.',
      body: 'Rascunho.',
      category: 'Comunicado',
      status: 'DRAFT',
    },
  });
  await prisma.news.create({
    data: {
      slug: 'agendada-sorteio-da-copa',
      title: 'Sorteio da Copa Federação',
      summary: 'Publicação agendada para depois do fim das inscrições.',
      body: 'Agendada.',
      category: 'Competições',
      status: 'SCHEDULED',
      publishedAt: new Date(now.getTime() + 9 * DAY_MS),
    },
  });

  console.log(
    `+ portal: ${CLUBS.length} clubes, ${PLAYERS.length} jogadores, 3 competições, ${news.length} notícias`,
  );
}
