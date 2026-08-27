# 5. Punches are append-only

**Status:** accepted · **Date:** 2026-08

## Context

Clock data is wrong regularly — forgotten punches, broken terminals, a manager
covering for a device failure. It is also the evidence in every wage dispute.

## Decision

`ops.punches` is the raw log with `UPDATE` and `DELETE` revoked. A correction is
a **new punch** carrying a supervisor's justification. `ops.attendance_days`
holds the reconciled view, mutable until `locked_at`, after which payroll may
read it and nothing may change it.

The same applies to `audit.events`.

## Why

Editing a punch destroys the only record of what the terminal actually saw.
Eighteen months later, "the system says 06:11" is worth nothing if the system
also allows anyone to have written 06:11.

Append-only means the original reading, the correction, who made it and why are
all recoverable. Locking gives payroll a stable input — a run cannot be
undermined by someone adjusting last month's attendance afterwards.

## Cost

More rows, and reconciliation is a real step rather than a query. Attendance
must be actively closed before payroll can calculate, which is friction — and
the friction is the control.
