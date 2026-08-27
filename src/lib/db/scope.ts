import 'server-only';
import type postgres from 'postgres';
import { sql } from './client';

/**
 * Every scoped write (and every read of row-level-secured tables) runs inside
 * this. `set_config(..., true)` — the trailing `true` — makes the tenant
 * setting transaction-local; without it, a pooled connection would carry one
 * request's property into the next. See CLAUDE.md §7.
 *
 * `principal` is `null` until auth (BUILD-PROMPT step 5) lands — no session
 * cookie or login flow exists yet, so callers pass a known demo principal for
 * now. RLS policies still apply; there is just one seeded actor to satisfy
 * them with.
 */
export interface Principal {
  userId: string;
}

export async function withScope<T>(
  principal: Principal,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  // postgres.js's `begin` return type is `UnwrapPromiseArray<T>`, which it
  // cannot unify with the caller's own `T` — the cast below is just telling
  // TypeScript what's already true at runtime.
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('app.current_user_id', ${principal.userId}, true)`;
    return fn(tx);
  }) as Promise<T>;
}
