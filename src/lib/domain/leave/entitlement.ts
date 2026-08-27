/**
 * Statutory leave under Labour Proclamation No. 1156/2019.
 *
 * Hotels run 365 days a year, so leave here is always counted in **working
 * days** against the employee's own roster, never in calendar days. An employee
 * whose weekly rest day is Tuesday does not spend annual leave on a Tuesday.
 */

export type LeaveKind =
  | 'annual'
  | 'sick'
  | 'maternity'
  | 'paternity'
  | 'marriage'
  | 'bereavement'
  | 'family_event'
  | 'unpaid'
  | 'union_duty'
  | 'court_summons';

export interface LeaveTypeDefinition {
  kind: LeaveKind;
  label: string;
  labelAm: string;
  /** Fixed statutory allocation in working days, or null when it accrues or is unbounded. */
  statutoryDays: number | null;
  paid: boolean;
  /** Some entitlements are restricted by law to a given sex. */
  restrictedTo?: 'female' | 'male';
  accrues: boolean;
  requiresDocument: boolean;
  legalBasis: string;
}

export const LEAVE_TYPES: Record<LeaveKind, LeaveTypeDefinition> = {
  annual: {
    kind: 'annual',
    label: 'Annual leave',
    labelAm: 'ዓመታዊ ፈቃድ',
    statutoryDays: null,
    paid: true,
    accrues: true,
    requiresDocument: false,
    legalBasis: 'Proclamation 1156/2019 Art. 77',
  },
  sick: {
    kind: 'sick',
    label: 'Sick leave',
    labelAm: 'የሕመም ፈቃድ',
    statutoryDays: null,
    paid: true,
    accrues: false,
    requiresDocument: true,
    legalBasis: 'Proclamation 1156/2019 Arts. 85-86',
  },
  maternity: {
    kind: 'maternity',
    label: 'Maternity leave',
    labelAm: 'የወሊድ ፈቃድ',
    statutoryDays: 120,
    paid: true,
    restrictedTo: 'female',
    accrues: false,
    requiresDocument: true,
    legalBasis: 'Proclamation 1156/2019 Art. 88 (30 days pre-natal + 90 post-natal)',
  },
  paternity: {
    kind: 'paternity',
    label: 'Paternity leave',
    labelAm: 'የአባትነት ፈቃድ',
    statutoryDays: 3,
    paid: true,
    restrictedTo: 'male',
    accrues: false,
    requiresDocument: false,
    legalBasis: 'Proclamation 1156/2019 Art. 81(4)',
  },
  marriage: {
    kind: 'marriage',
    label: 'Marriage leave',
    labelAm: 'የጋብቻ ፈቃድ',
    statutoryDays: 3,
    paid: true,
    accrues: false,
    requiresDocument: false,
    legalBasis: 'Proclamation 1156/2019 Art. 81(1)(a)',
  },
  bereavement: {
    kind: 'bereavement',
    label: 'Bereavement leave',
    labelAm: 'የሐዘን ፈቃድ',
    statutoryDays: 3,
    paid: true,
    accrues: false,
    requiresDocument: false,
    legalBasis: 'Proclamation 1156/2019 Art. 81(1)(b)',
  },
  family_event: {
    kind: 'family_event',
    label: 'Family event leave',
    labelAm: 'የቤተሰብ ጉዳይ ፈቃድ',
    statutoryDays: 5,
    paid: false,
    accrues: false,
    requiresDocument: false,
    legalBasis: 'Proclamation 1156/2019 Art. 81(2)',
  },
  unpaid: {
    kind: 'unpaid',
    label: 'Unpaid leave',
    labelAm: 'ያለክፍያ ፈቃድ',
    statutoryDays: null,
    paid: false,
    accrues: false,
    requiresDocument: false,
    legalBasis: 'Contractual',
  },
  union_duty: {
    kind: 'union_duty',
    label: 'Union duty',
    labelAm: 'የማኅበር ተግባር',
    statutoryDays: null,
    paid: true,
    accrues: false,
    requiresDocument: true,
    legalBasis: 'Proclamation 1156/2019 Art. 82',
  },
  court_summons: {
    kind: 'court_summons',
    label: 'Court or official summons',
    labelAm: 'የፍርድ ቤት ጥሪ',
    statutoryDays: null,
    paid: true,
    accrues: false,
    requiresDocument: true,
    legalBasis: 'Proclamation 1156/2019 Art. 83',
  },
};

export const BASE_ANNUAL_LEAVE_DAYS = 16;

/**
 * Annual leave entitlement in working days.
 *
 * Art. 77: sixteen working days for the first year of service, plus one working
 * day for every two further years. Ten years of service therefore earns 20 days,
 * not 26 — the increment is biennial, which is the detail spreadsheets get wrong.
 */
export function annualLeaveEntitlement(
  completedYearsOfService: number,
  options: { contractualBonusDays?: number } = {},
): number {
  if (completedYearsOfService < 0) throw new RangeError('Years of service cannot be negative');
  const bonus = options.contractualBonusDays ?? 0;
  if (completedYearsOfService < 1) return BASE_ANNUAL_LEAVE_DAYS + bonus;
  return BASE_ANNUAL_LEAVE_DAYS + Math.floor((completedYearsOfService - 1) / 2) + bonus;
}

/** Leave earned part-way through the first year, prorated by month of service. */
export function proratedFirstYearEntitlement(monthsWorked: number): number {
  const capped = Math.max(0, Math.min(12, monthsWorked));
  return Math.round((BASE_ANNUAL_LEAVE_DAYS * capped) / 12);
}

export interface SickLeaveBand {
  fromDay: number;
  toDay: number;
  payRate: number;
  label: string;
}

/**
 * Sick pay taper, Art. 86: within any twelve months, the first month is on full
 * pay, the next two on half pay, and the following three unpaid — six months in
 * all, after which the contract may be terminated under Art. 30.
 */
export const SICK_LEAVE_BANDS: SickLeaveBand[] = [
  { fromDay: 1, toDay: 30, payRate: 1, label: 'First month — full pay' },
  { fromDay: 31, toDay: 90, payRate: 0.5, label: 'Months 2-3 — half pay' },
  { fromDay: 91, toDay: 180, payRate: 0, label: 'Months 4-6 — unpaid' },
];

export function sickPayRateForDay(dayOfSickLeaveInYear: number): number {
  const band = SICK_LEAVE_BANDS.find(
    (b) => dayOfSickLeaveInYear >= b.fromDay && dayOfSickLeaveInYear <= b.toDay,
  );
  if (!band) {
    throw new RangeError(
      `Day ${dayOfSickLeaveInYear} exceeds the six-month statutory sick leave period`,
    );
  }
  return band.payRate;
}

export interface LeaveBalance {
  entitledDays: number;
  carriedOverDays: number;
  takenDays: number;
  pendingDays: number;
}

export function availableDays(balance: LeaveBalance): number {
  return balance.entitledDays + balance.carriedOverDays - balance.takenDays - balance.pendingDays;
}

/**
 * Art. 79 allows leave to be postponed and carried forward, but not indefinitely:
 * accrued leave may not be deferred beyond two years.
 */
export const MAX_CARRY_OVER_YEARS = 2;

export function maxCarryOverDays(entitledDays: number): number {
  return entitledDays * MAX_CARRY_OVER_YEARS;
}
