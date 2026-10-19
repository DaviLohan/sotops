import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestApp } from './support/test-app.js';

describe('limite de requisições', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    process.env.RATE_LIMIT_AUTH_PER_MINUTE = '3';
    testApp = await TestApp.create();
    await testApp.reset();
  });

  afterAll(async () => {
    process.env.RATE_LIMIT_AUTH_PER_MINUTE = '100000';
    await testApp.close();
  });

  it('limita as rotas sensíveis de autenticação por endereço IP', async () => {
    const attacker = testApp.client().fromIp('203.0.113.10');
    const credentials = { identifier: 'ninguem@exemplo.test', password: 'qualquer-senha' };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await attacker.post('/auth/login', credentials).expect(401);
    }
    const limited = await attacker.post('/auth/login', credentials).expect(429);
    expect(limited.body.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);

    // Outro endereço não é afetado, e rotas comuns seguem no limite global.
    await testApp.client().fromIp('203.0.113.20').post('/auth/login', credentials).expect(401);
    await attacker.get('/auth/me').expect(401);
  });
});
