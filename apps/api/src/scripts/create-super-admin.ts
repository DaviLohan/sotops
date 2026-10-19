/**
 * Cria o primeiro superadministrador de um ambiente.
 *
 *   node dist/scripts/create-super-admin.js --email a@b.com --username admin --name "Nome"
 *
 * A senha é lida de EFED_ADMIN_PASSWORD ou, na falta dela, digitada sem eco no terminal.
 * A conta nasce ativa e é obrigada a cadastrar o MFA no primeiro acesso.
 */
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { emailSchema, displayNameSchema, passwordSchema, usernameSchema } from '@efed/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnvFiles } from '../config/load-env-files.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { hashPassword } from '../infra/crypto/password-hashing.js';

async function readPassword(): Promise<string> {
  const fromEnv = process.env.EFED_ADMIN_PASSWORD;
  if (fromEnv) {
    return fromEnv;
  }
  if (!process.stdin.isTTY) {
    throw new Error('Defina EFED_ADMIN_PASSWORD ou execute em um terminal interativo.');
  }
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const output = process.stdout;
  const originalWrite = output.write.bind(output);
  try {
    const question = terminal.question('Senha do superadministrador: ');
    // Suprime o eco dos caracteres digitados.
    output.write = (() => true) as typeof output.write;
    return await question;
  } finally {
    output.write = originalWrite;
    output.write('\n');
    terminal.close();
  }
}

async function main(): Promise<void> {
  loadEnvFiles();
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      username: { type: 'string' },
      name: { type: 'string' },
    },
  });

  const email = emailSchema.parse(values.email);
  const username = usernameSchema.parse(values.username);
  const displayName = displayNameSchema.parse(values.name ?? values.username);
  const password = passwordSchema.parse(await readPassword());

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não definida.');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          username,
          displayName,
          passwordHash: await hashPassword(password),
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          privacyNoticeVersion: 'bootstrap',
          privacyNoticeAcceptedAt: new Date(),
          roles: { create: { role: { connect: { key: 'SUPER_ADMIN' } } } },
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'admin.user.roles_changed',
          entityType: 'user',
          entityId: created.id,
          metadata: { added: ['SUPER_ADMIN'], removed: [], source: 'create-super-admin' },
        },
      });
      return created;
    });
    console.log(`Superadministrador criado: ${user.email} (${user.username}).`);
    console.log('No primeiro acesso será exigido o cadastro da verificação em duas etapas.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
