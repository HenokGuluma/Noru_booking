# 4. Tax rules are versioned data

**Status:** accepted · **Date:** 2026-08

## Context

Ethiopian employment income tax was rewritten by Proclamation 1395/2025,
effective 7 July 2025 — the tax-free threshold tripled and seven bands became
six. It will change again.

## Decision

`payroll.rule_sets` and `payroll.tax_brackets` hold rates and thresholds as rows
with effective dates. An `EXCLUDE` constraint guarantees one set in force per
day. `ruleSetFor(date)` resolves them and **throws** when none applies. Every
payslip pins the `rule_set_id` it used.

## Why

Rates in code mean a historical payslip recalculates under today's law, which is
wrong in an audit, wrong in a labour dispute, and wrong in a tax reassessment.
Pinning the rule set makes any past payslip reproducible exactly.

Throwing rather than defaulting is the point. A silent fallback to the newest
set would produce plausible, wrong numbers — the worst failure mode available in
a payroll system.

## Cost

A rule change is a migration rather than a constant edit, and the calculator
must be handed a date. Both are features.

Both current and superseded band sets ship seeded. **The current bands should be
verified against the Ministry of Revenues before production** — the source used
was secondary, and the seed data says so.
