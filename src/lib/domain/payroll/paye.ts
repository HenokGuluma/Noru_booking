import { type Santim, ZERO, multiply, santim, subtract } from '../money';
import type { PayrollRuleSet, TaxBracket } from './rules';

export interface TaxBand {
  fromSantim: Santim;
  toSantim: Santim | null;
  rate: number;
  taxableInBandSantim: Santim;
  taxSantim: Santim;
}

export interface PayeResult {
  taxableIncomeSantim: Santim;
  taxSantim: Santim;
  /** Per-band breakdown, so a payslip can show its working and an auditor can follow it. */
  bands: TaxBand[];
  marginalRate: number;
  effectiveRate: number;
}

/**
 * Employment income tax (PAYE), computed marginally band by band.
 *
 * Note for anyone porting logic from a neighbouring country: in Ethiopia the
 * employee's 7% pension contribution does **not** reduce the taxable base. PAYE
 * and pension are both assessed on full taxable gross, independently.
 */
export function calculatePaye(taxableIncome: Santim, rules: PayrollRuleSet): PayeResult {
  if (taxableIncome < 0) throw new RangeError('Taxable income cannot be negative');

  const bands: TaxBand[] = [];
  let total = ZERO;
  let marginalRate = 0;

  for (const bracket of rules.incomeTaxBrackets) {
    const taxableInBand = amountWithin(taxableIncome, bracket);
    if (taxableInBand <= 0) continue;
    const tax = multiply(taxableInBand, bracket.rate);
    total = santim(total + tax);
    marginalRate = bracket.rate;
    bands.push({
      fromSantim: bracket.fromSantim,
      toSantim: bracket.toSantim,
      rate: bracket.rate,
      taxableInBandSantim: taxableInBand,
      taxSantim: tax,
    });
  }

  return {
    taxableIncomeSantim: taxableIncome,
    taxSantim: total,
    bands,
    marginalRate,
    effectiveRate: taxableIncome === 0 ? 0 : total / taxableIncome,
  };
}

function amountWithin(income: Santim, bracket: TaxBracket): Santim {
  const upper = bracket.toSantim === null ? income : Math.min(income, bracket.toSantim);
  return santim(Math.max(0, upper - bracket.fromSantim));
}

export interface PensionResult {
  employeeSantim: Santim;
  employerSantim: Santim;
  pensionableSantim: Santim;
}

/**
 * Pension contributions. Assessed on **basic salary**, not on allowances or
 * overtime — a distinction that quietly costs hotels money when it is got wrong,
 * because service charge and shift allowances are not pensionable.
 */
export function calculatePension(
  basicSalary: Santim,
  rules: PayrollRuleSet,
  options: { isNonResident?: boolean } = {},
): PensionResult {
  if (options.isNonResident && !rules.pension.appliesToNonResidents) {
    return { employeeSantim: ZERO, employerSantim: ZERO, pensionableSantim: ZERO };
  }
  const ceiling = rules.pension.ceilingSantim;
  const pensionable = ceiling === null ? basicSalary : santim(Math.min(basicSalary, ceiling));
  return {
    pensionableSantim: pensionable,
    employeeSantim: multiply(pensionable, rules.pension.employeeRate),
    employerSantim: multiply(pensionable, rules.pension.employerRate),
  };
}

/** Gross-up helper: the basic salary that yields a target net pay. Binary search, exact to the santim. */
export function grossUpToNet(targetNet: Santim, rules: PayrollRuleSet): Santim {
  let low = 0;
  let high = Math.max(targetNet * 3, 100_00);
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const gross = santim(mid);
    const net = subtract(
      subtract(gross, calculatePaye(gross, rules).taxSantim),
      calculatePension(gross, rules).employeeSantim,
    );
    if (net < targetNet) low = mid + 1;
    else high = mid;
  }
  return santim(low);
}
