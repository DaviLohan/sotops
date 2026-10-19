import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from './support/test-app.js';

const registration = {
  email: 'Novo.Jogador@Exemplo.test',
  username: 'novo_jogador',
  displayName: 'Novo Jogador',
  password: 'uma-senha-bem-longa',
  acceptPrivacyNotice: true,
};
const email = 'novo.jogador@exemplo.test';

describe('cadastro e verificação de e-mail', () => {
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

  it('cria a conta pendente com o papel de jogador e envia o link de verificação', async () => {
    await testApp.client().post('/auth/register', registration).expect(202);

    const user = await testApp.prisma.user.findUniqueOrThrow({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    expect(user.status).toBe('PENDING_VERIFICATION');
    expect(user.username).toBe('novo_jogador');
    expect(user.roles.map((entry) => entry.role.key)).toEqual(['PLAYER']);
    expect(user.privacyNoticeAcceptedAt).toBeInstanceOf(Date);
    expect(testApp.mailer.lastTo(email).subject).toBe('Confirme seu e-mail');
  });

  it('armazena a senha com Argon2id e nunca em texto puro', async () => {
    await testApp.client().post('/auth/register', registration).expect(202);
    const user = await testApp.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(registration.password);
  });

  it('bloqueia o login até a verificação e libera depois dela', async () => {
    const client = testApp.client();
    await client.post('/auth/register', registration).expect(202);

    const blocked = await client
      .post('/auth/login', { identifier: email, password: registration.password })
      .expect(403);
    expect(blocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    await client.post('/auth/verify-email', { token: testApp.mailer.tokenFor(email) }).expect(200);

    const login = await client
      .post('/auth/login', { identifier: 'NOVO_JOGADOR', password: registration.password })
      .expect(200);
    expect(login.body.data.status).toBe('AUTHENTICATED');
    expect(login.body.data.account).toMatchObject({ email, status: 'ACTIVE', roles: ['PLAYER'] });
  });

  it('aceita o token de verificação uma única vez', async () => {
    const client = testApp.client();
    await client.post('/auth/register', registration).expect(202);
    const token = testApp.mailer.tokenFor(email);

    await client.post('/auth/verify-email', { token }).expect(200);
    const reuse = await client.post('/auth/verify-email', { token }).expect(400);
    expect(reuse.body.code).toBe('TOKEN_INVALID');
  });

  it('recusa um token de verificação expirado', async () => {
    const client = testApp.client();
    await client.post('/auth/register', registration).expect(202);
    await testApp.prisma.userToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    await client.post('/auth/verify-email', { token: testApp.mailer.tokenFor(email) }).expect(400);
  });

  it('guarda apenas o hash do token enviado por e-mail', async () => {
    await testApp.client().post('/auth/register', registration).expect(202);
    const token = testApp.mailer.tokenFor(email);
    const stored = await testApp.prisma.userToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('não revela que o e-mail já está cadastrado e avisa o titular', async () => {
    const existing = await testApp.seedUser();
    const response = await testApp
      .client()
      .post('/auth/register', { ...registration, email: existing.email })
      .expect(202);

    expect(response.body.data.message).toContain('Se os dados estiverem corretos');
    expect(await testApp.prisma.user.count()).toBe(1);
    expect(testApp.mailer.lastTo(existing.email).subject).toBe('Você já tem uma conta');
  });

  it('informa quando o nome de usuário já está em uso', async () => {
    const existing = await testApp.seedUser();
    const response = await testApp
      .client()
      .post('/auth/register', { ...registration, username: existing.username })
      .expect(409);
    expect(response.body.code).toBe('USERNAME_TAKEN');
  });

  it('valida os campos e aponta cada erro pelo caminho', async () => {
    const response = await testApp
      .client()
      .post('/auth/register', {
        email: 'invalido',
        username: 'a',
        displayName: '',
        password: 'curta',
        acceptPrivacyNotice: false,
      })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    const paths = response.body.errors.map((error: { path: string }) => error.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'email',
        'username',
        'displayName',
        'password',
        'acceptPrivacyNotice',
      ]),
    );
  });

  it('reenvia a verificação apenas para contas pendentes, com resposta idêntica', async () => {
    const client = testApp.client();
    await client.post('/auth/register', registration).expect(202);
    const firstToken = testApp.mailer.tokenFor(email);
    testApp.mailer.clear();

    const pending = await client.post('/auth/verify-email/resend', { email }).expect(202);
    const unknown = await client
      .post('/auth/verify-email/resend', { email: 'ninguem@exemplo.test' })
      .expect(202);

    expect(pending.body).toEqual(unknown.body);
    expect(testApp.mailer.outbox).toHaveLength(1);
    // O novo link invalida o anterior.
    await client.post('/auth/verify-email', { token: firstToken }).expect(400);
    await client.post('/auth/verify-email', { token: testApp.mailer.tokenFor(email) }).expect(200);
  });

  it('registra o cadastro e a verificação na auditoria', async () => {
    const client = testApp.client();
    await client.post('/auth/register', registration).expect(202);
    await client.post('/auth/verify-email', { token: testApp.mailer.tokenFor(email) }).expect(200);

    const actions = (
      await testApp.prisma.auditLog.findMany({ orderBy: { occurredAt: 'asc' } })
    ).map((log) => log.action);
    expect(actions).toEqual(['auth.register', 'auth.email.verified']);
  });
});
