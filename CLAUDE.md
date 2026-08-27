# CLAUDE.md

Operating manual for anyone — human or agent — writing code in this repository.

Read this before the first change. Most of what follows is not inferable from
the code, and several items are things that look like improvements and are not.

---

## What this system is for

Noru Crew runs staff operations for Noru Booking's hotels in Ethiopia:
rostering, attendance, leave, and payroll. Its output ends up in two places
that make mistakes expensive — a person's bank account, and a filing with the
Ministry of Revenues.

Bias accordingly. **Refuse loudly rather than guess quietly.** If the code
cannot determine which tax rules apply to a date, it throws; it does not fall
back to the newest set. If attendance for a period is still open, payroll will
not calculate. A wrong number that looks right is the worst outcome available
here, worse than an outage.

---

## Layout

Single Next.js 15 app (App Router), rebuilt from the original pnpm monorepo
per BUILD-PROMPT.md. The API layer is gone; Server Components query Postgres
directly, and mutations are Server Actions.

```
src/app                 App Router routes. (auth)/login, (app)/ authenticated shell.
src/components          TagBoard, AppShell, shared primitives.
src/lib/domain           Pure domain. No I/O, no dependencies, no clock. Was packages/core.
src/lib/schemas.ts       Zod schemas. Was packages/contracts.
src/lib/db               Connection (client.ts), tenant scoping (scope.ts), migration runner, seed.
src/lib/actions          Server actions, one file per domain area. (not yet built — see README)
db/migrations            Forward-only SQL. Was apps/api/src/db/migrations.
docs/                    Architecture, data model, localisation, ADRs.
```

**Dependency direction is one-way and absolute:**

```
Server Component / Server Action → lib/db → database
                        ↘ lib/domain ↙
```

`lib/domain` imports nothing from the rest of the app. `lib/db` never contains
business rules — that belongs in `lib/domain` or the action itself. If a
change requires an arrow pointing the other way, the design is wrong — fix the
design.

---

## Non-negotiable invariants

Breaking any of these is a defect regardless of what the tests say.

### 1. Money is integer santim

1 ETB = 100 santim. Every monetary column is `bigint` and named `*_santim`.
Every monetary value in TypeScript is the branded `Santim` type from
`@noru/core`.

```ts
// Never
const tax = gross * 0.15;

// Always
const tax = multiply(gross, 0.15);   // rounds half away from zero
const [a, b] = allocate(total, [1, 2]);  // no santim evaporates
```

Do not introduce `number` arithmetic on money. Do not add a `numeric` column
for currency. Do not format with `toFixed` — use `formatBirr`.

### 2. There is no surname

Ethiopian names are `given_name` + `fathers_name` + `grandfathers_name`. There
is no family name, so there is no `last_name`, `surname`, or `full_name`
column, and `formatName` decides which parts appear where.

- Rosters and lists: given + father's
- Filings, contracts, payslips: all three
- Sorting and search: **given name first**, never father's

Adding a surname field to make an integration easier is a data-model
regression. Map at the boundary instead.

### 3. Tax and pension rules are versioned rows

`payroll.rule_sets` and `payroll.tax_brackets` are data with effective dates.
`ruleSetFor(date)` resolves them and **throws** if no set covers the date.

- Never edit an existing rule set. Insert a new one with a new
  `effective_from`, and set the old one's `effective_to`.
- Never hard-code a rate or a threshold outside `packages/core/payroll/rules.ts`.
- Every payslip pins the `rule_set_id` it was computed with. Recalculating a
  historical period must reproduce the original figures exactly.

### 4. Both PAYE and pension are assessed on their own base

Pension does **not** reduce taxable income. PAYE is on taxable gross (which
excludes exempt allowances up to their caps); pension is 7%/11% of **basic
salary only**. These are independent. Systems ported from neighbouring
countries get this wrong.

### 5. Migrations are forward-only and checksummed

Once a migration is applied anywhere, it is frozen. The runner verifies
checksums and refuses to start if an applied file has changed.

Fixing a mistake means writing `000N_fix_whatever.sql`. Editing
`0003_operations.sql` after it has run is never the answer.

### 6. Punches and audit events are append-only

`ops.punches` and `audit.events` have `UPDATE` and `DELETE` revoked. A
correction is a **new punch** carrying a supervisor's justification, which
leaves the original visible. This is what makes a wage dispute answerable
eighteen months later.

`ops.attendance_days` is the reconciled, mutable view of that raw log — until
`locked_at` is set, after which it is frozen and payroll may read it.

### 7. Every write is scoped and audited

Repository writes run inside `withScope(sql, principal, fn)`, which sets the
tenant for the transaction using `set_config(..., true)`. The `true` matters:
without it the setting outlives the transaction on a pooled connection and
leaks one property's data into another's request.

Every state change calls `audit.record(...)`. Actions in `REASON_REQUIRED`
(salary changes, terminations, attendance corrections, roster overrides,
payroll approval) must carry a human-written reason, not a generated string.

---

## Conventions

**Errors.** Throw `AppError` with a code from `ErrorCode`. Messages are written
for the person reading them — say what is wrong and what to do about it.

```ts
// No
throw new Error('invalid state');

// Yes
throw precondition(
  `${count} attendance day(s) in this period are still open. Close attendance before calculating payroll.`
);
```

Database errors go through `fromDatabaseError`, which maps constraint names to
sentences. When you add a constraint whose violation a user could plausibly
trigger, add its name there too.

**Dates.** `date` columns are calendar days in Africa/Addis_Ababa. Timestamps
are `timestamptz`. The operating day begins at 06:00 local, so a night shift
belongs to the day it started — use `instantToWorkDate`, never `getDate()`.

Ethiopia is UTC+3 with no DST, which is why generated wall-clock columns are
safe. Do not generalise this to other regions without revisiting it.

**IDs.** `newId()` returns UUIDv7 — time-ordered, so index locality is decent.
Never `SERIAL`. Employee *numbers* (`NB-ADD-0417`) are separate, human-facing,
and allocated under a row lock.

**SQL.** Tagged templates via postgres.js; parameters are bound, never
interpolated. `snake_case` in the database, `camelCase` in TypeScript, handled
by the client transform. Prefer one query that returns what a service needs
over five in a loop — see `payroll/repository.loadInputs`.

**Naming.** Tables plural, columns singular. Booleans read as assertions
(`is_taxable`, not `taxable`). Timestamps are past participles (`locked_at`,
`published_at`).

**Comments.** Explain *why*. The code says what. Comments earn their place by
recording a decision, a legal citation, or a trap:

```ts
// Caps are flagged but still paid. An employer who breaks the 20h monthly
// ceiling owes the money regardless; withholding it would punish the worker
// for the employer's breach.
```

---

## Interface rules

The design system lives in `demo/noru-crew-ui.html` as CSS custom properties.
Take tokens from there; do not invent values.

- **Ethiopian date is primary**, Gregorian secondary and smaller. Both always
  present. Never drop the Gregorian — banks need it.
- **Colour is never the only signal.** Every shift block also carries its code
  in mono. Every status pill carries a word.
- **Amharic and English never reflow into each other.** IBM Plex Sans Ethiopic
  is metric-compatible with Plex Sans; keep it that way and do not substitute a
  fallback that is not.
- **Mono for anything a person will compare or type back**: times, money,
  employee numbers, TINs, IDs. Tabular numerals, always.
- **The tag board is the one literal element.** Do not add a second flourish
  competing with it.
- Salary is never rendered without checking `salary.read` — but do not rely on
  that check alone; the database returns nothing without the permission anyway.

---

## Testing

`packages/core` is where correctness is proven, because it can be. Any change to
tax, overtime, leave entitlement or calendar conversion needs a test with a
**hand-worked expected value**, not one captured from the implementation.

For payroll, add a case to the worked examples in `payroll.test.ts` showing the
band-by-band arithmetic. If you cannot derive the number on paper, do not trust
the code that produced it.

API tests use a fake repository (`apps/api/tests/`) and assert the *controls* —
attendance closed, four-eyes approval, scope enforcement — since that is where
a bug costs money.

---

## Never do these

- Add a `last_name` column, or any single `full_name` field
- Store money as `float`, `numeric`, or ETB rather than santim
- Edit an applied migration, or a rule set in place
- Compute a payslip from unlocked attendance
- Let the calculator approve their own run
- Hard-code a public holiday date — Orthodox feasts move, Eid is gazetted
- Assume 12 months, 365 days, or a fixed Pagume length
- Use `AT TIME ZONE` in a generated column (it is `STABLE`, not `IMMUTABLE`)
- `UPDATE` or `DELETE` a punch or an audit row
- Silently pick a rule set when the date is ambiguous — throw
- Suppress an overtime cap breach by withholding the pay
- Log a salary, a Fayda number, or a bank account (see the redaction list in `app.ts`)

---

## Working here

Before finishing a change:

```bash
pnpm verify        # typecheck + lint + test
```

If a migration changed, `pnpm db:reset` and confirm it applies from empty.

**Note for agents:** the SQL in this repository has never been executed — it was
written without a Postgres available. Treat a migration failure on first run as
expected and fix it forward with a new file. Do not "clean up" a migration by
editing it.

When you are unsure whether something is legally correct — a rate, a cap, an
entitlement — say so in the response and cite what you relied on. Guessing at
Ethiopian labour or tax law inside a comment, in a confident tone, is worse than
leaving a `TODO` that names the uncertainty.
