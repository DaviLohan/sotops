// Recria o schema do banco end-to-end a partir das migrations e limpa o Redis de limites.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL não definida.');
}
const databaseName = new URL(databaseUrl).pathname.slice(1);
if (!databaseName.endsWith('_e2e')) {
  throw new Error(
    `Recusando recriar "${databaseName}": o banco end-to-end precisa terminar com "_e2e".`,
  );
}

const migrationsDir = path.resolve(import.meta.dirname, '../../../apps/api/prisma/migrations');
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const migration of migrations) {
    await client.query(readFileSync(path.join(migrationsDir, migration, 'migration.sql'), 'utf8'));
  }
  console.log(`Banco ${databaseName} recriado com ${migrations.length} migration(s).`);
} finally {
  await client.end();
}
