# Data model

Six schemas, each with a clear owner. The database is not a persistence detail
here — it is where most of the correctness lives.

```
org      properties, departments, positions
hr       employees, contracts, documents, certifications, leave
ops      rosters, shifts, punches, attendance, holidays
payroll  rule sets, runs, payslips, filings
iam      users, roles, permissions, sessions
audit    append-only event log
```

---

## org

`properties` are hotels. Everything below is scoped to one, and row-level
security uses that scope. `departments` (Front Office, Housekeeping, F&B,
Kitchen, Engineering, Security, HR, Finance) carry bilingual names.

`positions` carry `required_certifications` as an array of codes — a food
handler's certificate, a lifeguard qualification. A lapsed certificate blocks
roster publishing, because working the role without it is a legal bar rather
than a reminder to renew.

## hr

### employees

Three name columns and their Amharic variants. No surname — see
[localization](localization-ethiopia.md#names).

`CHECK` constraints enforce, in the database:

- minimum working age 15 (Art. 89)
- `+251` E.164 phone format
- a non-Ethiopian employee must have a work permit
- TIN, where present, is 10 digits

A GIN index over a bilingual `tsvector` makes search work in either script.

### employment_contracts

Temporal and **insert-only**: a raise is a new row, not an update. A GiST
`EXCLUDE` constraint on `(employee_id, daterange)` makes two overlapping
contracts for one person unrepresentable.

This matters because payroll for a past period must read the contract that was
in force *then*. Updating a salary in place destroys that.

### leave_balances, leave_requests

Balances are keyed by **Ethiopian fiscal year** (Hamle 1 – Sene 30). Requests
carry an `EXCLUDE` constraint preventing overlapping live requests for one
employee.

## ops

### punches — append-only

The raw clock log. `UPDATE` and `DELETE` are revoked. A correction is a new
punch carrying a supervisor's justification, so the original stays visible.
Eighteen months later, that is the difference between resolving a wage dispute
and guessing.

### attendance_days — reconciled

One row per employee per operating day: rostered against actual, worked minutes,
and overtime split into the four buckets Ethiopian law prices separately. Mutable
until `locked_at` is set, after which payroll may read it and nothing may change
it.

### shift_assignments

Two things worth knowing.

**Double-booking is unrepresentable.** A GiST `EXCLUDE` on employee and time
range means the database refuses it — not a validation that could be bypassed.

**`local_starts_at` and `local_ends_at` are generated `timestamp` columns**, not
`timestamptz`. Generated columns must be `IMMUTABLE`, and `AT TIME ZONE` is only
`STABLE`, so the conversion is done arithmetically. This is exact only because
Ethiopia is UTC+3 with no daylight saving. Do not copy the pattern to a region
that has DST.

### public_holidays

A table, with a `confirmed_at` column. Orthodox feasts move with the Ethiopian
calendar; Eid is gazetted after the moon is sighted. An unconfirmed holiday in a
roster week blocks publishing, because those hours cost 2.5×.

## payroll

### rule_sets, tax_brackets

Tax law as versioned data. An `EXCLUDE` constraint guarantees exactly one set is
in force on any given day. Thresholds are stored in santim.

Never edit a set — insert a successor and close the predecessor. Every payslip
pins the `rule_set_id` it used.

### runs

A state machine: `draft → calculating → calculated → approved → paid`.

```sql
CONSTRAINT runs_four_eyes CHECK (approved_by IS NULL OR approved_by <> calculated_by)
```

The service checks this too, for a better message. The constraint is what makes
it true against someone calling the API directly.

### payslips

A **full snapshot**, not a set of foreign keys: name, position, basic salary,
every allowance and deduction line, the tax bands applied. A payslip must
reproduce identically in five years, after the employee has been promoted twice
and the law has changed once.

```sql
CONSTRAINT payslips_balances CHECK (net_pay_santim = gross_santim - total_deductions_santim)
```

## iam

Users, roles, permissions, and `user_roles` scoped optionally to a property or a
department — so a department head sees their own people and nobody else's.

Seven roles ship: group admin, HR manager, payroll officer, finance approver,
department head, duty manager, employee.

Sessions store the SHA-256 of a refresh token, never the token, with
`replaced_by` recording rotation so replay is detectable.

## audit

Append-only, `UPDATE` and `DELETE` revoked. Actor, action, entity, a JSON diff,
and — for actions in `REASON_REQUIRED` — a human-written reason. Salary changes,
terminations, attendance corrections, roster overrides and payroll approvals all
require one.

---

## Row-level security

Policies on employees, contracts, rosters, attendance, leave, runs and payslips.
`iam.accessible_properties()` and `iam.has_permission()` read a
transaction-scoped setting established by `withScope`.

The `set_config(..., true)` is load-bearing: without transaction scope the
setting survives on a pooled connection and leaks one property's data into the
next request.

Payslips have their own policy — own payslip, or `payslip.read` permission. An
employee sees their pay and nobody else's, enforced below the application.

## Views

| | |
|---|---|
| `hr.employee_directory` | Redacted directory, safe without `salary.read` |
| `ops.on_duty_now` | Who is clocked in — feeds the tag board |
| `hr.upcoming_expiries` | Contracts, permits and certificates lapsing soon |

## Conventions

Tables plural, columns singular. Booleans read as assertions (`is_taxable`).
Timestamps are past participles (`locked_at`, `published_at`). Money is `bigint`
suffixed `_santim`. Primary keys are UUIDv7 — time-ordered, so index locality
stays reasonable without leaking a count the way `SERIAL` does.
