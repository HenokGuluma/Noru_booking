import { type Santim, birrToSantim } from '../money';

/**
 * Statutory payroll parameters.
 *
 * These are **versioned data, not constants**. Ethiopia rewrote its employment
 * income tax bands in July 2025 (Proclamation 1395/2025, amending 979/2016) and
 * will do so again. A payslip issued in Sene 2017 must stay reproducible with
 * the bands that applied then, so every rule set carries the ISO date it took
 * effect and the payroll engine resolves the set by period, never by "today".
 *
 * The database mirrors this shape in `payroll.rule_sets`; the constants below
 * are the seed and the offline fallback. When a rule changes, add a new entry —
 * never edit an existing one.
 *
 * Verify against the Ministry of Revenues (mor.gov.et) before each fiscal year.
 */

export interface TaxBracket {
  /** Inclusive lower bound of the band, in santim of monthly taxable income. */
  fromSantim: Santim;
  /** Exclusive upper bound, or null for the top band. */
  toSantim: Santim | null;
  /** Marginal rate, 0-1. */
  rate: number;
}

export interface PayrollRuleSet {
  id: string;
  effectiveFrom: string; // ISO date
  effectiveTo: string | null;
  legalBasis: string;
  incomeTaxBrackets: TaxBracket[];
  pension: {
    employeeRate: number;
    employerRate: number;
    /** Ethiopia caps nothing: contributions apply to the first birr and the last. */
    ceilingSantim: Santim | null;
    /** Non-resident staff are outside the national scheme. */
    appliesToNonResidents: boolean;
    legalBasis: string;
  };
  overtime: OvertimeRules;
  /**
   * Divisor turning a monthly basic salary into an hourly rate. 208 = 48 statutory
   * hours per week x 52 weeks / 12 months, the basis implied by Proclamation
   * 1156/2019 Art. 61. Some hotels contract on 40-hour weeks; that is a property
   * setting, not a national one.
   */
  monthlyToHourlyDivisor: number;
}

export interface OvertimeRules {
  /** Overtime worked between 06:00 and 22:00. */
  dayMultiplier: number;
  /** Overtime worked between 22:00 and 06:00. */
  nightMultiplier: number;
  /** Any hours on the employee's weekly rest day. */
  weeklyRestDayMultiplier: number;
  /** Any hours on a gazetted public holiday. */
  publicHolidayMultiplier: number;
  /** Art. 68(2): overtime is capped at 2h/day, 20h/month, 100h/year. */
  maxHoursPerDay: number;
  maxHoursPerMonth: number;
  maxHoursPerYear: number;
  legalBasis: string;
}

/** In force from 7 July 2025 — Federal Income Tax Amendment Proclamation 1395/2025. */
export const RULES_1395_2025: PayrollRuleSet = {
  id: 'et-2025-07',
  effectiveFrom: '2025-07-07',
  effectiveTo: null,
  legalBasis: 'Federal Income Tax (Amendment) Proclamation No. 1395/2025, Schedule A',
  incomeTaxBrackets: [
    { fromSantim: birrToSantim(0), toSantim: birrToSantim(2_000), rate: 0 },
    { fromSantim: birrToSantim(2_000), toSantim: birrToSantim(4_000), rate: 0.15 },
    { fromSantim: birrToSantim(4_000), toSantim: birrToSantim(7_000), rate: 0.2 },
    { fromSantim: birrToSantim(7_000), toSantim: birrToSantim(10_000), rate: 0.25 },
    { fromSantim: birrToSantim(10_000), toSantim: birrToSantim(14_000), rate: 0.3 },
    { fromSantim: birrToSantim(14_000), toSantim: null, rate: 0.35 },
  ],
  pension: {
    employeeRate: 0.07,
    employerRate: 0.11,
    ceilingSantim: null,
    appliesToNonResidents: false,
    legalBasis: 'Private Organisation Employees\u2019 Pension Proclamation No. 715/2011 (as amended)',
  },
  overtime: {
    dayMultiplier: 1.5,
    nightMultiplier: 1.75,
    weeklyRestDayMultiplier: 2,
    publicHolidayMultiplier: 2.5,
    maxHoursPerDay: 2,
    maxHoursPerMonth: 20,
    maxHoursPerYear: 100,
    legalBasis: 'Labour Proclamation No. 1156/2019, Arts. 67-68',
  },
  monthlyToHourlyDivisor: 208,
};

/** Superseded on 7 July 2025. Retained so historical payslips stay reproducible. */
export const RULES_979_2016: PayrollRuleSet = {
  ...RULES_1395_2025,
  id: 'et-2016-07',
  effectiveFrom: '2016-07-08',
  effectiveTo: '2025-07-06',
  legalBasis: 'Federal Income Tax Proclamation No. 979/2016, Schedule A',
  incomeTaxBrackets: [
    { fromSantim: birrToSantim(0), toSantim: birrToSantim(600), rate: 0 },
    { fromSantim: birrToSantim(600), toSantim: birrToSantim(1_650), rate: 0.1 },
    { fromSantim: birrToSantim(1_650), toSantim: birrToSantim(3_200), rate: 0.15 },
    { fromSantim: birrToSantim(3_200), toSantim: birrToSantim(5_250), rate: 0.2 },
    { fromSantim: birrToSantim(5_250), toSantim: birrToSantim(7_800), rate: 0.25 },
    { fromSantim: birrToSantim(7_800), toSantim: birrToSantim(10_900), rate: 0.3 },
    { fromSantim: birrToSantim(10_900), toSantim: null, rate: 0.35 },
  ],
};

export const ALL_RULE_SETS: readonly PayrollRuleSet[] = [RULES_979_2016, RULES_1395_2025];

/** Resolve the rule set in force on a given date. Throws rather than guessing. */
export function ruleSetFor(
  isoDate: string,
  sets: readonly PayrollRuleSet[] = ALL_RULE_SETS,
): PayrollRuleSet {
  const match = sets.find(
    (set) => isoDate >= set.effectiveFrom && (set.effectiveTo === null || isoDate <= set.effectiveTo),
  );
  if (!match) {
    throw new Error(
      `No payroll rule set covers ${isoDate}. Add one to payroll.rule_sets before running this period.`,
    );
  }
  return match;
}
