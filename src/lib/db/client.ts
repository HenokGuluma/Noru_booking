import 'server-only';
import postgres from 'postgres';

/**
 * One pooled connection for the whole server process. Tenant scope is set per
 * transaction (see `withScope`), never on this shared handle, because a
 * connection-level setting would leak across pooled requests.
 */
declare global {
  var __noruSql: postgres.Sql | undefined;
}

function createClient(): postgres.Sql {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local.');
  }
  return postgres(databaseUrl, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    onnotice: () => {},
  });
}

// Reused across hot reloads in dev so `next dev` doesn't open a new pool per save.
export const sql = globalThis.__noruSql ?? createClient();
if (process.env.NODE_ENV !== 'production') globalThis.__noruSql = sql;
