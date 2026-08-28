# Noru Crew

Staff operations for hotels in Ethiopia — rosters, attendance, leave, and payroll.

<table>
<tr><td colspan="2"><img src="docs/screenshots/login.png" alt="Sign in"></td></tr>
<tr>
<td width="50%"><img src="docs/screenshots/duty-desk.png" alt="Duty desk"><br><sub>Duty desk</sub></td>
<td width="50%"><img src="docs/screenshots/roster.png" alt="Roster"><br><sub>Roster</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/staff.png" alt="Staff"><br><sub>Staff</sub></td>
<td width="50%"><img src="docs/screenshots/payroll.png" alt="Payroll"><br><sub>Payroll</sub></td>
</tr>
</table>

## What's in it

- **Duty desk** — who's clocked in right now, coverage by department, pending leave requests
- **Roster** — weekly schedule per department, assign/edit shifts by clicking a cell
- **Attendance** — daily reconciled log, corrections logged as new entries (not edits)
- **Leave** — balances and requests, approve/decline
- **Payroll** — Ethiopian-month runs, PAYE shown band by band, pension, four-eyes approval
- **Staff / departments / roles** — directory with add/edit/delete

## Why it's not just a translated system

- No surname field. Ethiopian names are given name + father's name + grandfather's name.
- 13-month Ethiopian calendar. Dates lead with the Ethiopian date by default (toggle to swap), Gregorian is always shown too.
- Money is stored as integer santim (1 ETB = 100), never floats.
- Tax brackets are rows in the database with effective dates, not constants — old payslips recalculate correctly under the law that applied then.
- Pension (7% employee / 11% employer) is assessed on basic salary only, separately from PAYE — a common porting mistake.
- Overtime has four rates: 1.5× day, 1.75× night, 2× rest day, 2.5× holiday.
- Public holidays are a table, not hardcoded dates — Orthodox feasts and Eid move.

Current PAYE bands (Proclamation 1395/2025):

| Monthly taxable (ETB) | Rate |
|---:|---:|
| 0 – 2,000 | 0% |
| 2,000 – 4,000 | 15% |
| 4,000 – 7,000 | 20% |
| 7,000 – 10,000 | 25% |
| 10,000 – 14,000 | 30% |
| above 14,000 | 35% |

## Architecture

Single Next.js 15 app. Server Components query Postgres directly — no separate API layer.

```
noru-crew/
├── src/
│   ├── app/              routes (App Router)
│   ├── components/       UI, including the interactive bits (RosterGrid, StaffTable, etc.)
│   ├── lib/
│   │   ├── domain/         pure domain logic — calendar, money, payroll, leave rules. no I/O.
│   │   ├── db/              connection, tenant scoping, migrations, seed script
│   │   └── local-store.ts  the local-only CRUD overlay
│   └── globals.css        design tokens
├── db/migrations/        forward-only SQL — schema, people, ops, payroll, RLS + views, seed data
└── docs/                 architecture, data model, localisation, ADRs
```

One monolith, not services. Payroll reads attendance, attendance reads rosters, rosters read contracts — splitting that across services buys distributed transactions and nothing else.

No ORM. The schema leans on GiST exclusion constraints, row-level security, and generated columns — none of which map cleanly onto one anyway.

`src/lib/domain` has no database handle and no clock — it's tested with hand-worked numbers, not values captured from itself.

**Enforced by the database, not just the app:**
- Two shifts can't overlap for one employee (GiST exclusion constraint)
- Same for overlapping contracts
- A payroll run can't be approved by whoever calculated it (`CHECK` constraint)
- A payslip's line items must sum to its net pay (`CHECK` constraint)
- Punches and audit rows can't be updated or deleted (`REVOKE`)
- Every query is scoped to one property via row-level security, set per-transaction so a pooled connection can't leak it between requests

## Running it

Needs Node 22+, pnpm, Docker.

```bash
pnpm install
cp .env.example .env.local
pnpm db:up      # postgres + migrations
pnpm seed       # one property, 40 staff, a month of attendance, a payroll run
pnpm dev
```

Runs on `:3000`. There's no login flow yet (see below), so the demo user the seed script creates isn't something you sign in as — every page just reads as that user directly.

```bash
pnpm verify     # typecheck + lint + test
pnpm db:reset   # drop, migrate, reseed
```

## Status

Every page reads real data from Postgres — nothing on screen is fake. What's not there yet:

- **No auth.** No session cookies, no login. That's also why interactive stuff (clock in/out, approving leave, editing staff, payroll approval) only writes to browser `localStorage`, not the database — there's no user to attribute the write to yet.
- **No attendance reconciliation pipeline.** Punches → daily records is done by the seed script directly, not by the app.
- Tax bands came from a secondary source — check them against the Ministry of Revenues before relying on them for anything real.

## Docs

- [`CLAUDE.md`](CLAUDE.md) — conventions and invariants for working in this repo
- [`docs/architecture.md`](docs/architecture.md), [`docs/data-model.md`](docs/data-model.md), [`docs/localization-ethiopia.md`](docs/localization-ethiopia.md), [`docs/adr/`](docs/adr/)
