import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestApp } from './support/test-app.js';

describe('integridade dos dados no banco', () => {
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

  it('impede alterar ou apagar registros de auditoria', async () => {
    const user = await testApp.seedUser();
    await testApp.login(user);
    const log = await testApp.prisma.auditLog.findFirstOrThrow();

    await expect(
      testApp.prisma.auditLog.update({ where: { id: log.id }, data: { action: 'adulterado' } }),
    ).rejects.toThrow(/apenas INSERT/);
    await expect(testApp.prisma.auditLog.delete({ where: { id: log.id } })).rejects.toThrow(
      /apenas INSERT/,
    );
    await expect(testApp.prisma.$executeRawUnsafe('TRUNCATE audit_logs')).rejects.toThrow(
      /apenas INSERT/,
    );

    expect(
      (await testApp.prisma.auditLog.findUniqueOrThrow({ where: { id: log.id } })).action,
    ).toBe(log.action);
  });

  it('impede a exclusão física de uma conta com histórico', async () => {
    const user = await testApp.seedUser();
    await testApp.login(user);
    await expect(testApp.prisma.user.delete({ where: { id: user.id } })).rejects.toThrow();
    expect(await testApp.prisma.user.count({ where: { id: user.id } })).toBe(1);
  });

  it('garante no banco o formato de e-mail e de nome de usuário', async () => {
    const base = {
      displayName: 'Teste',
      passwordHash: 'x',
      privacyNoticeVersion: 'teste',
      privacyNoticeAcceptedAt: new Date(),
    };
    await expect(
      testApp.prisma.user.create({
        data: { ...base, email: 'Maiusculo@exemplo.test', username: 'valido_1' },
      }),
    ).rejects.toThrow();
    await expect(
      testApp.prisma.user.create({
        data: { ...base, email: 'ok@exemplo.test', username: 'Com Espaço' },
      }),
    ).rejects.toThrow();
  });

  it('nunca grava senhas, tokens ou códigos nos metadados de auditoria', async () => {
    const user = await testApp.seedUser({ mfa: true });
    await testApp
      .client()
      .post('/auth/login', { identifier: user.email, password: 'senha-errada-xyz' });
    await testApp.login(user);

    const serialized = JSON.stringify(await testApp.prisma.auditLog.findMany());
    expect(serialized).not.toContain(user.password);
    expect(serialized).not.toContain('senha-errada-xyz');
    expect(serialized).not.toContain(user.totpSecret);
  });
});
