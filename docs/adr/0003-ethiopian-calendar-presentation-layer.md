# 3. Store Gregorian, present Ethiopian

**Status:** accepted · **Date:** 2026-08

## Context

Users read Ethiopian dates. Postgres, banks, the JavaScript `Date` object and
every library do not.

## Decision

Store `date` and `timestamptz` in Gregorian/UTC. Convert at the edges. Display
the Ethiopian date **first**, Gregorian beneath it in smaller type.

The exception: **payroll periods are Ethiopian months**, stored as
`(ethiopian_year, ethiopian_month)` alongside their Gregorian span. So are leave
balance years (Hamle 1 – Sene 30).

## Why

Storing Ethiopian dates would break every date function, index and range query
in the database, in exchange for saving a conversion the display layer does
anyway.

But payroll and leave are genuinely *keyed* by Ethiopian periods — "Nehase 2018"
is the run's identity, not a rendering of 7 August to 5 September. Storing only
the Gregorian span would lose that.

Presenting Ethiopian first is a deliberate inversion of what most business
software sold in Ethiopia does. The people using this read Nehase 21 first. The
Gregorian date stays visible because banks and suppliers need it.

## Cost

Conversion at every boundary, and a domain function needed for anything the
database would otherwise do — "add one month" cannot be `INTERVAL '1 month'`.
The conversion is exact and tested across 1900–2100, so this is cheap.
