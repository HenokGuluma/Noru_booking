# 2. Hand-written SQL migrations, no ORM

**Status:** accepted · **Date:** 2026-08

## Context

The schema depends heavily on Postgres features: GiST `EXCLUDE` constraints,
generated columns, row-level security, partial indexes, `citext`, GIN full-text.

## Decision

Forward-only, checksummed `.sql` files, applied by a small runner. Queries use
postgres.js tagged templates. No ORM.

## Why

An ORM's migration DSL cannot express most of the above, so those constraints
would be hand-written SQL inside a wrapper — the wrapper adding indirection
rather than safety.

More importantly, the constraints *are* the design. "One employee cannot hold
two overlapping shifts" is one `EXCLUDE` clause and it is unconditionally true.
Expressed in application code it is true until someone forgets.

Checksums mean an applied migration is frozen; the runner refuses to start if a
file changed. Fixes go forward.

## Cost

More SQL to write, and no automatic types from the schema — hence the shared Zod
contracts. Rollback is a new migration, never a `down` script; on a payroll
database, automated rollback is more dangerous than a considered fix.
