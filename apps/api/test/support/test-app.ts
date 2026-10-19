import type { RoleKey } from '@efed/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import { hashPassword } from '../../src/infra/crypto/password-hashing.js';
import { sealSecret } from '../../src/infra/crypto/secret-box.js';
import { generateTotpSecret, totpAt } from '../../src/infra/crypto/totp.js';
import { Mailer } from '../../src/infra/mail/mailer.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { REDIS } from '../../src/infra/redis/redis.constants.js';
import { MemoryMailer } from './memory-mailer.js';
import { TEST_MFA_KEY, TEST_ORIGIN } from './test-env.js';

export const DEFAULT_PASSWORD = 'senha-de-teste-123';

export interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  totpSecret?: string;
}

interface SeedUserOptions {
  roles?: RoleKey[];
  mfa?: boolean;
  status?: 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED';
}

let sequence = 0;
let cachedPasswordHash: Promise<string> | undefined;

export class TestApp {
  private constructor(
    readonly app: NestExpressApplication,
    readonly prisma: PrismaService,
    readonly mailer: MemoryMailer,
    private readonly redis: Redis,
  ) {}

  static async create(): Promise<TestApp> {
    const mailer = new MemoryMailer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Mailer)
      .useValue(mailer)
      .compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app);
    await app.init();
    return new TestApp(app, app.get(PrismaService), mailer, app.get<Redis>(REDIS));
  }

  async close(): Promise<void> {
    await this.app.close();
  }

  /** Esvazia as tabelas (exceto os papéis de referência) e os contadores de limite. */
  async reset(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER USER'),
      this.prisma.$executeRawUnsafe(
        'TRUNCATE audit_logs, mfa_recovery_codes, user_totp, user_tokens, sessions, user_roles, banners, news, matches, rounds, competition_entries, competitions, seasons, club_memberships, clubs, player_profiles, users',
      ),
      this.prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER USER'),
    ]);
    const keys = await this.redis.keys('throttle:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    this.mailer.clear();
  }

  client(): ApiClient {
    return new ApiClient(this.app);
  }

  /** Cria uma conta diretamente no banco, já verificada, com os papéis desejados. */
  async seedUser(options: SeedUserOptions = {}): Promise<TestUser> {
    sequence += 1;
    const roles = options.roles ?? ['PLAYER'];
    cachedPasswordHash ??= hashPassword(DEFAULT_PASSWORD);
    const username = `usuario_${sequence}`;
    const user = await this.prisma.user.create({
      data: {
        email: `${username}@exemplo.test`,
        username,
        displayName: `Usuário ${sequence}`,
        passwordHash: await cachedPasswordHash,
        status: options.status ?? 'ACTIVE',
        emailVerifiedAt: options.status === 'PENDING_VERIFICATION' ? null : new Date(),
        privacyNoticeVersion: 'teste',
        privacyNoticeAcceptedAt: new Date(),
        roles: { create: roles.map((key) => ({ role: { connect: { key } } })) },
      },
    });

    let totpSecret: string | undefined;
    if (options.mfa) {
      totpSecret = generateTotpSecret();
      await this.prisma.userTotp.create({
        data: {
          userId: user.id,
          secretCiphertext: sealSecret(TEST_MFA_KEY, totpSecret, user.id),
          confirmedAt: new Date(),
        },
      });
    }
    return { id: user.id, email: user.email, username, password: DEFAULT_PASSWORD, totpSecret };
  }

  /** Abre uma sessão completa (com segundo fator, quando a conta tem MFA). */
  async login(user: TestUser): Promise<ApiClient> {
    const client = this.client();
    const response = await client
      .post('/auth/login', { identifier: user.email, password: user.password })
      .expect(200);
    client.useCsrfToken(response.body.data.csrfToken);

    if (response.body.data.status === 'MFA_REQUIRED') {
      if (!user.totpSecret) {
        throw new Error('A conta exige MFA, mas o teste não conhece o segredo.');
      }
      const challenge = await client
        .post('/auth/mfa/challenge', { code: totpAt(user.totpSecret, Date.now()) })
        .expect(200);
      client.useCsrfToken(challenge.body.data.csrfToken);
      // Libera o mesmo passo de tempo para os próximos logins do teste.
      await this.allowTotpReuse(user.id);
    }
    return client;
  }

  async allowTotpReuse(userId: string): Promise<void> {
    await this.prisma.userTotp.update({ where: { userId }, data: { lastUsedStep: null } });
  }
}

/** Cliente HTTP que se comporta como o navegador: guarda cookies e envia Origin e token CSRF. */
export class ApiClient {
  private readonly agent: ReturnType<typeof request.agent>;
  private csrfToken: string | undefined;
  private origin: string | undefined = TEST_ORIGIN;
  private forwardedFor: string | undefined;

  constructor(app: NestExpressApplication) {
    this.agent = request.agent(app.getHttpServer());
  }

  useCsrfToken(token: string | undefined): this {
    this.csrfToken = token;
    return this;
  }

  useOrigin(origin: string | undefined): this {
    this.origin = origin;
    return this;
  }

  fromIp(ip: string): this {
    this.forwardedFor = ip;
    return this;
  }

  get(path: string): request.Test {
    return this.decorate(this.agent.get(`/api/v1${path}`));
  }

  post(path: string, body?: object): request.Test {
    return this.decorate(this.agent.post(`/api/v1${path}`)).send(body ?? {});
  }

  put(path: string, body: object): request.Test {
    return this.decorate(this.agent.put(`/api/v1${path}`)).send(body);
  }

  patch(path: string, body: object): request.Test {
    return this.decorate(this.agent.patch(`/api/v1${path}`)).send(body);
  }

  delete(path: string): request.Test {
    return this.decorate(this.agent.delete(`/api/v1${path}`));
  }

  private decorate(test: request.Test): request.Test {
    if (this.origin) {
      void test.set('Origin', this.origin);
    }
    if (this.csrfToken) {
      void test.set('X-CSRF-Token', this.csrfToken);
    }
    if (this.forwardedFor) {
      void test.set('X-Forwarded-For', this.forwardedFor);
    }
    return test;
  }
}

/** Lê o cookie de sessão devolvido em uma resposta. */
export function sessionCookie(response: request.Response): string | undefined {
  const header = response.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((cookie) => cookie.startsWith('efed_session='));
}
