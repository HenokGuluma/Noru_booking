# 1. A modular monolith, not services

**Status:** accepted · **Date:** 2026-08

## Context

Noru Booking runs several properties, each with a few hundred staff. The obvious
decomposition is people / scheduling / attendance / payroll.

## Decision

One deployable Fastify process with enforced internal module boundaries.

## Why

The natural service boundaries are exactly where the transactions are. A payroll
run reads contracts, attendance, leave, allowances and deductions and needs a
consistent snapshot of all of them. Across services that means distributed
transactions, or eventual consistency in the one place a business cannot
tolerate it — someone's pay.

The load does not justify it either. A few thousand punches a day per property is
a single-node workload for a long time.

## Cost

Everything scales together, and a bad deploy takes all of it down. Module
boundaries depend on review rather than the network to stay honest.

## When to revisit

If one module's load genuinely diverges, or teams grow past the point where one
repository is comfortable. The seams are already cut for it.
