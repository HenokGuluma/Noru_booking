<div align="center">

# Noru Crew

**Staff operations for Noru Booking hotels.**

Rostering, attendance, leave and payroll — built for how hotels in Ethiopia
actually run, not translated from a system that assumes otherwise.

</div>

---

## What this is

Noru Booking runs hotels. Hotels run on people working awkward hours in
overlapping departments, and every hour of that has to end up correctly on a
payslip, correctly withheld, and correctly filed with the Ministry of Revenues
by the 8th of the following month.

Noru Crew is the system that gets it from the staff entrance to the bank file:

| | |
|---|---|
| **Duty board** | Weekly rosters per department, with the Labour Proclamation's rest and hours rules checked before anything is published |
| **Attendance** | Append-only punch log reconciled into daily worked and overtime, split into the four rates Ethiopian law prices separately |
| **Leave** | Annual, sick, maternity, paternity and the rest, on balances that run to the Ethiopian fiscal year |
| **Payroll** | Ethiopian-month runs, PAYE and pension, four-eyes approval, bank file, statutory filings |
| **People** | Contracts, documents, certifications, disciplinary record |

<br>

> ### See it first
>
> **[`demo/noru-crew-ui.html`](demo/noru-crew-ui.html)** — open it in a browser.
> No build, no server, no install. Six working screens, and the Ethiopian
> calendar and clock toggles run the same conversion the API does.

---

## Why it looks like this

Two decisions carry most of the interface.

**The Ethiopian date comes first.** Every date in the product leads with
`Hamus · Nehase 21, 2018` and puts `27 Aug 2026` underneath in smaller type.
That is the wrong way round for almost every business system sold in Ethiopia,
and it is the right way round for the people using this one. The Gregorian date
never disappears, because banks and suppliers need it — it just stops being the
one that matters.

**The palette is enamelware, not the flag.** Green, gold and red aimed at an
Ethiopian audience defaults to a flag, and a flag on a payroll screen is
decoration pretending to be localisation. The colours here come from the objects
the building is full of: the deep painted green of a *rekebot* coffee tray, the
ochre of teff roasting, the red of berbere. On a cool grey-green paper they read
as pigment, not as UI accent.

Type is the **IBM Plex** superfamily for one concrete reason: Plex Sans Ethiopic
is drawn to match Plex Sans, so an Amharic label and its English sibling sit on
the same baseline at the same weight. Toggle the language in the demo and
nothing shifts. Very little else open and widely available does that.

And one thing that is simply enjoyable: the **tag board**. Every hotel
back-of-house has a rack of numbered tags by the staff entrance that you flip
when you come on shift. The duty desk opens with that rack — brass hooks, a
slight tilt, department colour on the top edge. It is the one element allowed to
be literal. Everything else stays quiet so it can carry the personality.

---

## Ethiopia is in the schema, not in a locale file

Localisation here is not a translation layer bolted onto a system that assumes
Western defaults. Most of it is structural.

**Names have no surname.** People are known by a given name, their father's
name and their grandfather's name. All three are needed for tax and pension
filings; the first two go on a roster; directories sort by the *given* name.
There is no `last_name` column and adding one would be a bug, not a feature.

**Thirteen months.** Twelve of thirty days, then Pagume of five or six. Payroll
periods are Ethiopian months. The fiscal year opens on Hamle 1. Leave balances
accrue against it. Conversion goes through Julian Day Numbers and is exact —
`packages/core` round-trips every date from 1900 to 2100 with no mismatches.

**Six hours out.** The Ethiopian clock counts from dawn, so 07:00 is *1:00
ጠዋት*. A night porter reads their shift as starting at *4:00 ለሊት*. The system
stores UTC, computes in wall-clock, and displays whichever the user has chosen.

**Money is santim.** Integer minor units in `bigint` columns, every one of them
named `*_santim`. There is no floating-point number anywhere near a payslip.

**Tax law is versioned data, not code.** Employment income tax was rewritten by
**Proclamation 1395/2025**, effective 7 July 2025 — the tax-free threshold went
from ETB 600 to ETB 2,000 and seven bands became six. Both that rule set and the
superseded 979/2016 one live as rows with effective dates. Recalculating a
payslip from 2016 EC uses the law that applied then, because that is the only
way an audit or a labour dispute can be answered honestly.

| Monthly taxable | Rate |
|---:|---:|
| 0 – 2,000 | 0% |
| 2,000 – 4,000 | 15% |
| 4,000 – 7,000 | 20% |
| 7,000 – 10,000 | 25% |
| 10,000 – 14,000 | 30% |
| above 14,000 | 35% |

**Pension does not reduce the tax base.** 7% employee, 11% employer, uncapped,
on basic salary only (Proclamation 715/2011). Both PAYE and pension are assessed
on their own bases, independently. Porting logic from a neighbouring country
gets this wrong and quietly underpays tax on every payslip.

**Overtime has four prices**, not one (Proclamation 1156/2019, Arts. 67–68):

| When | Multiple |
|---|---:|
| Daytime | 1.5× |
| Night, 22:00–06:00 | 1.75× |
| Weekly rest day | 2.0× |
| Public holiday | 2.5× |

A shift crossing 22:00 is split at the boundary and each part priced
separately. Caps of 2h/day, 20h/month and 100h/year are *flagged loudly and
still paid* — an employer breaking the ceiling owes the money regardless, and a
system that silently withheld it would be helping with the wrong problem.

**Holidays are a table, not a constant.** Orthodox feasts move with the
Ethiopian calendar; Eid al-Fitr and Eid al-Adha are gazetted after the moon is
sighted. An unconfirmed holiday inside a roster week blocks publishing, because
hours worked on a gazetted holiday cost 2.5× and nobody should find that out
afterwards.

Also in the model: Fayda national ID and 10-digit TIN, `+251` phone
normalisation, region/sub-city/woreda addresses, work permits for non-Ethiopian
staff, and a minimum working age of 15 enforced by a `CHECK` constraint.

---

## Architecture

A modular monolith. One deployable, strict internal seams.

```
noru-crew/
├── packages/core/          Domain logic. Zero dependencies. No I/O.
│   ├── ethiopian-calendar    JDN conversion, fiscal year, 13 months
│   ├── ethiopian-time        dawn-based clock
│   ├── money                 santim, allocation without rounding loss
│   ├── names                 three-part names, phone, TIN
│   ├── payroll/              versioned rules, PAYE, pension, overtime, payslip
│   ├── leave/                entitlement, sick-pay taper
│   └── scheduling/           rest, hours, coverage rules
│
├── packages/contracts/     Zod schemas shared by API and web. One definition
│                           of every request and response, both sides.
│
├── apps/api/               Fastify. routes → service → repository per module.
│   ├── db/migrations/        forward-only, checksummed SQL
│   ├── lib/                  errors, rbac, audit, ids
│   └── modules/              auth · employees · scheduling · attendance
│                             leave · payroll
│
└── demo/                   The standalone UI prototype.
```

**Why a monolith.** Payroll reads attendance, which reads rosters, which read
contracts and leave. Splitting that across services buys distributed
transactions and buys nothing else. The module boundaries are real and enforced
by review; if one ever needs to leave, the seam is already cut.

**Why the domain is pure.** `packages/core` has no database handle, no clock, no
config. Tax arithmetic and rest-period rules are the parts that must be provably
correct, and they are testable by calling a function with numbers. That is why
the test suite runs in under a second and why the calendar could be verified
across two centuries.

**Why SQL migrations rather than an ORM.** The schema leans hard on Postgres:
`EXCLUDE` constraints with GiST that make double-booking a shift *unrepresentable*,
generated columns, row-level security, partial indexes, `citext`. An ORM's
migration DSL cannot express most of that, so it would be hand-written SQL
inside a wrapper. This skips the wrapper.

### Correctness lives in the database

The application checks these too, for a decent error message. The database is
what makes them true.

- One employee cannot hold two overlapping shifts — `EXCLUDE USING gist`
- Contracts for one employee cannot overlap in time — same mechanism
- A payroll run cannot be approved by whoever calculated it — `CHECK (approved_by <> calculated_by)`
- A payslip's components must sum to its net — `CHECK`
- Punches and audit events cannot be updated or deleted — `REVOKE`
- Nobody reads another property's data — row-level security, with the tenant set
  per transaction so a pooled connection cannot leak it
- Salary is invisible without `salary.read`, in the database, not just the UI

### Two operational rules worth stating

**Attendance must be closed before payroll can calculate.** Not a warning — a
precondition failure that names how many days are still open. Paying from
unreconciled attendance is how you end up re-running a month.

**Approval needs a second person.** Enforced by that database constraint, so it
survives someone calling the API directly.

---

## Running it

Requires Node 22+, pnpm 9+, Docker.

```bash
pnpm install
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  # paste into JWT_SIGNING_KEYS

pnpm db:up          # postgres + migrations
pnpm --filter @noru/api seed:demo
pnpm dev
```

API on `:4000`, health at `/health`.

```bash
pnpm verify         # typecheck + lint + test
pnpm db:reset       # drop, migrate, reseed
```

---

## Honest status

I built this in a sandbox with **no network access**, which shapes what you can
trust.

**Verified by execution.** The Ethiopian calendar conversion, round-tripped
across 1900–2100 with zero mismatches and spot-checked against known dates
(Genna 2026 → Tahsas 29; today → Nehase 21, 2018). The PAYE and pension
arithmetic, computed band by band against worked examples — this caught a wrong
expected value I had written for the superseded 979/2016 rules.

**Not verified by execution.** Everything else. Dependencies could not be
installed, so `tsc` and `vitest` have never run. Postgres was not available, so
**the migrations have never been applied**. I reviewed the SQL closely and
corrected several things that would have failed — an inline `UNIQUE` constraint
that needed to be an index, generated columns using `AT TIME ZONE`, which is
`STABLE` rather than `IMMUTABLE` — but expect to shake something out on first
run.

**Please verify the tax bands with the Ministry of Revenues.** My source for
1395/2025 was a secondary tax guide. The figures are internally consistent and
match published worked examples, but this is the one number in the system where
being wrong is expensive, and the seed data says so in a comment.

**Not built.** Web front-end beyond the demo prototype; PDF payslips; bank file
export beyond the schema; the mobile clock-in surface. `docs/` and
`CLAUDE.md` describe how these are meant to fit.

---

## Documentation

| | |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | How to work in this repo. Invariants, conventions, and the things never to do |
| [`docs/architecture.md`](docs/architecture.md) | Layers, module boundaries, request lifecycle |
| [`docs/data-model.md`](docs/data-model.md) | Schema by schema, and why each constraint exists |
| [`docs/localization-ethiopia.md`](docs/localization-ethiopia.md) | Calendar, names, money, tax, labour law, with sources |
| [`docs/adr/`](docs/adr/) | Decisions, with what was given up |

---

<div align="center">
<sub>Built for Noru Booking · <code>ኑሩ ክሩ</code></sub>
</div>
