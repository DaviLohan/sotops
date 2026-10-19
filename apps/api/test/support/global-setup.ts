import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../prisma/migrations');

/**
 * Recria o schema do banco de testes aplicando os mesmos arquivos SQL das migrations,
 * na ordem — os testes exercitam exatamente o que vai para produção.
 */
export default async function setup(): Promise<void> {
  const { TEST_DATABASE_URL } = await import('./test-env.js');
  const databaseName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Recusando recriar o banco "${databaseName}": o banco de testes precisa terminar com "_test".`,
    );
  }

  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const migration of migrations) {
      await client.query(
        readFileSync(path.join(MIGRATIONS_DIR, migration, 'migration.sql'), 'utf8'),
      );
    }
  } finally {
    await client.end();
  }
}
