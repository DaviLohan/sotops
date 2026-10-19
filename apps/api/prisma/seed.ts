/**
 * Dados de demonstração para DESENVOLVIMENTO. Nunca roda em produção.
 *
 *   pnpm db:seed
 *
 * Cria contas já verificadas com senhas conhecidas. É idempotente: rodar de novo
 * não duplica nem altera contas existentes.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnvFiles } from '../src/config/load-env-files.js';
import { PrismaClient, type RoleKey } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/infra/crypto/password-hashing.js';
import { seedPortal } from './seed-portal.js';

const DEV_PASSWORD = 'desenvolvimento-123';

const ACCOUNTS: { username: string; displayName: string; roles: RoleKey[] }[] = [
  { username: 'superadmin', displayName: 'Super Administrador', roles: ['SUPER_ADMIN'] },
  { username: 'admin', displayName: 'Administração', roles: ['ADMIN'] },
  { username: 'organizador', displayName: 'Organização', roles: ['ORGANIZER', 'PLAYER'] },
  { username: 'arbitro', displayName: 'Arbitragem', roles: ['REFEREE'] },
  { username: 'jogador1', displayName: 'Jogador Um', roles: ['PLAYER'] },
  { username: 'jogador2', displayName: 'Jogador Dois', roles: ['PLAYER'] },
];

async function main(): Promise<void> {
  loadEnvFiles();
  if (process.env.NODE_ENV === 'production') {
    throw new Error('O seed de desenvolvimento não pode rodar em produção.');
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não definida.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const passwordHash = await hashPassword(DEV_PASSWORD);
    for (const account of ACCOUNTS) {
      const email = `${account.username}@federacao.local`;
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        console.log(`= ${email} (já existe)`);
        continue;
      }
      await prisma.user.create({
        data: {
          email,
          username: account.username,
          displayName: account.displayName,
          passwordHash,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          privacyNoticeVersion: 'seed',
          privacyNoticeAcceptedAt: new Date(),
          roles: { create: account.roles.map((key) => ({ role: { connect: { key } } })) },
        },
      });
      console.log(`+ ${email} [${account.roles.join(', ')}]`);
    }
    await seedPortal(prisma, passwordHash);
    console.log(`\nSenha de todas as contas de demonstração: ${DEV_PASSWORD}`);
    console.log('Contas administrativas precisam cadastrar o MFA no primeiro acesso.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
