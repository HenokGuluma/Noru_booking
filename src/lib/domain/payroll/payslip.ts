import { type Santim, ZERO, add, santim, subtract } from '../money';
import { calculatePaye, calculatePension, type PayeResult, type PensionResult } from './paye';
import { calculateOvertime, type OvertimeBuckets, type OvertimeResult } from './overtime';
import { ruleSetFor, type PayrollRuleSet } from './rules';

export interface EarningLine {
  code: string;
  label: string;
  labelAm?: string;
  amountSantim: Santim;
  /** Whether the line enters the PAYE base. Transport allowance is exempt up to a cap; service charge is not. */
  taxable: boolean;
  /** Whether the line enters the pension base. In practice only basic salary does. */
  pensionable: boolean;
}

export interface DeductionLine {
  code: string;
  label: string;
  labelAm?: string;
  amountSantim: Santim;
}

export interface PayslipInput {
  employeeId: string;
  /** Any date inside the payroll period; selects the rule set in force. */
  periodEnd: string;
  basicSalarySantim: Santim;
  /** Unpaid absence, expressed in working days, prorated against `workingDaysInPeriod`. */
  unpaidAbsenceDays?: number;
  workingDaysInPeriod?: number;
  allowances?: EarningLine[];
  overtime?: OvertimeBuckets;
  yearToDateOvertimeHours?: number;
  /** Loans, salary advances, staff-meal recovery, union dues, court orders. */
  otherDeductions?: DeductionLine[];
  isNonResident?: boolean;
  rules?: PayrollRuleSet;
}

export interface Payslip {
  employeeId: string;
  periodEnd: string;
  ruleSetId: string;
  earnings: EarningLine[];
  grossSantim: Santim;
  taxableGrossSantim: Santim;
  overtime: OvertimeResult | null;
  paye: PayeResult;
  pension: PensionResult;
  deductions: DeductionLine[];
  totalDeductionsSantim: Santim;
  netPaySantim: Santim;
  /** What this employee costs the property, including the 11% employer pension. */
  employerCostSantim: Santim;
  warnings: string[];
}

/**
 * Build one payslip.
 *
 * Deliberately pure: no database, no clock, no property settings lookup. The
 * payroll service gathers the inputs and this function turns them into numbers,
 * which is what makes the whole engine testable against MoR worked examples.
 */
export function buildPayslip(input: PayslipInput): Payslip {
  const rules = input.rules ?? ruleSetFor(input.periodEnd);
  const warnings: string[] = [];

  const proratedBasic = prorate(
    input.basicSalarySantim,
    input.unpaidAbsenceDays ?? 0,
    input.workingDaysInPeriod ?? 26,
  );
  if (proratedBasic < input.basicSalarySantim) {
    warnings.push(
      `Basic salary prorated for ${input.unpaidAbsenceDays} day(s) of unpaid absence`,
    );
  }

  const earnings: EarningLine[] = [
    {
      code: 'BASIC',
      label: 'Basic salary',
      labelAm: 'መሠረታዊ ደመወዝ',
      amountSantim: proratedBasic,
      taxable: true,
      pensionable: true,
    },
    ...(input.allowances ?? []),
  ];

  const overtime = input.overtime
    ? calculateOvertime(input.basicSalarySantim, input.overtime, rules, {
        yearToDateHours: input.yearToDateOvertimeHours,
      })
    : null;

  if (overtime && overtime.totalSantim > 0) {
    earnings.push({
      code: 'OT',
      label: 'Overtime',
      labelAm: 'ትርፍ ሰዓት',
      amountSantim: overtime.totalSantim,
      taxable: true,
      pensionable: false,
    });
    warnings.push(...overtime.breaches);
  }

  const gross = add(...earnings.map((line) => line.amountSantim));
  const taxableGross = add(
    ...earnings.filter((line) => line.taxable).map((line) => line.amountSantim),
  );
  const pensionableBase = add(
    ...earnings.filter((line) => line.pensionable).map((line) => line.amountSantim),
  );

  const paye = calculatePaye(taxableGross, rules);
  const pension = calculatePension(pensionableBase, rules, { isNonResident: input.isNonResident });

  const deductions: DeductionLine[] = [
    { code: 'PAYE', label: 'Employment income tax', labelAm: 'የደመወዝ ግብር', amountSantim: paye.taxSantim },
    { code: 'PENSION', label: 'Pension (7%)', labelAm: 'ጡረታ (7%)', amountSantim: pension.employeeSantim },
    ...(input.otherDeductions ?? []),
  ].filter((line) => line.amountSantim > 0);

  const totalDeductions = add(...deductions.map((line) => line.amountSantim));
  const netPay = subtract(gross, totalDeductions);

  if (netPay < 0) {
    warnings.push('Deductions exceed gross pay; recovery must be spread across periods');
  }

  return {
    employeeId: input.employeeId,
    periodEnd: input.periodEnd,
    ruleSetId: rules.id,
    earnings,
    grossSantim: gross,
    taxableGrossSantim: taxableGross,
    overtime,
    paye,
    pension,
    deductions,
    totalDeductionsSantim: totalDeductions,
    netPaySantim: netPay,
    employerCostSantim: add(gross, pension.employerSantim),
    warnings,
  };
}

function prorate(basic: Santim, unpaidDays: number, workingDays: number): Santim {
  if (unpaidDays <= 0) return basic;
  if (unpaidDays >= workingDays) return ZERO;
  return santim(Math.round((basic * (workingDays - unpaidDays)) / workingDays));
}

export interface PayrollRunTotals {
  headcount: number;
  grossSantim: Santim;
  payeSantim: Santim;
  employeePensionSantim: Santim;
  employerPensionSantim: Santim;
  netPaySantim: Santim;
  employerCostSantim: Santim;
}

/** Roll payslips up into the figures that go on the bank file and the MoR declaration. */
export function summariseRun(payslips: Payslip[]): PayrollRunTotals {
  return payslips.reduce<PayrollRunTotals>(
    (totals, slip) => ({
      headcount: totals.headcount + 1,
      grossSantim: add(totals.grossSantim, slip.grossSantim),
      payeSantim: add(totals.payeSantim, slip.paye.taxSantim),
      employeePensionSantim: add(totals.employeePensionSantim, slip.pension.employeeSantim),
      employerPensionSantim: add(totals.employerPensionSantim, slip.pension.employerSantim),
      netPaySantim: add(totals.netPaySantim, slip.netPaySantim),
      employerCostSantim: add(totals.employerCostSantim, slip.employerCostSantim),
    }),
    {
      headcount: 0,
      grossSantim: ZERO,
      payeSantim: ZERO,
      employeePensionSantim: ZERO,
      employerPensionSantim: ZERO,
      netPaySantim: ZERO,
      employerCostSantim: ZERO,
    },
  );
}
