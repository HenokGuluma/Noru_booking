/**
 * Money is represented as an integer number of **santim** (1 ETB = 100 santim).
 *
 * Rationale: floating point cannot represent 0.1 exactly, and payroll is one of
 * the few domains where a one-santim drift across 400 payslips is a real audit
 * finding. Every monetary value in the database is a `bigint` column suffixed
 * `_santim`, and every monetary value in this codebase is a `Santim`.
 *
 * Formatting to "ETB 12,450.00" happens once, at the presentation edge.
 */

export type Santim = number & { readonly __brand: 'Santim' };

const MAX_SAFE_SANTIM = Number.MAX_SAFE_INTEGER;

export function santim(value: number): Santim {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Santim must be a whole number, received ${value}`);
  }
  if (Math.abs(value) > MAX_SAFE_SANTIM) {
    throw new RangeError(`Santim value ${value} exceeds safe integer range`);
  }
  return value as Santim;
}

/** Parse a human-entered birr amount ("12,450.50") into santim. */
export function birrToSantim(birr: number | string): Santim {
  const normalised = typeof birr === 'string' ? Number(birr.replace(/[,\s]/g, '')) : birr;
  if (!Number.isFinite(normalised)) {
    throw new RangeError(`Cannot parse "${birr}" as an amount in birr`);
  }
  return santim(Math.round(normalised * 100));
}

export function santimToBirr(value: Santim): number {
  return value / 100;
}

export const ZERO = santim(0);

export function add(...values: Santim[]): Santim {
  return santim(values.reduce<number>((sum, v) => sum + v, 0));
}

export function subtract(a: Santim, b: Santim): Santim {
  return santim(a - b);
}

/**
 * Multiply money by a rate (e.g. a 0.07 pension rate or a 1.75 overtime
 * multiplier). Rounds half away from zero, which is what Ethiopian payroll
 * practice and the MoR declaration forms expect — not banker's rounding.
 */
export function multiply(value: Santim, rate: number): Santim {
  const product = value * rate;
  return santim(Math.sign(product) * Math.round(Math.abs(product)));
}

/**
 * Split an amount into `parts` shares that sum exactly to the original.
 * Remainder santim are handed to the earliest shares, so nothing evaporates.
 */
export function allocate(value: Santim, parts: number): Santim[] {
  if (parts < 1) throw new RangeError('Cannot allocate into fewer than one part');
  const base = Math.trunc(value / parts);
  const shares = Array.from({ length: parts }, () => santim(base));
  let remainder = value - base * parts;
  for (let i = 0; remainder !== 0; i = (i + 1) % parts) {
    const step = remainder > 0 ? 1 : -1;
    shares[i] = santim(shares[i] + step);
    remainder -= step;
  }
  return shares;
}

const BIRR_FORMATTERS = new Map<string, Intl.NumberFormat>();

/**
 * Format for display. `locale` is a BCP-47 tag: 'am-ET' renders Ethiopic
 * grouping conventions, 'en-ET' the Latin ones. Both use ETB.
 */
export function formatBirr(
  value: Santim,
  locale: 'en-ET' | 'am-ET' = 'en-ET',
  options: { withSymbol?: boolean } = {},
): string {
  const { withSymbol = true } = options;
  const key = `${locale}:${withSymbol}`;
  let formatter = BIRR_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: withSymbol ? 'currency' : 'decimal',
      currency: 'ETB',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    BIRR_FORMATTERS.set(key, formatter);
  }
  return formatter.format(santimToBirr(value));
}
