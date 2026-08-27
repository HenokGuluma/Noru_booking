#!/usr/bin/env tsx
/**
 * Migration runner. Ported from apps/api/src/db/migrate.ts — logic unchanged.
 *
 * Plain SQL files applied in filename order inside a transaction, tracked in
 * `public.schema_migrations` with a checksum. Forward-only: there is no
 * `down`. A mistake gets fixed with a new `000N_fix_whatever.sql`, never by
 * editing a file that has already run. See CLAUDE.md §5.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import postgres from 'postgres';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');

interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

async function loadMigrations(): Promise<MigrationFile[]> {
  const names = (await readdir(MIGRATIONS_DIR)).filter((n) => n.endsWith('.sql')).sort();
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(join(MIGRATIONS_DIR, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    }),
  );
}

async function ensureTable(sql: postgres.Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name        text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now(),
      duration_ms integer NOT NULL
    )`;
}

async function up(sql: postgres.Sql) {
  await ensureTable(sql);
  const applied = new Map(
    (await sql<{ name: string; checksum: string }[]>`
      SELECT name, checksum FROM public.schema_migrations`).map((r) => [r.name, r.checksum]),
  );

  for (const migration of await loadMigrations()) {
    const existing = applied.get(migration.name);
    if (existing) {
      if (existing !== migration.checksum) {
        throw new Error(
          `${migration.name} has changed since it was applied.\n` +
            'Applied migrations are immutable. Write a new migration instead.',
        );
      }
      continue;
    }

    const started = Date.now();
    process.stdout.write(`  applying ${migration.name} … `);
    await sql.begin(async (tx) => {
      await tx.unsafe(migration.sql);
      await tx`
        INSERT INTO public.schema_migrations (name, checksum, duration_ms)
        VALUES (${migration.name}, ${migration.checksum}, ${Date.now() - started})`;
    });
    process.stdout.write(`done (${Date.now() - started}ms)\n`);
  }
  console.log('Schema is up to date.');
}

async function status(sql: postgres.Sql) {
  await ensureTable(sql);
  const applied = new Set(
    (await sql<{ name: string }[]>`SELECT name FROM public.schema_migrations`).map((r) => r.name),
  );
  for (const migration of await loadMigrations()) {
    console.log(`${applied.has(migration.name) ? '  applied' : '  pending'}  ${migration.name}`);
  }
}

const command = process.argv[2] ?? 'up';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local.');
const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

try {
  if (command === 'up') await up(sql);
  else if (command === 'status') await status(sql);
  else throw new Error(`Unknown command "${command}". Use "up" or "status".`);
} catch (error) {
  console.error(`\nMigration failed: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
