import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestApp, type TestUser } from './support/test-app.js';

const NEW_PASSWORD = 'outra-senha-bem-longa';

describe('recuperação e troca de senha', () => {
  let testApp: TestApp;
  let user: TestUser;

  beforeAll(async () => {
    testApp = await TestApp.create();
  });

  beforeEach(async () => {
    await testApp.reset();
    user = await testApp.seedUser();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('responde igual para e-mails cadastrados e desconhecidos, enviando o link só ao titular', async () => {
    const client = testApp.client();
    const known = await client.post('/auth/password/forgot', { email: user.email }).expect(202);
    const unknown = await client
      .post('/auth/password/forgot', { email: 'ninguem@exemplo.test' })
      .expect(202);

    expect(known.body).toEqual(unknown.body);
    expect(testApp.mailer.outbox).toHaveLength(1);
    expect(testApp.mailer.lastTo(user.email).subject).toBe('Redefinição de senha');
  });

  it('redefine a senha, encerra todas as sessões e avisa o titular', async () => {
    const openSession = await testApp.login(user);
    const client = testApp.client();
    await client.post('/auth/password/forgot', { email: user.email }).expect(202);
    const token = testApp.mailer.tokenFor(user.email);

    await client.post('/auth/password/reset', { token, password: NEW_PASSWORD }).expect(200);

    await openSession.get('/auth/me').expect(401);
    await client
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(401);
    await client
      .post('/auth/login', { identifier: user.email, password: NEW_PASSWORD })
      .expect(200);
    expect(testApp.mailer.lastTo(user.email).subject).toBe('Sua senha foi alterada');

    const ended = await testApp.prisma.session.findFirstOrThrow({
      where: { endReason: 'PASSWORD_RESET' },
    });
    expect(ended.endedAt).not.toBeNull();
  });

  it('aceita o token de redefinição uma única vez', async () => {
    const client = testApp.client();
    await client.post('/auth/password/forgot', { email: user.email }).expect(202);
    const token = testApp.mailer.tokenFor(user.email);

    await client.post('/auth/password/reset', { token, password: NEW_PASSWORD }).expect(200);
    const reuse = await client
      .post('/auth/password/reset', { token, password: 'terceira-senha-longa' })
      .expect(400);
    expect(reuse.body.code).toBe('TOKEN_INVALID');
  });

  it('aceita apenas uma de duas redefinições simultâneas com o mesmo token', async () => {
    const client = testApp.client();
    await client.post('/auth/password/forgot', { email: user.email }).expect(202);
    const token = testApp.mailer.tokenFor(user.email);

    const results = await Promise.all([
      testApp.client().post('/auth/password/reset', { token, password: 'senha-concorrente-a' }),
      testApp.client().post('/auth/password/reset', { token, password: 'senha-concorrente-b' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
  });

  it('recusa o token expirado e não usa token de verificação como token de senha', async () => {
    const client = testApp.client();
    await client.post('/auth/password/forgot', { email: user.email }).expect(202);
    const token = testApp.mailer.tokenFor(user.email);

    await testApp.prisma.userToken.updateMany({ data: { type: 'EMAIL_VERIFICATION' } });
    await client.post('/auth/password/reset', { token, password: NEW_PASSWORD }).expect(400);

    await testApp.prisma.userToken.updateMany({
      data: { type: 'PASSWORD_RESET', expiresAt: new Date(Date.now() - 1000) },
    });
    await client.post('/auth/password/reset', { token, password: NEW_PASSWORD }).expect(400);
  });

  it('libera a conta bloqueada por tentativas após a redefinição', async () => {
    await testApp.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 9, lockedUntil: new Date(Date.now() + 600_000) },
    });
    const client = testApp.client();
    await client.post('/auth/password/forgot', { email: user.email }).expect(202);
    await client
      .post('/auth/password/reset', {
        token: testApp.mailer.tokenFor(user.email),
        password: NEW_PASSWORD,
      })
      .expect(200);

    await client
      .post('/auth/login', { identifier: user.email, password: NEW_PASSWORD })
      .expect(200);
  });

  it('exige a senha atual para trocar a senha', async () => {
    const client = await testApp.login(user);
    const response = await client
      .post('/auth/password/change', {
        currentPassword: 'nao-e-a-atual',
        newPassword: NEW_PASSWORD,
      })
      .expect(401);
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
    await client.get('/auth/me').expect(200);
  });

  it('recusa nova senha igual à atual', async () => {
    const client = await testApp.login(user);
    const response = await client
      .post('/auth/password/change', { currentPassword: user.password, newPassword: user.password })
      .expect(400);
    expect(response.body.errors[0].path).toBe('newPassword');
  });

  it('troca a senha mantendo a sessão atual e encerrando as demais', async () => {
    const current = await testApp.login(user);
    const other = await testApp.login(user);

    await current
      .post('/auth/password/change', { currentPassword: user.password, newPassword: NEW_PASSWORD })
      .expect(200);

    await current.get('/auth/me').expect(200);
    await other.get('/auth/me').expect(401);
    await testApp
      .client()
      .post('/auth/login', { identifier: user.email, password: NEW_PASSWORD })
      .expect(200);
  });
});
