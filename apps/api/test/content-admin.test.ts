import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type ApiClient, TestApp, type TestUser } from './support/test-app.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const news = {
  title: 'Abertas as inscrições da Copa',
  summary: 'A federação abriu as inscrições para a nova Copa.',
  body: 'As inscrições vão até o fim do mês. Leia o regulamento antes de se inscrever.',
  category: 'Competições',
  status: 'DRAFT',
  publishedAt: null as string | null,
  isFeatured: false,
};

const banner = {
  eyebrow: 'Temporada 2026',
  title: 'A Liga começou',
  subtitle: null as string | null,
  ctaLabel: 'Ver clubes' as string | null,
  ctaHref: '/clubes' as string | null,
  isActive: true,
  startsAt: null as string | null,
  endsAt: null as string | null,
};

describe('painel de conteúdo, configurações e jogadores', () => {
  let testApp: TestApp;
  let superAdmin: TestUser;
  let superClient: ApiClient;
  let adminClient: ApiClient;
  let playerClient: ApiClient;
  const publicGet = (path: string) =>
    request(testApp.app.getHttpServer()).get(`/api/v1${path}`).expect(200);

  beforeAll(async () => {
    testApp = await TestApp.create();
  });

  beforeEach(async () => {
    await testApp.reset();
    superAdmin = await testApp.seedUser({ roles: ['SUPER_ADMIN'], mfa: true });
    superClient = await testApp.login(superAdmin);
    adminClient = await testApp.login(await testApp.seedUser({ roles: ['ADMIN'], mfa: true }));
    playerClient = await testApp.login(await testApp.seedUser());
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('nega o painel a jogadores e as configurações a quem não é superadministrador', async () => {
    for (const path of [
      '/admin/news',
      '/admin/banners',
      '/admin/featured-competition',
      '/admin/players',
      '/admin/settings',
    ]) {
      await playerClient.get(path).expect(403);
    }
    await adminClient.get('/admin/news').expect(200);
    await adminClient.get('/admin/settings').expect(403);
    await adminClient.put('/admin/settings', { federationName: 'Outra' }).expect(403);
  });

  describe('configurações', () => {
    it('usa o nome provisório até ser alterado, e o novo nome vai para portal e e-mails', async () => {
      const before = await publicGet('/public/settings');
      expect(before.body.data).toEqual({ federationName: 'Federação eFootball 1x1' });

      await superClient.put('/admin/settings', { federationName: 'x' }).expect(400);
      const saved = await superClient
        .put('/admin/settings', { federationName: '  Liga Nordeste de eFootball ' })
        .expect(200);
      expect(saved.body.data.federationName).toBe('Liga Nordeste de eFootball');

      const after = await publicGet('/public/settings');
      expect(after.body.data.federationName).toBe('Liga Nordeste de eFootball');

      const event = await testApp.prisma.auditLog.findFirstOrThrow({
        where: { action: 'settings.updated' },
      });
      expect(event.metadata).toEqual({
        federationName: { from: 'Federação eFootball 1x1', to: 'Liga Nordeste de eFootball' },
      });

      const player = await testApp.seedUser();
      await testApp.client().post('/auth/password/forgot', { email: player.email }).expect(202);
      const mail = testApp.mailer.lastTo(player.email);
      expect(mail.text).toContain('— Liga Nordeste de eFootball');
      expect(mail.html).toContain('Liga Nordeste de eFootball');
    });
  });

  describe('notícias', () => {
    it('só aparece no portal depois de publicada', async () => {
      const draft = await adminClient.post('/admin/news', news).expect(201);
      expect(draft.body.data).toMatchObject({
        slug: 'abertas-as-inscricoes-da-copa',
        status: 'DRAFT',
        publishedAt: null,
        isLive: false,
      });
      let home = await publicGet('/public/home');
      expect(home.body.data.news).toEqual([]);
      expect(home.body.data.featuredNews).toBeNull();

      const published = await adminClient
        .put(`/admin/news/${draft.body.data.id}`, {
          ...news,
          status: 'PUBLISHED',
          title: 'Novo título da notícia',
        })
        .expect(200);
      expect(published.body.data).toMatchObject({
        slug: 'abertas-as-inscricoes-da-copa',
        status: 'PUBLISHED',
        isLive: true,
      });
      const firstPublishedAt = published.body.data.publishedAt;
      expect(firstPublishedAt).not.toBeNull();

      home = await publicGet('/public/home');
      expect(home.body.data.featuredNews.slug).toBe('abertas-as-inscricoes-da-copa');

      // Salvar de novo não muda a data de publicação.
      const again = await adminClient
        .put(`/admin/news/${draft.body.data.id}`, {
          ...news,
          status: 'PUBLISHED',
          summary: 'Resumo atualizado da notícia.',
        })
        .expect(200);
      expect(again.body.data.publishedAt).toBe(firstPublishedAt);

      const events = await testApp.prisma.auditLog.findMany({
        where: { entityType: 'news' },
        select: { action: true },
      });
      expect(events.map((e) => e.action).sort()).toEqual([
        'news.created',
        'news.updated',
        'news.updated',
      ]);
    });

    it('agenda para o futuro e exige data ao agendar', async () => {
      const noDate = await adminClient
        .post('/admin/news', { ...news, status: 'SCHEDULED' })
        .expect(400);
      expect(noDate.body.errors[0].path).toBe('publishedAt');

      const future = new Date(Date.now() + 2 * DAY_MS).toISOString();
      const scheduled = await adminClient
        .post('/admin/news', { ...news, status: 'SCHEDULED', publishedAt: future })
        .expect(201);
      expect(scheduled.body.data.isLive).toBe(false);
      const home = await publicGet('/public/home');
      expect(home.body.data.news).toEqual([]);

      const list = await adminClient.get('/admin/news?status=SCHEDULED').expect(200);
      expect(list.body.meta.total).toBe(1);
    });

    it('gera outra URL para título repetido', async () => {
      const first = await adminClient.post('/admin/news', news).expect(201);
      const second = await adminClient.post('/admin/news', news).expect(201);
      expect(second.body.data.slug).not.toBe(first.body.data.slug);
      expect(second.body.data.slug).toMatch(/^abertas-as-inscricoes-da-copa-[0-9a-f]{6}$/);
    });
  });

  describe('banners e destaque', () => {
    it('recusa destino perigoso e controla o banner exibido na HOME', async () => {
      for (const ctaHref of ['javascript:alert(1)', '//evil.example', 'http://inseguro.example']) {
        const refused = await adminClient
          .post('/admin/banners', { ...banner, ctaHref })
          .expect(400);
        expect(refused.body.errors[0].path).toBe('ctaHref');
      }
      await adminClient
        .post('/admin/banners', { ...banner, ctaLabel: null, ctaHref: '/clubes' })
        .expect(400);

      const created = await adminClient.post('/admin/banners', banner).expect(201);
      expect(created.body.data.isShowing).toBe(true);
      let home = await publicGet('/public/home');
      expect(home.body.data.banner).toMatchObject({ title: 'A Liga começou', ctaHref: '/clubes' });

      await adminClient
        .put(`/admin/banners/${created.body.data.id}`, { ...banner, isActive: false })
        .expect(200);
      home = await publicGet('/public/home');
      expect(home.body.data.banner).toBeNull();

      await adminClient
        .post('/admin/banners', {
          ...banner,
          startsAt: new Date(Date.now() + DAY_MS).toISOString(),
          endsAt: new Date(Date.now() - DAY_MS).toISOString(),
        })
        .expect(400);
    });

    it('troca a competição em destaque, só entre as publicadas', async () => {
      const season = await testApp.prisma.season.create({
        data: {
          slug: 's',
          name: 'Temporada',
          year: 2026,
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      });
      const base = { seasonId: season.id, format: 'LEAGUE' as const, maxParticipants: 8 };
      const live = await testApp.prisma.competition.create({
        data: { ...base, slug: 'liga', name: 'Liga', status: 'IN_PROGRESS', isFeatured: true },
      });
      const cup = await testApp.prisma.competition.create({
        data: { ...base, slug: 'copa', name: 'Copa', status: 'REGISTRATION_OPEN' },
      });
      const draft = await testApp.prisma.competition.create({
        data: { ...base, slug: 'rascunho', name: 'Rascunho', status: 'DRAFT' },
      });

      const options = await adminClient.get('/admin/featured-competition').expect(200);
      expect(options.body.data.map((o: { id: string }) => o.id).sort()).toEqual(
        [live.id, cup.id].sort(),
      );

      await adminClient.put('/admin/featured-competition', { competitionId: draft.id }).expect(400);
      await adminClient.put('/admin/featured-competition', { competitionId: cup.id }).expect(200);
      let home = await publicGet('/public/home');
      expect(home.body.data.featuredCompetition.slug).toBe('copa');
      expect(await testApp.prisma.competition.count({ where: { isFeatured: true } })).toBe(1);

      await adminClient.put('/admin/featured-competition', { competitionId: null }).expect(200);
      home = await publicGet('/public/home');
      expect(home.body.data.featuredCompetition).toBeNull();
    });
  });

  describe('gestão de jogadores', () => {
    it('corrige o perfil com motivo e modera o avatar', async () => {
      const owner = await testApp.seedUser();
      const other = await testApp.seedUser();
      const profile = await testApp.prisma.playerProfile.create({
        data: {
          userId: owner.id,
          nickname: 'Apelido Ruim',
          slug: owner.username,
          country: 'BR',
          platform: 'PC',
          efootballId: 'ORIGINAL-1',
          avatarKey: 'avatars/00000000-0000-0000-0000-000000000001.webp',
        },
      });
      await testApp.prisma.playerProfile.create({
        data: {
          userId: other.id,
          nickname: 'Outro',
          slug: other.username,
          country: 'BR',
          platform: 'PC',
          efootballId: 'OCUPADO-1',
        },
      });

      const found = await adminClient.get('/admin/players?search=original').expect(200);
      expect(found.body.data).toHaveLength(1);
      expect(found.body.data[0].user.username).toBe(owner.username);

      const input = {
        nickname: 'Apelido Bom',
        efootballId: 'ORIGINAL-1',
        platform: 'PC',
        country: 'BR',
        region: null,
      };
      await adminClient.put(`/admin/players/${profile.id}`, input).expect(400);
      const conflict = await adminClient
        .put(`/admin/players/${profile.id}`, {
          ...input,
          efootballId: 'ocupado-1',
          reason: 'Correção.',
        })
        .expect(409);
      expect(conflict.body.code).toBe('EFOOTBALL_ID_TAKEN');

      const fixed = await adminClient
        .put(`/admin/players/${profile.id}`, { ...input, reason: 'Apelido ofensivo.' })
        .expect(200);
      expect(fixed.body.data.nickname).toBe('Apelido Bom');
      const event = await testApp.prisma.auditLog.findFirstOrThrow({
        where: { action: 'admin.player.updated' },
      });
      expect(event.metadata).toEqual({ fields: ['nickname'], reason: 'Apelido ofensivo.' });

      const removed = await adminClient.delete(`/admin/players/${profile.id}/avatar`).expect(200);
      expect(removed.body.data.avatarUrl).toBeNull();
      expect(
        await testApp.prisma.auditLog.count({ where: { action: 'admin.player.avatar_removed' } }),
      ).toBe(1);
    });
  });
});
