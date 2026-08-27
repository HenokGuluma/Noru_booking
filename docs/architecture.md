# Architecture

## Shape

A modular monolith: one deployable process, strict internal seams.

```
             ┌──────────────────────────────────────────┐
   browser ──┤  apps/web (React)                        │
             └───────────────┬──────────────────────────┘
                             │  packages/contracts (Zod)
             ┌───────────────┴──────────────────────────┐
             │  apps/api (Fastify)                      │
             │                                          │
             │  plugins/   auth, error handling         │
             │  modules/   routes → service → repository│
             │  lib/       errors, rbac, audit, ids     │
             └───────────────┬──────────────────────────┘
                             │
             ┌───────────────┴──────────────────────────┐
             │  Postgres 17                             │
             │  org · hr · ops · payroll · iam · audit  │
             └──────────────────────────────────────────┘

   packages/core — pure domain, imported by api and web alike
```

### Why not services

The natural service split — people, scheduling, attendance, payroll — is
exactly where the transactions are. Calculating a payroll run reads contracts,
attendance days, leave, allowances and deductions, and must see a consistent
snapshot of all of them. Across services that means either distributed
transactions or eventual consistency in the one place a business cannot tolerate
it.

A property with a few hundred staff generates a few thousand punches a day. That
is not a scaling problem. The module boundaries are real, and if scheduling ever
does need to leave, the seam is already cut.

## Layers

**`packages/core`** — the domain. Ethiopian calendar and clock, money, names,
tax and overtime arithmetic, leave entitlement, roster rules. No dependencies,
no I/O, no ambient clock: every function takes what it needs and returns a
value. This is deliberate — it is the part that must be provably correct, and
purity is what makes proof cheap.

**`packages/contracts`** — Zod schemas for every request and response. The API
validates with them; the web client infers its types from them. One definition,
both sides, no drift.

**`apps/api`** — three files per module and a firm rule about each:

| | responsibility | may not |
|---|---|---|
| `routes.ts` | HTTP shape, schema, status codes | contain business rules or touch `sql` |
| `service.ts` | rules, orchestration, authorisation, audit | write SQL |
| `repository.ts` | queries, row mapping | make decisions |

Dependencies are constructed in `app.ts` and passed down. Nothing reads config
or opens a connection at module scope, so tests build the whole application
against fakes and the wiring stays legible in one file.

## Request lifecycle

1. `onRequest` — unless the route declares `config.public`, verify the bearer
   token and attach a `Principal`. Authentication is opt-out, so a newly added
   route is protected by default rather than accidentally open.
2. Zod validates params, query, body. Failures return 422 with field paths.
3. The service checks permission with `require_`, and property or department
   scope with `requireProperty` / `requireDepartment`.
4. Repository work runs inside `withScope`, which sets the tenant for the
   transaction. Writes that change state also write an audit event.
5. Zod serialises the response, which prevents a column added to a `SELECT *`
   from leaking to a client.
6. Anything thrown lands in one error handler that maps `AppError` and Postgres
   codes to a stable `code`, a human message, and the request ID.

## Authentication

Short-lived access tokens (15 min) carry the principal's permissions and scopes,
so most requests need no database round trip. Refresh tokens (14 days) are
opaque, stored as SHA-256, and rotated on every use.

Presenting an already-revoked refresh token means a copy exists somewhere it
should not, so the entire session family is revoked rather than the request
merely refused. The legitimate user signs in again; whoever stole it gets
nothing.

Signing keys are a list, newest first. Rotation means prepending a key —
verification tries each, so nobody is logged out.

## Authorisation

Two independent layers, on purpose.

**Application** — `Principal` carries a permission set and the properties and
departments it is scoped to. Services check explicitly and produce a useful
message.

**Database** — row-level security on employees, contracts, rosters, attendance,
leave, runs and payslips. `iam.accessible_properties()` and
`iam.has_permission()` read the transaction-scoped tenant setting.

The second layer exists because the first will eventually be forgotten. A query
that omits its check returns zero rows instead of another property's payroll.

## Payroll pipeline

```
attendance days ──lock──▶ run (draft)
                            │  calculate    ← requires every day locked
                            ▼
                         calculated
                            │  approve      ← must be a different person
                            ▼
                         approved ──▶ bank file ──▶ statutory filings
```

Two controls, both enforced in the database as well as the service:

- **Attendance must be closed.** Calculating from unreconciled attendance is how
  a month gets re-run.
- **Four eyes.** `CHECK (approved_by <> calculated_by)`, so it holds even
  against direct API use.

Recalculating replaces every payslip in the run; an approved run cannot be
recalculated at all. Each payslip pins its `rule_set_id`, so the figures remain
reproducible after the law changes.

## Failure and operations

- `/health` — process is up. `/ready` — database reachable.
- Graceful shutdown drains in-flight requests before closing the pool, with a
  15s ceiling. A payroll run cut in half by a deploy is not acceptable.
- Serialisable transactions retry on `40001`/`40P01`.
- Logs redact authorisation headers, passwords, refresh tokens, salaries, Fayda
  numbers and bank accounts.
- Every response carries a request ID; every audit row carries the actor.

## Deliberate omissions

No message queue, no cache, no search cluster, no event sourcing. Postgres does
full-text search over bilingual names with a GIN index, and the read volumes
here are small. Each of these would be a reasonable addition the day a measured
problem calls for it, and a liability today.
