import { type Santim, ZERO, multiply, santim } from '../money';
import type { OvertimeRules, PayrollRuleSet } from './rules';

export type OvertimeCategory = 'day' | 'night' | 'weekly_rest_day' | 'public_holiday';

export const OVERTIME_CATEGORIES: Record<OvertimeCategory, { label: string; labelAm: string }> = {
  day: { label: 'Day overtime', labelAm: 'የቀን ትርፍ ሰዓት' },
  night: { label: 'Night overtime', labelAm: 'የሌሊት ትርፍ ሰዓት' },
  weekly_rest_day: { label: 'Weekly rest day', labelAm: 'የሳምንት ዕረፍት ቀን' },
  public_holiday: { label: 'Public holiday', labelAm: 'የበዓል ቀን' },
};

export interface OvertimeBuckets {
  day: number;
  night: number;
  weekly_rest_day: number;
  public_holiday: number;
}

export const EMPTY_BUCKETS: OvertimeBuckets = {
  day: 0,
  night: 0,
  weekly_rest_day: 0,
  public_holiday: 0,
};

export interface OvertimeLine {
  category: OvertimeCategory;
  hours: number;
  multiplier: number;
  hourlyRateSantim: Santim;
  amountSantim: Santim;
}

export interface OvertimeResult {
  hourlyRateSantim: Santim;
  lines: OvertimeLine[];
  totalHours: number;
  totalSantim: Santim;
  /** Statutory ceilings that this month's hours breached, for the compliance banner. */
  breaches: string[];
}

export function hourlyRate(basicSalary: Santim, rules: PayrollRuleSet): Santim {
  return santim(Math.round(basicSalary / rules.monthlyToHourlyDivisor));
}

export function multiplierFor(category: OvertimeCategory, rules: OvertimeRules): number {
  switch (category) {
    case 'day':
      return rules.dayMultiplier;
    case 'night':
      return rules.nightMultiplier;
    case 'weekly_rest_day':
      return rules.weeklyRestDayMultiplier;
    case 'public_holiday':
      return rules.publicHolidayMultiplier;
  }
}

/**
 * Price a month of overtime.
 *
 * `yearToDateHours` lets the engine flag the annual ceiling. Breaches do not
 * block payment — the employee worked the hours and must be paid for them — but
 * they are surfaced so HR can correct the roster, which is where the problem is.
 */
export function calculateOvertime(
  basicSalary: Santim,
  buckets: OvertimeBuckets,
  rules: PayrollRuleSet,
  context: { yearToDateHours?: number } = {},
): OvertimeResult {
  const rate = hourlyRate(basicSalary, rules);
  const lines: OvertimeLine[] = [];
  let total = ZERO;
  let totalHours = 0;

  for (const category of Object.keys(buckets) as OvertimeCategory[]) {
    const hours = buckets[category];
    if (hours <= 0) continue;
    const multiplier = multiplierFor(category, rules.overtime);
    const amount = multiply(rate, hours * multiplier);
    total = santim(total + amount);
    totalHours += hours;
    lines.push({ category, hours, multiplier, hourlyRateSantim: rate, amountSantim: amount });
  }

  const breaches: string[] = [];
  const { maxHoursPerMonth, maxHoursPerYear, legalBasis } = rules.overtime;
  if (totalHours > maxHoursPerMonth) {
    breaches.push(
      `${totalHours}h overtime exceeds the ${maxHoursPerMonth}h monthly limit (${legalBasis})`,
    );
  }
  const ytd = (context.yearToDateHours ?? 0) + totalHours;
  if (ytd > maxHoursPerYear) {
    breaches.push(`${ytd}h year-to-date exceeds the ${maxHoursPerYear}h annual limit (${legalBasis})`);
  }

  return { hourlyRateSantim: rate, lines, totalHours, totalSantim: total, breaches };
}

/**
 * Classify a worked interval into overtime buckets. Night hours are those
 * between 22:00 and 06:00, so a 21:00-01:00 stretch splits 1h day / 3h night
 * rather than being rounded to whichever rate is convenient.
 */
export function classifyInterval(
  startMinutes: number,
  endMinutes: number,
  context: { isWeeklyRestDay?: boolean; isPublicHoliday?: boolean } = {},
): OvertimeBuckets {
  if (endMinutes <= startMinutes) throw new RangeError('Interval must end after it starts');
  const hours = (endMinutes - startMinutes) / 60;

  if (context.isPublicHoliday) return { ...EMPTY_BUCKETS, public_holiday: hours };
  if (context.isWeeklyRestDay) return { ...EMPTY_BUCKETS, weekly_rest_day: hours };

  let nightMinutes = 0;
  for (let m = startMinutes; m < endMinutes; m += 1) {
    const hourOfDay = Math.floor((m % 1440) / 60);
    if (hourOfDay >= 22 || hourOfDay < 6) nightMinutes += 1;
  }
  return {
    ...EMPTY_BUCKETS,
    night: nightMinutes / 60,
    day: hours - nightMinutes / 60,
  };
}
