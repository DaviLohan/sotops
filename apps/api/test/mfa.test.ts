import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { totpAt } from '../src/infra/crypto/totp.js';
import { sessionCookie, TestApp } from './support/test-app.js';

describe('verificação em duas etapas (TOTP)', () => {
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

  it('ativa o MFA após confirmar um código e entrega dez códigos de recuperação', async () => {
    const user = await testApp.seedUser();
    const client = await testApp.login(user);

    const enrollment = await client
      .post('/auth/mfa/enrollment', { password: user.password })
      .expect(200);
    const { secret, otpauthUri } = enrollment.body.data;
    expect(otpauthUri).toContain('otpauth://totp/');
    expect(otpauthUri).toContain(`secret=${secret}`);

    // Ainda pendente: o MFA só vale depois da confirmação.
    expect((await client.get('/auth/mfa').expect(200)).body.data.enabled).toBe(false);

    const confirmation = await client
      .post('/auth/mfa/enrollment/confirm', { code: totpAt(secret, Date.now()) })
      .expect(200);
    expect(confirmation.body.data.recoveryCodes).toHaveLength(10);

    const status = await client.get('/auth/mfa').expect(200);
    expect(status.body.data).toMatchObject({ enabled: true, recoveryCodesRemaining: 10 });
    // A sessão que fez o cadastro continua válida.
    await client.get('/auth/me').expect(200);
  });

  it('guarda o segredo cifrado e os códigos de recuperação como hash', async () => {
    const user = await testApp.seedUser();
    const client = await testApp.login(user);
    const enrollment = await client
      .post('/auth/mfa/enrollment', { password: user.password })
      .expect(200);
    const confirmation = await client
      .post('/auth/mfa/enrollment/confirm', {
        code: totpAt(enrollment.body.data.secret, Date.now()),
      })
      .expect(200);

    const stored = await testApp.prisma.userTotp.findUniqueOrThrow({ where: { userId: user.id } });
    expect(stored.secretCiphertext).not.toContain(enrollment.body.data.secret);
    expect(stored.secretCiphertext.startsWith('v1.')).toBe(true);

    const codes = await testApp.prisma.mfaRecoveryCode.findMany({ where: { userId: user.id } });
    const plain: string[] = confirmation.body.data.recoveryCodes;
    expect(codes.some((code) => plain.includes(code.codeHash))).toBe(false);
  });

  it('exige a senha para iniciar o cadastro e recusa código incorreto na confirmação', async () => {
    const user = await testApp.seedUser();
    const client = await testApp.login(user);

    await client.post('/auth/mfa/enrollment', { password: 'senha-errada' }).expect(401);
    await client.post('/auth/mfa/enrollment', { password: user.password }).expect(200);
    const wrong = await client.post('/auth/mfa/enrollment/confirm', { code: '000000' }).expect(401);
    expect(wrong.body.code).toBe('MFA_INVALID_CODE');
  });

  it('exige o segundo fator no login e limita a sessão pendente', async () => {
    const user = await testApp.seedUser({ mfa: true });
    const client = testApp.client();

    const login = await client
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(200);
    expect(login.body.data).toEqual({ status: 'MFA_REQUIRED', csrfToken: expect.any(String) });
    client.useCsrfToken(login.body.data.csrfToken);

    const pending = await client.get('/auth/me').expect(403);
    expect(pending.body.code).toBe('MFA_CHALLENGE_REQUIRED');
    await client.get('/auth/sessions').expect(403);

    const wrong = await client.post('/auth/mfa/challenge', { code: '000000' }).expect(401);
    expect(wrong.body.code).toBe('MFA_INVALID_CODE');

    const challenge = await client
      .post('/auth/mfa/challenge', { code: totpAt(user.totpSecret!, Date.now()) })
      .expect(200);
    expect(challenge.body.data.account.mfaEnabled).toBe(true);
    await client.get('/auth/me').expect(200);
  });

  it('troca o token da sessão ao concluir o segundo fator', async () => {
    const user = await testApp.seedUser({ mfa: true });
    const client = testApp.client();
    const login = await client
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(200);
    client.useCsrfToken(login.body.data.csrfToken);
    const pendingCookie = sessionCookie(login);

    const challenge = await client
      .post('/auth/mfa/challenge', { code: totpAt(user.totpSecret!, Date.now()) })
      .expect(200);
    const finalCookie = sessionCookie(challenge);

    expect(finalCookie).toBeDefined();
    expect(finalCookie?.split(';')[0]).not.toBe(pendingCookie?.split(';')[0]);
  });

  it('recusa a reutilização do mesmo código TOTP', async () => {
    const user = await testApp.seedUser({ mfa: true });
    const code = totpAt(user.totpSecret!, Date.now());

    const first = testApp.client();
    const firstLogin = await first
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(200);
    await first
      .useCsrfToken(firstLogin.body.data.csrfToken)
      .post('/auth/mfa/challenge', { code })
      .expect(200);

    const second = testApp.client();
    const secondLogin = await second
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(200);
    await second
      .useCsrfToken(secondLogin.body.data.csrfToken)
      .post('/auth/mfa/challenge', { code })
      .expect(401);
  });

  it('aceita cada código de recuperação uma única vez', async () => {
    const user = await testApp.seedUser();
    const setup = await testApp.login(user);
    const enrollment = await setup
      .post('/auth/mfa/enrollment', { password: user.password })
      .expect(200);
    const confirmation = await setup
      .post('/auth/mfa/enrollment/confirm', {
        code: totpAt(enrollment.body.data.secret, Date.now()),
      })
      .expect(200);
    const [recoveryCode] = confirmation.body.data.recoveryCodes as string[];

    const loginWithRecovery = async (expected: number) => {
      const client = testApp.client();
      const login = await client
        .post('/auth/login', { identifier: user.email, password: user.password })
        .expect(200);
      await client
        .useCsrfToken(login.body.data.csrfToken)
        .post('/auth/mfa/challenge', { recoveryCode })
        .expect(expected);
      return client;
    };

    const client = await loginWithRecovery(200);
    expect((await client.get('/auth/mfa').expect(200)).body.data.recoveryCodesRemaining).toBe(9);
    await loginWithRecovery(401);
  });

  it('conta falhas do segundo fator para o bloqueio temporário da conta', async () => {
    const user = await testApp.seedUser({ mfa: true });
    const client = testApp.client();
    const login = await client
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(200);
    client.useCsrfToken(login.body.data.csrfToken);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await client.post('/auth/mfa/challenge', { code: '000000' }).expect(401);
    }
    const locked = await client
      .post('/auth/mfa/challenge', { code: totpAt(user.totpSecret!, Date.now()) })
      .expect(429);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('permite ao jogador desativar o MFA, mas não a contas administrativas', async () => {
    const player = await testApp.seedUser({ mfa: true });
    const playerClient = await testApp.login(player);
    await playerClient.post('/auth/mfa/disable', { password: player.password }).expect(200);
    expect(await testApp.prisma.userTotp.count({ where: { userId: player.id } })).toBe(0);

    const admin = await testApp.seedUser({ roles: ['ADMIN'], mfa: true });
    const adminClient = await testApp.login(admin);
    const refused = await adminClient
      .post('/auth/mfa/disable', { password: admin.password })
      .expect(403);
    expect(refused.body.code).toBe('FORBIDDEN');
    expect(await testApp.prisma.userTotp.count({ where: { userId: admin.id } })).toBe(1);
  });

  it('gera novos códigos de recuperação e invalida os anteriores', async () => {
    const user = await testApp.seedUser();
    const client = await testApp.login(user);
    const enrollment = await client
      .post('/auth/mfa/enrollment', { password: user.password })
      .expect(200);
    const confirmation = await client
      .post('/auth/mfa/enrollment/confirm', {
        code: totpAt(enrollment.body.data.secret, Date.now()),
      })
      .expect(200);

    const regenerated = await client
      .post('/auth/mfa/recovery-codes', { password: user.password })
      .expect(200);
    const before: string[] = confirmation.body.data.recoveryCodes;
    const after: string[] = regenerated.body.data.recoveryCodes;
    expect(after).toHaveLength(10);
    expect(after.some((code) => before.includes(code))).toBe(false);
    expect(await testApp.prisma.mfaRecoveryCode.count({ where: { userId: user.id } })).toBe(10);
  });
});
