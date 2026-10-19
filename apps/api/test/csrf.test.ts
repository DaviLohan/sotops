import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestApp, type TestUser } from './support/test-app.js';

describe('proteção contra CSRF', () => {
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

  it('recusa alterações autenticadas sem o token da sessão', async () => {
    const client = await testApp.login(user);
    client.useCsrfToken(undefined);

    const response = await client.patch('/account/profile', { displayName: 'Invasor' }).expect(403);
    expect(response.body.code).toBe('CSRF_REJECTED');
  });

  it('recusa o token de outra sessão', async () => {
    const victim = await testApp.login(user);
    const otherLogin = await testApp
      .client()
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(200);

    victim.useCsrfToken(otherLogin.body.data.csrfToken);
    await victim.patch('/account/profile', { displayName: 'Invasor' }).expect(403);
  });

  it('recusa requisições vindas de outra origem, mesmo com token válido', async () => {
    const client = await testApp.login(user);
    client.useOrigin('https://site-malicioso.example');

    const response = await client.patch('/account/profile', { displayName: 'Invasor' }).expect(403);
    expect(response.body.code).toBe('CSRF_REJECTED');
  });

  it('recusa requisições com cookie de sessão e sem cabeçalho de origem', async () => {
    const client = await testApp.login(user);
    client.useOrigin(undefined);
    await client.patch('/account/profile', { displayName: 'Invasor' }).expect(403);
  });

  it('recusa login disparado a partir de outra origem', async () => {
    const response = await testApp
      .client()
      .useOrigin('https://site-malicioso.example')
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(403);
    expect(response.body.code).toBe('CSRF_REJECTED');
  });

  it('aceita a alteração com origem autorizada e token correto', async () => {
    const client = await testApp.login(user);
    await client.patch('/account/profile', { displayName: 'Nome Novo' }).expect(200);
  });

  it('não exige token para leituras', async () => {
    const client = await testApp.login(user);
    client.useCsrfToken(undefined).useOrigin(undefined);
    await client.get('/auth/me').expect(200);
  });
});
