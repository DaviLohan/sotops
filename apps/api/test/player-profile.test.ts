import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type ApiClient, TestApp, type TestUser } from './support/test-app.js';

const validProfile = {
  nickname: 'Camisa 10',
  efootballId: 'CAMISA10-BR',
  platform: 'PLAYSTATION',
  country: 'br',
  region: 'São Paulo',
};

function photo(format: 'png' | 'jpeg' | 'webp', width = 640, height = 480): Promise<Buffer> {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 120, b: 60 } },
  });
  if (format === 'jpeg') {
    // Foto de celular: carrega EXIF com dados que não podem vazar.
    return image
      .jpeg()
      .withExif({ IFD0: { Artist: 'Dono da Foto', Copyright: 'GPS aqui' } })
      .toBuffer();
  }
  return image[format]().toBuffer();
}

describe('perfil de jogador', () => {
  let testApp: TestApp;
  let player: TestUser;
  let client: ApiClient;

  beforeAll(async () => {
    testApp = await TestApp.create();
  });

  beforeEach(async () => {
    await testApp.reset();
    player = await testApp.seedUser();
    client = await testApp.login(player);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('começa sem perfil e exige sessão', async () => {
    await testApp.client().get('/me/player-profile').expect(401);
    const response = await client.get('/me/player-profile').expect(200);
    expect(response.body.data).toBeNull();
  });

  it('cria o perfil com a URL pública igual ao nome de usuário e audita', async () => {
    const created = await client.put('/me/player-profile', validProfile).expect(200);
    expect(created.body.data).toMatchObject({
      slug: player.username,
      nickname: 'Camisa 10',
      efootballId: 'CAMISA10-BR',
      platform: 'PLAYSTATION',
      country: 'BR',
      region: 'São Paulo',
      avatarUrl: null,
      club: null,
    });

    await client.put('/me/player-profile', { ...validProfile, region: null }).expect(200);
    // Reenviar os mesmos dados não gera evento.
    await client.put('/me/player-profile', { ...validProfile, region: null }).expect(200);

    const events = await testApp.prisma.auditLog.findMany({
      where: { action: { startsWith: 'player.profile' } },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map((event) => event.action)).toEqual([
      'player.profile.created',
      'player.profile.updated',
    ]);
    expect(events[1]?.metadata).toEqual({ fields: ['region'] });
  });

  it('valida os campos', async () => {
    const response = await client
      .put('/me/player-profile', {
        nickname: 'x',
        efootballId: 'tem espaço',
        platform: 'SEGA',
        country: 'XX',
        region: 'r'.repeat(61),
      })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    const paths = response.body.errors.map((error: { path: string }) => error.path);
    expect(paths).toEqual(
      expect.arrayContaining(['nickname', 'efootballId', 'platform', 'country', 'region']),
    );
  });

  it('não aceita o mesmo ID do eFootball na mesma plataforma, nem com outra caixa', async () => {
    await client.put('/me/player-profile', validProfile).expect(200);
    const other = await testApp.login(await testApp.seedUser());

    const taken = await other
      .put('/me/player-profile', { ...validProfile, efootballId: 'camisa10-br' })
      .expect(409);
    expect(taken.body.code).toBe('EFOOTBALL_ID_TAKEN');

    // Em outra plataforma, o mesmo ID é de outra conta de jogo.
    await other.put('/me/player-profile', { ...validProfile, platform: 'XBOX' }).expect(200);
  });

  it('recusa quem não tem o papel de jogador', async () => {
    const referee = await testApp.login(await testApp.seedUser({ roles: ['REFEREE'] }));
    const response = await referee.put('/me/player-profile', validProfile).expect(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  describe('avatar', () => {
    beforeEach(async () => {
      await client.put('/me/player-profile', validProfile).expect(200);
    });

    it('reprocessa a imagem em WebP 256×256, sem metadados, e a serve publicamente', async () => {
      const response = await client
        .upload('/me/player-profile/avatar', await photo('jpeg'), 'foto.jpg')
        .expect(201);
      const avatarUrl: string = response.body.data.avatarUrl;
      expect(avatarUrl).toMatch(/^\/api\/v1\/media\/avatars\/[0-9a-f-]{36}\.webp$/);

      const served = await testApp
        .client()
        .get(avatarUrl.replace('/api/v1', ''))
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(served.headers['content-type']).toBe('image/webp');
      expect(served.headers['cache-control']).toContain('immutable');
      const metadata = await sharp(served.body as Buffer).metadata();
      expect(metadata).toMatchObject({ format: 'webp', width: 256, height: 256 });
      expect(metadata.exif).toBeUndefined();
    });

    it('troca e remove o avatar, apagando o arquivo anterior', async () => {
      const first = await client
        .upload('/me/player-profile/avatar', await photo('png'))
        .expect(201);
      const second = await client
        .upload('/me/player-profile/avatar', await photo('webp'), 'outra.webp')
        .expect(201);
      const firstUrl: string = first.body.data.avatarUrl;
      const secondUrl: string = second.body.data.avatarUrl;
      expect(secondUrl).not.toBe(firstUrl);
      await testApp.client().get(firstUrl.replace('/api/v1', '')).expect(404);

      const removed = await client.delete('/me/player-profile/avatar').expect(200);
      expect(removed.body.data.avatarUrl).toBeNull();
      await testApp.client().get(secondUrl.replace('/api/v1', '')).expect(404);

      const actions = await testApp.prisma.auditLog.findMany({
        where: { action: { startsWith: 'player.avatar' } },
        select: { action: true },
      });
      expect(actions.map((entry) => entry.action).sort()).toEqual([
        'player.avatar.removed',
        'player.avatar.updated',
        'player.avatar.updated',
      ]);
    });

    it('recusa arquivos que não são imagem, mesmo com extensão de imagem', async () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      );
      const fakePng = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from('<?php system($_GET["c"]); ?>'),
      ]);
      const html = Buffer.from('<html><script>alert(1)</script></html>');

      for (const [file, name] of [
        [svg, 'avatar.png'],
        [fakePng, 'avatar.png'],
        [html, 'avatar.jpg'],
      ] as const) {
        const response = await client.upload('/me/player-profile/avatar', file, name).expect(400);
        expect(response.body.code).toBe('VALIDATION_FAILED');
        expect(response.body.errors).toEqual([{ path: 'file', message: expect.any(String) }]);
      }
      const profile = await client.get('/me/player-profile').expect(200);
      expect(profile.body.data.avatarUrl).toBeNull();
    });

    it('recusa arquivo acima de 2 MB e requisição sem arquivo', async () => {
      const big = Buffer.concat([await photo('png'), Buffer.alloc(2 * 1024 * 1024)]);
      const tooBig = await client.upload('/me/player-profile/avatar', big).expect(413);
      expect(tooBig.body.code).toBe('VALIDATION_FAILED');

      await client.post('/me/player-profile/avatar').expect(400);
    });

    it('exige o token anti-CSRF no envio', async () => {
      const response = await client
        .useCsrfToken(undefined)
        .upload('/me/player-profile/avatar', await photo('png'))
        .expect(403);
      expect(response.body.code).toBe('CSRF_REJECTED');
    });
  });

  it('não envia avatar sem perfil criado', async () => {
    await client.upload('/me/player-profile/avatar', await photo('png')).expect(404);
  });

  it('só serve as pastas públicas e nomes gerados pela API', async () => {
    const anonymous = testApp.client();
    for (const path of [
      '/media/evidence/00000000-0000-0000-0000-000000000000.webp',
      '/media/avatars/..%2F..%2Fsegredo.webp',
      '/media/avatars/nao-existe.webp',
      '/media/avatars/00000000-0000-0000-0000-000000000000.webp',
    ]) {
      await anonymous.get(path).expect(404);
    }
  });
});
