import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type ApiClient, TestApp, type TestUser } from './support/test-app.js';

const clubInput = {
  name: 'Esporte Clube São João',
  tag: 'ecsj',
  primaryColor: '#0a5c36',
  secondaryColor: '#F2C94C',
  foundedOn: '2020-03-01',
  status: 'ACTIVE',
  managerUsername: null as string | null,
};

describe('clubes, vínculos e transferências', () => {
  let testApp: TestApp;
  let admin: TestUser;
  let adminClient: ApiClient;
  let player: TestUser;
  let playerClient: ApiClient;
  let playerProfileId: string;

  async function createProfile(user: TestUser): Promise<string> {
    const profile = await testApp.prisma.playerProfile.create({
      data: {
        userId: user.id,
        nickname: user.username,
        slug: user.username,
        country: 'BR',
        platform: 'PLAYSTATION',
        efootballId: `ID-${user.username}`,
      },
    });
    return profile.id;
  }

  async function createClub(overrides: Partial<typeof clubInput> = {}) {
    const response = await adminClient.post('/admin/clubs', { ...clubInput, ...overrides });
    expect(response.status).toBe(201);
    return response.body.data as { id: string; slug: string };
  }

  beforeAll(async () => {
    testApp = await TestApp.create();
  });

  beforeEach(async () => {
    await testApp.reset();
    admin = await testApp.seedUser({ roles: ['ADMIN'], mfa: true });
    adminClient = await testApp.login(admin);
    player = await testApp.seedUser();
    playerClient = await testApp.login(player);
    playerProfileId = await createProfile(player);
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('administração de clubes', () => {
    it('nega a gestão a visitantes e jogadores', async () => {
      for (const path of ['/admin/clubs', '/admin/transfers']) {
        await testApp.client().get(path).expect(401);
        const denied = await playerClient.get(path).expect(403);
        expect(denied.body.code).toBe('FORBIDDEN');
      }
      await playerClient.post('/admin/clubs', clubInput).expect(403);
    });

    it('cadastra com URL gerada do nome e sigla normalizada, e audita', async () => {
      const manager = await testApp.seedUser();
      const response = await adminClient
        .post('/admin/clubs', { ...clubInput, managerUsername: manager.username.toUpperCase() })
        .expect(201);
      expect(response.body.data).toMatchObject({
        slug: 'esporte-clube-sao-joao',
        tag: 'ECSJ',
        primaryColor: '#0A5C36',
        status: 'ACTIVE',
        foundedOn: '2020-03-01',
        crestUrl: null,
        members: 0,
        manager: { id: manager.id, username: manager.username },
      });

      // Mesmo nome: outra URL, nunca uma colisão.
      const twin = await adminClient
        .post('/admin/clubs', { ...clubInput, tag: 'ECS2' })
        .expect(201);
      expect(twin.body.data.slug).toBe('esporte-clube-sao-joao-2');

      const audit = await testApp.prisma.auditLog.count({ where: { action: 'club.created' } });
      expect(audit).toBe(2);
    });

    it('valida campos, sigla repetida e responsável inexistente', async () => {
      await createClub();
      const invalid = await adminClient
        .post('/admin/clubs', {
          ...clubInput,
          name: 'x',
          tag: 'TOOLONG',
          primaryColor: 'verde',
          status: 'FECHADO',
        })
        .expect(400);
      const paths = invalid.body.errors.map((error: { path: string }) => error.path);
      expect(paths).toEqual(expect.arrayContaining(['name', 'tag', 'primaryColor', 'status']));

      const duplicate = await adminClient
        .post('/admin/clubs', { ...clubInput, name: 'Outro Clube' })
        .expect(400);
      expect(duplicate.body.errors).toEqual([{ path: 'tag', message: expect.any(String) }]);

      const noManager = await adminClient
        .post('/admin/clubs', { ...clubInput, tag: 'XYZ', managerUsername: 'ninguem' })
        .expect(400);
      expect(noManager.body.errors[0].path).toBe('managerUsername');
    });

    it('altera o clube sem mudar a URL pública', async () => {
      const club = await createClub();
      const updated = await adminClient
        .put(`/admin/clubs/${club.id}`, {
          ...clubInput,
          name: 'EC São João Novo',
          status: 'INACTIVE',
        })
        .expect(200);
      expect(updated.body.data).toMatchObject({
        slug: 'esporte-clube-sao-joao',
        name: 'EC São João Novo',
        status: 'INACTIVE',
      });
      const event = await testApp.prisma.auditLog.findFirstOrThrow({
        where: { action: 'club.updated' },
      });
      expect(event.metadata).toEqual({ fields: ['name', 'status'] });

      await adminClient.put('/admin/clubs/nao-e-uuid', clubInput).expect(404);
    });

    it('envia e remove o escudo, recusando o que não é imagem', async () => {
      const club = await createClub();
      const png = await sharp({
        create: { width: 300, height: 120, channels: 4, background: '#0A5C36' },
      })
        .png()
        .toBuffer();
      const uploaded = await adminClient.upload(`/admin/clubs/${club.id}/crest`, png).expect(201);
      expect(uploaded.body.data.crestUrl).toMatch(/^\/api\/v1\/media\/crests\/.+\.webp$/);
      await testApp
        .client()
        .get(uploaded.body.data.crestUrl.replace('/api/v1', ''))
        .expect(200)
        .expect('Content-Type', 'image/webp');

      await adminClient
        .upload(`/admin/clubs/${club.id}/crest`, Buffer.from('<svg/>'), 'escudo.png')
        .expect(400);

      const removed = await adminClient.delete(`/admin/clubs/${club.id}/crest`).expect(200);
      expect(removed.body.data.crestUrl).toBeNull();
    });
  });

  describe('transferências', () => {
    it('percorre jogador → responsável do clube → federação e cria o vínculo', async () => {
      const manager = await testApp.seedUser();
      const managerClient = await testApp.login(manager);
      const club = await createClub({ managerUsername: manager.username });

      const requested = await playerClient
        .post('/me/transfers', { toClubSlug: club.slug, note: 'Quero jogar com vocês.' })
        .expect(201);
      expect(requested.body.data).toMatchObject({
        status: 'PENDING_CLUB',
        fromClub: null,
        toClub: { slug: club.slug },
        note: 'Quero jogar com vocês.',
      });
      const id: string = requested.body.data.id;

      // A federação ainda não decide, e só o responsável vê e aceita o pedido.
      await adminClient.post(`/admin/transfers/${id}/approve`).expect(409);
      const outsider = await testApp.login(await testApp.seedUser());
      await outsider.post(`/me/club-requests/${id}/accept`).expect(403);
      const outsiderList = await outsider.get('/me/club-requests').expect(200);
      expect(outsiderList.body.data).toEqual([]);

      const pending = await managerClient.get('/me/club-requests').expect(200);
      expect(pending.body.data.map((t: { id: string }) => t.id)).toEqual([id]);
      const accepted = await managerClient.post(`/me/club-requests/${id}/accept`).expect(200);
      expect(accepted.body.data.status).toBe('PENDING_ADMIN');

      const queue = await adminClient.get('/admin/transfers').expect(200);
      expect(queue.body.meta.total).toBe(1);
      const approved = await adminClient.post(`/admin/transfers/${id}/approve`).expect(200);
      expect(approved.body.data.status).toBe('APPROVED');

      const mine = await playerClient.get('/me/club').expect(200);
      expect(mine.body.data.current).toMatchObject({ club: { slug: club.slug }, endedOn: null });
      expect(mine.body.data.openTransfer).toBeNull();
      expect(mine.body.data.recentTransfers[0]).toMatchObject({ id, status: 'APPROVED' });

      const actions = await testApp.prisma.auditLog.findMany({
        where: { entityType: 'transfer', entityId: id },
        orderBy: { occurredAt: 'asc' },
        select: { action: true },
      });
      expect(actions.map((a) => a.action)).toEqual([
        'transfer.requested',
        'transfer.club_accepted',
        'transfer.approved',
      ]);
    });

    it('troca de clube encerra o vínculo anterior sem alterar o passado', async () => {
      const origin = await createClub({ name: 'Clube Origem', tag: 'ORI' });
      const target = await createClub({ name: 'Clube Destino', tag: 'DES' });
      const old = await testApp.prisma.clubMembership.create({
        data: {
          clubId: origin.id,
          playerId: playerProfileId,
          startedOn: new Date('2024-01-10T00:00:00.000Z'),
        },
      });
      // Um vínculo ainda mais antigo, já encerrado, que não pode ser tocado.
      const ancient = await testApp.prisma.clubMembership.create({
        data: {
          clubId: target.id,
          playerId: playerProfileId,
          startedOn: new Date('2022-01-01T00:00:00.000Z'),
          endedOn: new Date('2023-01-01T00:00:00.000Z'),
        },
      });

      const requested = await playerClient
        .post('/me/transfers', { toClubSlug: target.slug, note: null })
        .expect(201);
      expect(requested.body.data).toMatchObject({
        status: 'PENDING_ADMIN',
        fromClub: { slug: origin.slug },
      });
      await adminClient.post(`/admin/transfers/${requested.body.data.id}/approve`).expect(200);

      const memberships = await testApp.prisma.clubMembership.findMany({
        where: { playerId: playerProfileId },
        orderBy: { startedOn: 'asc' },
      });
      expect(memberships).toHaveLength(3);
      const [first, second, third] = memberships;
      expect(first).toEqual(ancient);
      expect(second?.id).toBe(old.id);
      expect(second?.startedOn).toEqual(old.startedOn);
      expect(second?.endedOn).not.toBeNull();
      expect(third).toMatchObject({ clubId: target.id, endedOn: null });
      expect(third?.startedOn).toEqual(second?.endedOn);

      const mine = await playerClient.get('/me/club').expect(200);
      expect(mine.body.data.history.map((m: { club: { slug: string } }) => m.club.slug)).toEqual([
        origin.slug,
        target.slug,
      ]);
    });

    it('aceita um pedido em aberto por vez e recusa clube atual ou inativo', async () => {
      const first = await createClub({ name: 'Primeiro', tag: 'PRI' });
      const second = await createClub({ name: 'Segundo', tag: 'SEG' });
      const closed = await createClub({ name: 'Fechado', tag: 'FEC', status: 'INACTIVE' });

      await playerClient.post('/me/transfers', { toClubSlug: first.slug, note: null }).expect(201);
      const twice = await playerClient
        .post('/me/transfers', { toClubSlug: second.slug, note: null })
        .expect(409);
      expect(twice.body.detail).toMatch(/em aberto/);

      const other = await testApp.seedUser();
      const otherClient = await testApp.login(other);
      const otherProfile = await createProfile(other);
      await testApp.prisma.clubMembership.create({
        data: { clubId: second.id, playerId: otherProfile, startedOn: new Date() },
      });
      const same = await otherClient
        .post('/me/transfers', { toClubSlug: second.slug, note: null })
        .expect(409);
      expect(same.body.detail).toMatch(/já faz parte/);
      await otherClient.post('/me/transfers', { toClubSlug: closed.slug, note: null }).expect(409);
      const unknown = await otherClient
        .post('/me/transfers', { toClubSlug: 'nao-existe', note: null })
        .expect(400);
      expect(unknown.body.errors[0].path).toBe('toClubSlug');
    });

    it('aprovações simultâneas produzem um único vínculo', async () => {
      const club = await createClub();
      const requested = await playerClient
        .post('/me/transfers', { toClubSlug: club.slug, note: null })
        .expect(201);
      const id: string = requested.body.data.id;

      const results = await Promise.all(
        Array.from({ length: 5 }, () => adminClient.post(`/admin/transfers/${id}/approve`)),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409, 409, 409]);
      const active = await testApp.prisma.clubMembership.count({
        where: { playerId: playerProfileId, endedOn: null },
      });
      expect(active).toBe(1);
      const approvals = await testApp.prisma.auditLog.count({
        where: { action: 'transfer.approved' },
      });
      expect(approvals).toBe(1);
    });

    it('não aprova para um clube que ficou inativo, e o pedido continua em aberto', async () => {
      const club = await createClub();
      const requested = await playerClient
        .post('/me/transfers', { toClubSlug: club.slug, note: null })
        .expect(201);
      await adminClient.put(`/admin/clubs/${club.id}`, { ...clubInput, status: 'INACTIVE' });

      await adminClient.post(`/admin/transfers/${requested.body.data.id}/approve`).expect(409);
      const transfer = await testApp.prisma.clubTransfer.findUniqueOrThrow({
        where: { id: requested.body.data.id },
      });
      expect(transfer.status).toBe('PENDING_ADMIN');
      expect(await testApp.prisma.clubMembership.count()).toBe(0);
    });

    it('recusa com motivo, pelo clube ou pela federação, e permite cancelar só o próprio', async () => {
      const manager = await testApp.seedUser();
      const managerClient = await testApp.login(manager);
      const managed = await createClub({ managerUsername: manager.username });
      const open = await createClub({ name: 'Aberto', tag: 'ABE' });

      const toManaged = await playerClient
        .post('/me/transfers', { toClubSlug: managed.slug, note: null })
        .expect(201);
      await managerClient
        .post(`/me/club-requests/${toManaged.body.data.id}/reject`, {})
        .expect(400);
      const byClub = await managerClient
        .post(`/me/club-requests/${toManaged.body.data.id}/reject`, { reason: 'Elenco completo.' })
        .expect(200);
      expect(byClub.body.data).toMatchObject({
        status: 'REJECTED',
        decisionReason: 'Elenco completo.',
      });

      const toOpen = await playerClient
        .post('/me/transfers', { toClubSlug: open.slug, note: null })
        .expect(201);
      const byAdmin = await adminClient
        .post(`/admin/transfers/${toOpen.body.data.id}/reject`, {
          reason: 'Documentação pendente.',
        })
        .expect(200);
      expect(byAdmin.body.data.status).toBe('REJECTED');
      await adminClient.post(`/admin/transfers/${toOpen.body.data.id}/approve`).expect(409);

      const again = await playerClient
        .post('/me/transfers', { toClubSlug: open.slug, note: null })
        .expect(201);
      const stranger = await testApp.login(await testApp.seedUser());
      await createProfile(await testApp.seedUser());
      await stranger.post(`/me/transfers/${again.body.data.id}/cancel`).expect(404);
      const canceled = await playerClient
        .post(`/me/transfers/${again.body.data.id}/cancel`)
        .expect(200);
      expect(canceled.body.data.status).toBe('CANCELED');
      await playerClient.post(`/me/transfers/${again.body.data.id}/cancel`).expect(409);
    });

    it('sai do clube encerrando o vínculo, mas não com pedido em aberto', async () => {
      const club = await createClub();
      const other = await createClub({ name: 'Outro', tag: 'OUT' });
      await playerClient.post('/me/club/leave').expect(409);
      await testApp.prisma.clubMembership.create({
        data: {
          clubId: club.id,
          playerId: playerProfileId,
          startedOn: new Date('2024-05-01T00:00:00.000Z'),
        },
      });

      const pending = await playerClient
        .post('/me/transfers', { toClubSlug: other.slug, note: null })
        .expect(201);
      await playerClient.post('/me/club/leave').expect(409);
      await playerClient.post(`/me/transfers/${pending.body.data.id}/cancel`).expect(200);

      const left = await playerClient.post('/me/club/leave').expect(200);
      expect(left.body.data.current).toBeNull();
      expect(left.body.data.history).toHaveLength(1);
      expect(left.body.data.history[0]).toMatchObject({
        club: { slug: club.slug },
        startedOn: '2024-05-01',
      });
    });

    it('jogador sem perfil não pede transferência', async () => {
      const club = await createClub();
      const noProfile = await testApp.login(await testApp.seedUser());
      const club0 = await noProfile.get('/me/club').expect(200);
      expect(club0.body.data).toEqual({
        current: null,
        history: [],
        openTransfer: null,
        recentTransfers: [],
      });
      await noProfile.post('/me/transfers', { toClubSlug: club.slug, note: null }).expect(404);
    });
  });
});
