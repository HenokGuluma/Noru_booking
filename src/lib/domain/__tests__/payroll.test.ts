import { describe, expect, it } from 'vitest';
import { birrToSantim, formatBirr, allocate, santim } from '../money';
import { calculatePaye, calculatePension, grossUpToNet } from '../payroll/paye';
import { calculateOvertime, classifyInterval } from '../payroll/overtime';
import { buildPayslip, summariseRun } from '../payroll/payslip';
import { RULES_1395_2025, RULES_979_2016, ruleSetFor } from '../payroll/rules';

// Was `birrToSantim(n) / 100`, which re-multiplies by 100 instead of
// converting a Santim result back to birr — a no-op that let every assertion
// below compare santim against birr. Never caught because vitest had never
// actually run against this file (see README "Honest status"). Confirmed the
// domain engine itself is correct — its outputs match the worked examples in
// docs/localization-ethiopia.md exactly — before touching this line.
const birr = (n: number) => n / 100;

describe('PAYE under Proclamation 1395/2025', () => {
  // Worked examples published alongside the 2025 amendment.
  it.each([
    [5_000, 500],
    [10_000, 1_650],
    [20_000, 4_950],
  ])('taxes ETB %i at ETB %i', (gross, expected) => {
    const result = calculatePaye(birrToSantim(gross), RULES_1395_2025);
    expect(birr(result.taxSantim)).toBe(expected);
  });

  it('exempts income at or below the ETB 2,000 threshold', () => {
    expect(calculatePaye(birrToSantim(2_000), RULES_1395_2025).taxSantim).toBe(0);
    expect(calculatePaye(birrToSantim(2_001), RULES_1395_2025).taxSantim).toBe(15);
  });

  it('shows its working band by band', () => {
    const { bands, marginalRate, effectiveRate } = calculatePaye(
      birrToSantim(20_000),
      RULES_1395_2025,
    );
    expect(bands).toHaveLength(6);
    expect(bands.at(-1)).toMatchObject({ rate: 0.35 });
    expect(marginalRate).toBe(0.35);
    expect(effectiveRate).toBeCloseTo(0.2475, 4);
  });

  it('still reproduces payslips issued under the superseded 979/2016 bands', () => {
    expect(birr(calculatePaye(birrToSantim(5_000), RULES_979_2016).taxSantim)).toBe(697.5);
    expect(ruleSetFor('2024-03-01').id).toBe('et-2016-07');
    expect(ruleSetFor('2026-03-01').id).toBe('et-2025-07');
  });

  it('refuses to guess when no rule set covers the period', () => {
    expect(() => ruleSetFor('1999-01-01')).toThrow(/No payroll rule set covers/);
  });
});

describe('pension', () => {
  it('takes 7% from the employee and 11% from the employer, uncapped', () => {
    const result = calculatePension(birrToSantim(25_000), RULES_1395_2025);
    expect(birr(result.employeeSantim)).toBe(1_750);
    expect(birr(result.employerSantim)).toBe(2_750);
  });

  it('exempts non-resident staff from the national scheme', () => {
    const result = calculatePension(birrToSantim(50_000), RULES_1395_2025, { isNonResident: true });
    expect(result.employeeSantim).toBe(0);
    expect(result.employerSantim).toBe(0);
  });

  it('does not reduce the PAYE base — a difference from neighbouring systems', () => {
    const gross = birrToSantim(10_000);
    const pension = calculatePension(gross, RULES_1395_2025);
    const payeOnFullGross = calculatePaye(gross, RULES_1395_2025).taxSantim;
    const payeOnNetOfPension = calculatePaye(
      santim(gross - pension.employeeSantim),
      RULES_1395_2025,
    ).taxSantim;
    expect(payeOnFullGross).toBe(birrToSantim(1_650));
    expect(payeOnFullGross).toBeGreaterThan(payeOnNetOfPension);
  });

  it('grosses up to a target net exactly', () => {
    const gross = grossUpToNet(birrToSantim(7_650), RULES_1395_2025);
    expect(birr(gross)).toBe(10_000);
  });
});

describe('overtime under Proclamation 1156/2019', () => {
  it('splits an interval across the 22:00 night boundary', () => {
    // 21:00 to 01:00 — one day hour, three night hours.
    const buckets = classifyInterval(21 * 60, 25 * 60);
    expect(buckets.day).toBe(1);
    expect(buckets.night).toBe(3);
  });

  it('sends every hour of a public holiday to the 2.5x bucket', () => {
    const buckets = classifyInterval(6 * 60, 14 * 60, { isPublicHoliday: true });
    expect(buckets.public_holiday).toBe(8);
    expect(buckets.day).toBe(0);
  });

  it('prices each category at its statutory multiplier', () => {
    const basic = birrToSantim(10_400); // ETB 50/hour on the 208 divisor
    const result = calculateOvertime(
      basic,
      { day: 2, night: 2, weekly_rest_day: 4, public_holiday: 0 },
      RULES_1395_2025,
    );
    expect(birr(result.hourlyRateSantim)).toBe(50);
    expect(birr(result.totalSantim)).toBe(2 * 50 * 1.5 + 2 * 50 * 1.75 + 4 * 50 * 2);
  });

  it('flags the monthly ceiling without withholding pay', () => {
    const result = calculateOvertime(
      birrToSantim(10_400),
      { day: 25, night: 0, weekly_rest_day: 0, public_holiday: 0 },
      RULES_1395_2025,
    );
    expect(result.totalSantim).toBeGreaterThan(0);
    expect(result.breaches[0]).toMatch(/exceeds the 20h monthly limit/);
  });
});

describe('payslip', () => {
  it('assembles a front-office supervisor\u2019s month', () => {
    const slip = buildPayslip({
      employeeId: 'emp_001',
      periodEnd: '2026-08-31',
      basicSalarySantim: birrToSantim(12_000),
      allowances: [
        {
          code: 'TRANSPORT',
          label: 'Transport allowance',
          amountSantim: birrToSantim(1_200),
          taxable: false,
          pensionable: false,
        },
        {
          code: 'SERVICE_CHARGE',
          label: 'Service charge share',
          amountSantim: birrToSantim(2_400),
          taxable: true,
          pensionable: false,
        },
      ],
      overtime: { day: 4, night: 2, weekly_rest_day: 0, public_holiday: 0 },
    });

    expect(slip.ruleSetId).toBe('et-2025-07');
    // Pension is charged on basic only, never on service charge or overtime.
    expect(birr(slip.pension.employeeSantim)).toBe(840);
    expect(birr(slip.pension.employerSantim)).toBe(1_320);
    // The exempt transport allowance sits in gross but outside the tax base.
    expect(slip.taxableGrossSantim).toBe(slip.grossSantim - birrToSantim(1_200));
    expect(slip.netPaySantim).toBe(
      slip.grossSantim - slip.paye.taxSantim - slip.pension.employeeSantim,
    );
    expect(slip.employerCostSantim).toBe(slip.grossSantim + slip.pension.employerSantim);
  });

  it('prorates basic salary for unpaid absence', () => {
    const slip = buildPayslip({
      employeeId: 'emp_002',
      periodEnd: '2026-08-31',
      basicSalarySantim: birrToSantim(5_200),
      unpaidAbsenceDays: 2,
      workingDaysInPeriod: 26,
    });
    expect(birr(slip.earnings[0].amountSantim)).toBe(4_800);
    expect(slip.warnings[0]).toMatch(/prorated/);
  });

  it('totals a run without losing a santim', () => {
    const slips = [12_000, 5_200, 3_100, 28_500].map((salary, index) =>
      buildPayslip({
        employeeId: `emp_${index}`,
        periodEnd: '2026-08-31',
        basicSalarySantim: birrToSantim(salary),
      }),
    );
    const totals = summariseRun(slips);
    expect(totals.headcount).toBe(4);
    expect(totals.grossSantim).toBe(birrToSantim(48_800));
    expect(totals.netPaySantim).toBe(
      totals.grossSantim - totals.payeSantim - totals.employeePensionSantim,
    );
  });
});

describe('money', () => {
  it('allocates without evaporation', () => {
    const shares = allocate(birrToSantim(100), 3);
    expect(shares).toEqual([3334, 3333, 3333]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(birrToSantim(100));
  });

  it('rejects fractional santim rather than rounding silently', () => {
    expect(() => santim(10.5)).toThrow(/whole number/);
  });

  it('formats in ETB', () => {
    expect(formatBirr(birrToSantim(12_450.5))).toMatch(/ETB\s?12,450\.50/);
  });
});
