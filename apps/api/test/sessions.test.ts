import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/infra/crypto/tokens.js';
import { sessionCookie, TestApp } from './support/test-app.js';

describe('login e sessões', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await TestApp.create();
  });

  beforeEach(async () => {
    await testApp.reset();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('emite um cookie HttpOnly, SameSite=Lax e guarda apenas o hash do token', async () => {
    const user = await testApp.seedUser();
    const response = await testApp
      .client()
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(200);

    const cookie = sessionCookie(response);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);

    const token = /efed_session=([^;]+)/.exec(cookie ?? '')?.[1] ?? '';
    const session = await testApp.prisma.session.findFirstOrThrow();
    expect(session.tokenHash).toBe(sha256Hex(token));
    expect(JSON.stringify(response.body)).not.toContain(token);
  });

  it('retorna a conta autenticada e recusa requisições sem sessão', async () => {
    const user = await testApp.seedUser();
    const client = await testApp.login(user);

    const me = await client.get('/auth/me').expect(200);
    expect(me.body.data.account).toMatchObject({
      username: user.username,
      roles: ['PLAYER'],
      permissions: ['player_profile.manage'],
      mfaEnabled: false,
    });
    expect(me.body.data.account).not.toHaveProperty('passwordHash');

    const anonymous = await testApp.client().get('/auth/me').expect(401);
    expect(anonymous.body.code).toBe('UNAUTHENTICATED');
  });

  it('responde da mesma forma para senha incorreta e conta inexistente', async () => {
    const user = await testApp.seedUser();
    const wrongPassword = await testApp
      .client()
      .post('/auth/login', { identifier: user.email, password: 'senha-incorreta' })
      .expect(401);
    const unknownUser = await testApp
      .client()
      .post('/auth/login', { identifier: 'ninguem@exemplo.test', password: 'senha-incorreta' })
      .expect(401);

    const comparable = ({ requestId: _requestId, ...rest }: Record<string, unknown>) => rest;
    expect(comparable(wrongPassword.body)).toEqual(comparable(unknownUser.body));
  });

  it('bloqueia temporariamente a conta após cinco falhas e informa o tempo de espera', async () => {
    const user = await testApp.seedUser();
    const client = testApp.client();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await client.post('/auth/login', { identifier: user.email, password: 'errada' }).expect(401);
    }

    const locked = await client
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(429);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);

    // Passado o bloqueio, a senha correta volta a funcionar e zera o contador.
    await testApp.prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    await client
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(200);
    const refreshed = await testApp.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.failedLoginCount).toBe(0);
    expect(refreshed.lockedUntil).toBeNull();
  });

  it('encerra a sessão no logout e invalida o cookie antigo', async () => {
    const user = await testApp.seedUser();
    const client = await testApp.login(user);

    await client.post('/auth/logout').expect(204);
    await client.get('/auth/me').expect(401);

    const session = await testApp.prisma.session.findFirstOrThrow();
    expect(session.endReason).toBe('LOGOUT');
  });

  it('expira por inatividade e por validade absoluta', async () => {
    const user = await testApp.seedUser();

    const idle = await testApp.login(user);
    await testApp.prisma.session.updateMany({
      data: { idleExpiresAt: new Date(Date.now() - 1000) },
    });
    await idle.get('/auth/me').expect(401);

    const absolute = await testApp.login(user);
    await testApp.prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await absolute.get('/auth/me').expect(401);
  });

  it('lista as sessões da conta e permite encerrar uma delas', async () => {
    const user = await testApp.seedUser();
    const first = await testApp.login(user);
    const second = await testApp.login(user);

    const list = await first.get('/auth/sessions').expect(200);
    expect(list.body.data).toHaveLength(2);
    const other = list.body.data.find((session: { current: boolean }) => !session.current);

    await first.delete(`/auth/sessions/${other.id}`).expect(204);
    await second.get('/auth/me').expect(401);
    await first.get('/auth/me').expect(200);
  });

  it('não permite encerrar a sessão de outra conta', async () => {
    const owner = await testApp.seedUser();
    const intruder = await testApp.seedUser();
    await testApp.login(owner);
    const ownerSession = await testApp.prisma.session.findFirstOrThrow({
      where: { userId: owner.id },
    });

    const intruderClient = await testApp.login(intruder);
    await intruderClient.delete(`/auth/sessions/${ownerSession.id}`).expect(404);

    const untouched = await testApp.prisma.session.findUniqueOrThrow({
      where: { id: ownerSession.id },
    });
    expect(untouched.endedAt).toBeNull();
  });

  it('encerra todas as outras sessões mantendo a atual', async () => {
    const user = await testApp.seedUser();
    const current = await testApp.login(user);
    const other = await testApp.login(user);

    await current.delete('/auth/sessions').expect(200);
    await other.get('/auth/me').expect(401);
    await current.get('/auth/me').expect(200);
  });

  it('atualiza o nome de exibição da própria conta', async () => {
    const user = await testApp.seedUser();
    const client = await testApp.login(user);

    await client.patch('/account/profile', { displayName: '  Camisa 10  ' }).expect(200);
    const me = await client.get('/auth/me').expect(200);
    expect(me.body.data.account.displayName).toBe('Camisa 10');
  });
});
