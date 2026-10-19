import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type ApiClient, TestApp, type TestUser } from './support/test-app.js';

describe('permissões e administração de usuários', () => {
  let testApp: TestApp;
  let superAdmin: TestUser;
  let admin: TestUser;
  let player: TestUser;
  let superAdminClient: ApiClient;
  let adminClient: ApiClient;
  let playerClient: ApiClient;

  beforeAll(async () => {
    testApp = await TestApp.create();
  });

  beforeEach(async () => {
    await testApp.reset();
    superAdmin = await testApp.seedUser({ roles: ['SUPER_ADMIN'], mfa: true });
    admin = await testApp.seedUser({ roles: ['ADMIN'], mfa: true });
    player = await testApp.seedUser();
    superAdminClient = await testApp.login(superAdmin);
    adminClient = await testApp.login(admin);
    playerClient = await testApp.login(player);
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('acesso', () => {
    it('nega as rotas administrativas a visitantes e a jogadores', async () => {
      for (const path of ['/admin/users', '/admin/audit-logs', '/admin/dashboard/summary']) {
        await testApp.client().get(path).expect(401);
        const response = await playerClient.get(path).expect(403);
        expect(response.body.code).toBe('FORBIDDEN');
      }
    });

    it('ignora papéis ou permissões enviados pelo cliente', async () => {
      await playerClient
        .get('/admin/users')
        .set('X-Roles', 'SUPER_ADMIN')
        .set('X-Permissions', 'users.read')
        .query({ role: 'SUPER_ADMIN', roles: 'SUPER_ADMIN' })
        .expect(403);
    });

    it('bloqueia o administrador que ainda não cadastrou o MFA', async () => {
      const withoutMfa = await testApp.seedUser({ roles: ['ADMIN'] });
      const client = await testApp.login(withoutMfa);

      const me = await client.get('/auth/me').expect(200);
      expect(me.body.data.account).toMatchObject({ mfaEnrollmentRequired: true, permissions: [] });

      const response = await client.get('/admin/users').expect(403);
      expect(response.body.code).toBe('MFA_ENROLLMENT_REQUIRED');
    });

    it('libera o administrador com MFA e expõe suas permissões', async () => {
      await adminClient.get('/admin/users').expect(200);
      const me = await adminClient.get('/auth/me').expect(200);
      expect(me.body.data.account.permissions).toEqual(
        expect.arrayContaining(['admin.access', 'users.read', 'audit.read']),
      );
    });

    it('passa a valer imediatamente quando um papel é revogado', async () => {
      await adminClient.get('/admin/users').expect(200);
      await superAdminClient
        .put(`/admin/users/${admin.id}/roles`, { roles: ['PLAYER'] })
        .expect(200);
      await adminClient.get('/admin/users').expect(403);
    });
  });

  describe('listagem', () => {
    it('pagina, filtra e busca usuários sem expor dados sensíveis', async () => {
      const page = await adminClient.get('/admin/users').query({ pageSize: 2 }).expect(200);
      expect(page.body.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
      expect(page.body.data).toHaveLength(2);
      expect(JSON.stringify(page.body)).not.toMatch(/passwordHash|password_hash|argon2/);

      const admins = await adminClient.get('/admin/users').query({ role: 'ADMIN' }).expect(200);
      expect(admins.body.data.map((user: { id: string }) => user.id)).toEqual([admin.id]);

      const search = await adminClient
        .get('/admin/users')
        .query({ search: player.username })
        .expect(200);
      expect(search.body.data).toHaveLength(1);
      expect(search.body.data[0]).toMatchObject({
        id: player.id,
        roles: ['PLAYER'],
        mfaEnabled: false,
      });
    });

    it('rejeita parâmetros de consulta inválidos', async () => {
      await adminClient.get('/admin/users').query({ pageSize: 1000 }).expect(400);
      await adminClient.get('/admin/users').query({ sortBy: 'passwordHash' }).expect(400);
    });

    it('trata identificador malformado como recurso inexistente', async () => {
      await adminClient.get('/admin/users/nao-e-uuid').expect(404);
    });
  });

  describe('papéis', () => {
    it('permite ao administrador conceder papéis operacionais', async () => {
      const response = await adminClient
        .put(`/admin/users/${player.id}/roles`, { roles: ['PLAYER', 'REFEREE'] })
        .expect(200);
      expect(response.body.data.roles).toEqual(expect.arrayContaining(['PLAYER', 'REFEREE']));

      const grant = await testApp.prisma.userRole.findFirstOrThrow({
        where: { userId: player.id, role: { key: 'REFEREE' } },
      });
      expect(grant.grantedById).toBe(admin.id);
    });

    it('impede o administrador de conceder papéis administrativos', async () => {
      const response = await adminClient
        .put(`/admin/users/${player.id}/roles`, { roles: ['PLAYER', 'ADMIN'] })
        .expect(403);
      expect(response.body.code).toBe('FORBIDDEN');
      const roles = await testApp.prisma.userRole.count({ where: { userId: player.id } });
      expect(roles).toBe(1);
    });

    it('impede o administrador de alterar outro administrador ou um superadministrador', async () => {
      const otherAdmin = await testApp.seedUser({ roles: ['ADMIN'], mfa: true });
      await adminClient
        .put(`/admin/users/${otherAdmin.id}/roles`, { roles: ['PLAYER'] })
        .expect(403);
      await adminClient
        .put(`/admin/users/${superAdmin.id}/roles`, { roles: ['PLAYER'] })
        .expect(403);
    });

    it('impede qualquer pessoa de alterar os próprios papéis', async () => {
      await adminClient.put(`/admin/users/${admin.id}/roles`, { roles: ['PLAYER'] }).expect(403);
      await superAdminClient
        .put(`/admin/users/${superAdmin.id}/roles`, { roles: ['PLAYER'] })
        .expect(403);
    });

    it('permite ao superadministrador promover e rebaixar administradores', async () => {
      await superAdminClient
        .put(`/admin/users/${player.id}/roles`, { roles: ['PLAYER', 'ADMIN'] })
        .expect(200);
      await superAdminClient
        .put(`/admin/users/${player.id}/roles`, { roles: ['PLAYER'] })
        .expect(200);
    });

    it('audita a alteração de papéis com o que foi concedido e revogado', async () => {
      await superAdminClient
        .put(`/admin/users/${player.id}/roles`, { roles: ['ORGANIZER'] })
        .expect(200);

      const log = await testApp.prisma.auditLog.findFirstOrThrow({
        where: { action: 'admin.user.roles_changed' },
      });
      expect(log).toMatchObject({
        actorUserId: superAdmin.id,
        entityType: 'user',
        entityId: player.id,
      });
      expect(log.metadata).toEqual({ added: ['ORGANIZER'], removed: ['PLAYER'] });
    });
  });

  describe('suspensão', () => {
    it('suspende a conta, encerra as sessões e bloqueia novos logins', async () => {
      const response = await adminClient
        .patch(`/admin/users/${player.id}/status`, {
          status: 'SUSPENDED',
          reason: 'Conduta antidesportiva',
        })
        .expect(200);
      expect(response.body.data.status).toBe('SUSPENDED');

      await playerClient.get('/auth/me').expect(401);
      const login = await testApp
        .client()
        .post('/auth/login', { identifier: player.email, password: player.password })
        .expect(403);
      expect(login.body.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('reativa a conta e registra o motivo de cada mudança', async () => {
      await adminClient
        .patch(`/admin/users/${player.id}/status`, {
          status: 'SUSPENDED',
          reason: 'Conduta antidesportiva',
        })
        .expect(200);
      await adminClient
        .patch(`/admin/users/${player.id}/status`, {
          status: 'ACTIVE',
          reason: 'Suspensão cumprida',
        })
        .expect(200);

      await testApp
        .client()
        .post('/auth/login', { identifier: player.email, password: player.password })
        .expect(200);

      const logs = await testApp.prisma.auditLog.findMany({
        where: { action: 'admin.user.status_changed' },
        orderBy: { occurredAt: 'asc' },
      });
      expect(logs.map((log) => (log.metadata as { reason: string }).reason)).toEqual([
        'Conduta antidesportiva',
        'Suspensão cumprida',
      ]);
    });

    it('exige motivo e recusa transições inválidas', async () => {
      await adminClient
        .patch(`/admin/users/${player.id}/status`, { status: 'SUSPENDED' })
        .expect(400);
      const response = await adminClient
        .patch(`/admin/users/${player.id}/status`, { status: 'ACTIVE', reason: 'Já está ativa' })
        .expect(409);
      expect(response.body.code).toBe('CONFLICT');
    });

    it('impede suspender a si mesmo ou a contas de nível igual ou superior', async () => {
      const body = { status: 'SUSPENDED', reason: 'Tentativa indevida' };
      await adminClient.patch(`/admin/users/${admin.id}/status`, body).expect(403);
      await adminClient.patch(`/admin/users/${superAdmin.id}/status`, body).expect(403);
      await superAdminClient.patch(`/admin/users/${superAdmin.id}/status`, body).expect(403);
    });
  });

  describe('auditoria e indicadores', () => {
    it('lista eventos de auditoria com filtro por ação e identifica o autor', async () => {
      await adminClient
        .patch(`/admin/users/${player.id}/status`, {
          status: 'SUSPENDED',
          reason: 'Conduta antidesportiva',
        })
        .expect(200);

      const response = await adminClient
        .get('/admin/audit-logs')
        .query({ action: 'admin.user' })
        .expect(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        action: 'admin.user.status_changed',
        actor: { id: admin.id, username: admin.username },
        entityId: player.id,
      });
    });

    it('calcula os indicadores do dashboard a partir do banco', async () => {
      await testApp.seedUser({ roles: ['ADMIN'] });
      await testApp.seedUser({ status: 'PENDING_VERIFICATION' });
      await testApp
        .client()
        .post('/auth/login', { identifier: player.email, password: 'errada' })
        .expect(401);

      const { data } = (await adminClient.get('/admin/dashboard/summary').expect(200)).body;
      expect(data.users.total).toBe(5);
      expect(data.users.byStatus).toMatchObject({
        ACTIVE: 4,
        PENDING_VERIFICATION: 1,
        SUSPENDED: 0,
      });
      expect(data.users.registeredLast7Days).toBe(5);
      expect(data.roles).toMatchObject({ SUPER_ADMIN: 1, ADMIN: 2, PLAYER: 2 });
      expect(data.security).toEqual({
        activeSessions: 3,
        adminsWithoutMfa: 1,
        failedLoginsLast24h: 1,
      });
      expect(data.registrationsByDay).toHaveLength(14);
      expect(data.registrationsByDay.at(-1).count).toBe(5);
    });
  });
});
