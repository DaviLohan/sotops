import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestApp } from './support/test-app.js';
import { TEST_S3_ENDPOINT } from './support/test-env.js';

describe('saúde da API', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await TestApp.create();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('responde ao liveness sem autenticação', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('confirma PostgreSQL, Redis e MinIO no readiness', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/api/health/ready')
      .expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      checks: { database: 'up', redis: 'up', storage: 'up' },
    });
  });

  it('responde 503 com o armazenamento fora do ar, sem derrubar as outras sondas', async () => {
    // Porta reservada sem serviço: a conexão é recusada.
    process.env.S3_ENDPOINT = 'http://127.0.0.1:1';
    const degradedApp = await TestApp.create();
    try {
      const response = await request(degradedApp.app.getHttpServer())
        .get('/api/health/ready')
        .expect(503);
      expect(response.body).toMatchObject({
        status: 'degraded',
        checks: { database: 'up', redis: 'up', storage: 'down' },
      });
    } finally {
      process.env.S3_ENDPOINT = TEST_S3_ENDPOINT;
      await degradedApp.close();
    }
  });

  it('devolve erros no formato problem details com identificador da requisição', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/api/v1/nao-existe')
      .expect(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
    expect(JSON.stringify(response.body)).not.toMatch(/stack|Cannot GET/);
  });

  it('recusa JSON malformado e corpos acima do limite sem erro interno', async () => {
    const server = testApp.app.getHttpServer();
    const malformed = await request(server)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"identifier": ')
      .expect(400);
    expect(malformed.body.code).toBe('VALIDATION_FAILED');

    const oversized = await request(server)
      .post('/api/v1/auth/login')
      .send({ identifier: 'a@b.test', password: 'x'.repeat(200_000) })
      .expect(413);
    expect(oversized.body.code).toBe('VALIDATION_FAILED');
  });

  it('não expõe cabeçalhos que identificam o servidor', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/api/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
  });
});
