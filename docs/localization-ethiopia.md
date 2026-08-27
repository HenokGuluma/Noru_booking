# Ethiopia

What is different, where it lives in the code, and what it is based on.

Nothing here is a translation layer. Almost all of it is structural, and most of
it would be a defect to "simplify".

---

## Calendar

Thirteen months: twelve of thirty days, then Pagume of five (six in a leap
year). The year is leap when `year % 4 === 3`. New Year — Enkutatash, Meskerem 1
— falls on 11 September, or 12 September before a Gregorian leap year.

The Ethiopian year runs roughly seven to eight years behind the Gregorian one:
27 August 2026 is **Nehase 21, 2018**.

`packages/core/ethiopian-calendar.ts` converts through Julian Day Numbers with
the Amete Mihret epoch (`JDN 1723856`). Verified by round-tripping every date
from 1900 to 2100 — no mismatches — and spot-checked against Genna (7 January
2026 → Tahsas 29) and today's date.

**Fiscal year: Hamle 1 to Sene 30**, which is roughly 8 July to 7 July. Leave
balances accrue against it and are keyed by it. Payroll periods are Ethiopian
months, mapped to their Gregorian span for banking.

**The Ethiopian date is displayed first everywhere.** Gregorian sits beneath it
in smaller type and never disappears — banks, suppliers and immigration all need
it.

## Clock

The day is counted from dawn, six hours offset from the international clock:

```
07:00 → 1:00 ጠዋት (tewat, morning)
13:00 → 7:00 ከሰዓት (keseat, afternoon)
19:00 → 1:00 ማታ (mata, evening)
23:00 → 5:00 ለሊት (lelit, night)
```

`hour = ((h24 + 6) % 12) || 12`, plus the period name.

Storage is UTC; computation is wall-clock; display follows the user's toggle.
Ethiopia is UTC+3 with no daylight saving, which is why generated wall-clock
columns in the schema are exact.

**The operating day starts at 06:00.** A shift beginning at 22:00 belongs to the
day it started, not the day it ends. `instantToWorkDate` applies this.

## Names

Three parts, no family name: given name, father's name, grandfather's name.

| Context | Form |
|---|---|
| Roster, list, greeting | given + father's |
| Contract, payslip, MoR and pension filings | all three |
| Sorting, search, directory | **given name first** |

Amharic variants are stored alongside the Latin ones and indexed together, so
searching either script finds the person.

There is no `last_name` column. Adding one to satisfy an integration is a
regression — map at the boundary.

## Money

**Santim.** 1 ETB = 100 santim. Every monetary column is `bigint`, suffixed
`*_santim`; every TypeScript value is the branded `Santim` type. Division uses
`allocate`, which distributes remainders so nothing evaporates.

Display is `Intl.NumberFormat` with the ETB code — `ETB 11,321.24`.

## Employment income tax (PAYE)

Rewritten by **Proclamation 1395/2025**, in force from **7 July 2025**. The
tax-free threshold rose from ETB 600 to ETB 2,000; seven bands became six.

| Monthly taxable income (ETB) | Rate |
|---:|---:|
| 0 – 2,000 | 0% |
| 2,000 – 4,000 | 15% |
| 4,000 – 7,000 | 20% |
| 7,000 – 10,000 | 25% |
| 10,000 – 14,000 | 30% |
| above 14,000 | 35% |

Worked: ETB 5,000 → 500.00. ETB 10,000 → 1,650.00. ETB 20,000 → 4,950.00.

The superseded **Proclamation 979/2016** set (600 / 1,650 / 3,200 / 5,250 /
7,800 / 10,900 thresholds) is retained as a versioned rule set so periods before
7 July 2025 recalculate correctly. ETB 5,000 under those rules → 697.50.

Both live in `payroll.rule_sets` and `payroll.tax_brackets` as rows with
effective dates. `ruleSetFor(date)` throws rather than guessing when no set
applies.

> **Verify the current bands with the Ministry of Revenues before going live.**
> The source used here was a secondary tax guide. The figures are internally
> consistent and match published worked examples, but this is the number where
> being wrong is most expensive.

## Pension

**Proclamation 715/2011.** Private-sector employees contribute **7%**, employers
**11%**, uncapped, on **basic salary only** — not on allowances or overtime.

Pension does **not** reduce taxable income. PAYE and pension are assessed
independently on their own bases. Several neighbouring systems allow a
deduction; copying that logic underpays tax on every payslip.

Contributions go to POESSA. Both PAYE and pension are due by the **8th of the
following Gregorian month**.

## Overtime

**Proclamation 1156/2019, Arts. 67–68.** Hourly basis is monthly salary ÷ 208.

| | Multiple |
|---|---:|
| Daytime | 1.5× |
| Night, 22:00 – 06:00 | 1.75× |
| Weekly rest day | 2.0× |
| Public holiday | 2.5× |

A shift crossing 22:00 is split at the boundary and each part priced separately
(`classifyInterval`).

Caps: **2h/day, 20h/month, 100h/year**. Breaches are flagged prominently and
**still paid** — an employer who exceeds the ceiling owes the money regardless,
and withholding it would penalise the worker for the employer's breach.

## Working time and rest

- 8 hours a day, 48 hours a week
- Minimum 12 hours between shifts
- Minimum 24 consecutive hours of weekly rest
- Probation: maximum 60 working days
- Minimum working age 15, enforced by a `CHECK` constraint

A draft roster may break any of these. Publishing may not — blocking violations
must be resolved, warnings must be accepted with a recorded reason.

## Leave

**Annual** (Art. 77): 16 working days in the first year, plus one day for every
two further years of service — `16 + floor((years - 1) / 2)`. Counted against
the employee's own roster, so a rest day inside a leave period is not spent.

**Maternity**: 120 days — 30 before the expected date, 90 after.
**Paternity**: 3 days. **Marriage**: 3. **Bereavement**: 3.
**Family event**: 5, unpaid.

**Sick leave** (Art. 86), tapering over a rolling twelve months:

| Period | Pay |
|---|---|
| First month | Full |
| Second and third months | Half |
| Fourth to sixth months | Unpaid |
| Beyond six months | Exhausted |

## Public holidays

A **table**, never constants. Orthodox feasts — Genna, Timkat, Fasika, Meskel —
move with the Ethiopian calendar. Eid al-Fitr and Eid al-Adha are gazetted after
the moon is sighted and cannot be computed in advance with certainty.

An unconfirmed holiday inside a roster week **blocks publishing**, because hours
worked on a gazetted holiday cost 2.5× and nobody should discover that
afterwards.

## Identifiers and addresses

- **TIN** — 10 digits, validated
- **Fayda** — national digital ID, stored where present
- **Phone** — normalised to `+251` E.164; a `CHECK` constraint enforces it
- **Address** — region, sub-city (*kifle ketema*), woreda, kebele. No postcodes;
  Ethiopian addressing is not street-and-number
- **Work permits** — required for non-Ethiopian staff; a `CHECK` constraint ties
  nationality to permit presence, and expiry appears in `hr.upcoming_expiries`

## Language

English and Amharic throughout, switchable. Names, departments, leave types,
shift names and payslip labels are bilingual in the schema, not in a resource
file — an employee's name in Ge'ez is data about them, not a translation of a
UI string.

Type is IBM Plex Sans with **IBM Plex Sans Ethiopic**, which is drawn to match
it: the same baseline, weights and metrics, so switching language reflows
nothing.

---

## Sources

- Labour Proclamation No. 1156/2019 — hours, rest, overtime, leave, probation
- Federal Income Tax Proclamation No. 979/2016 — superseded PAYE bands
- Proclamation No. 1395/2025 — current PAYE bands, from 7 July 2025
- Private Organisation Employees' Pension Proclamation No. 715/2011 — 7% / 11%

Every rate and threshold in the code carries its citation in a comment. Where
the source was secondary rather than the gazette, the comment says so.
