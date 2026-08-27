/**
 * Rostering constraints for a 24-hour hotel operation.
 *
 * Working-time law (Proclamation 1156/2019, Arts. 61-69) caps the day at eight
 * hours and the week at forty-eight, guarantees twenty-four consecutive hours of
 * weekly rest, and requires twelve hours between shifts. In a hotel the binding
 * constraint is usually none of those — it is that a night auditor cannot also
 * open the breakfast shift, and the roster tool has to say so before the roster
 * is published rather than after.
 */

export const WORKING_TIME = {
  maxHoursPerDay: 8,
  maxHoursPerWeek: 48,
  minRestBetweenShiftsHours: 12,
  minWeeklyRestHours: 24,
  nightWindow: { startHour: 22, endHour: 6 },
  legalBasis: 'Labour Proclamation No. 1156/2019, Arts. 61-69',
} as const;

/** Maximum probation, Art. 11(3): sixty working days. */
export const MAX_PROBATION_WORKING_DAYS = 60;

export interface PlannedShift {
  employeeId: string;
  /** ISO date of the shift's *start*, in Ethiopian local time. */
  date: string;
  startMinutes: number;
  /** May exceed 1440 for shifts crossing midnight — a 22:00-06:00 night is 1320-1800. */
  endMinutes: number;
  departmentId: string;
  positionId: string;
}

export type ViolationSeverity = 'blocking' | 'warning';

export interface RosterViolation {
  code:
    | 'daily_hours_exceeded'
    | 'weekly_hours_exceeded'
    | 'insufficient_rest'
    | 'no_weekly_rest_day'
    | 'overlapping_shifts'
    | 'on_approved_leave'
    | 'certification_expired'
    | 'understaffed';
  severity: ViolationSeverity;
  employeeId?: string;
  date?: string;
  message: string;
  legalBasis?: string;
}

export function shiftHours(shift: PlannedShift): number {
  return (shift.endMinutes - shift.startMinutes) / 60;
}

export function isNightShift(shift: PlannedShift): boolean {
  const { startHour, endHour } = WORKING_TIME.nightWindow;
  const startsAtNight = Math.floor(shift.startMinutes / 60) >= startHour;
  const endsAtNight = Math.floor((shift.endMinutes % 1440) / 60) <= endHour;
  return startsAtNight || endsAtNight || shift.endMinutes > 1440;
}

/**
 * Validate one employee's week. Returns every violation rather than the first,
 * because a scheduler fixing a roster wants the whole list, not a treasure hunt.
 */
export function validateEmployeeWeek(
  employeeId: string,
  shifts: PlannedShift[],
  context: { leaveDates?: Set<string>; weeklyRestDate?: string } = {},
): RosterViolation[] {
  const violations: RosterViolation[] = [];
  const ordered = [...shifts].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes,
  );

  const hoursByDate = new Map<string, number>();
  for (const shift of ordered) {
    hoursByDate.set(shift.date, (hoursByDate.get(shift.date) ?? 0) + shiftHours(shift));
  }

  for (const [date, hours] of hoursByDate) {
    if (hours > WORKING_TIME.maxHoursPerDay) {
      violations.push({
        code: 'daily_hours_exceeded',
        severity: 'warning',
        employeeId,
        date,
        message: `${hours}h rostered on ${date}; anything past ${WORKING_TIME.maxHoursPerDay}h is overtime`,
        legalBasis: WORKING_TIME.legalBasis,
      });
    }
  }

  const weekHours = [...hoursByDate.values()].reduce((sum, h) => sum + h, 0);
  if (weekHours > WORKING_TIME.maxHoursPerWeek) {
    violations.push({
      code: 'weekly_hours_exceeded',
      severity: 'blocking',
      employeeId,
      message: `${weekHours}h rostered this week, over the ${WORKING_TIME.maxHoursPerWeek}h statutory ceiling`,
      legalBasis: WORKING_TIME.legalBasis,
    });
  }

  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    const gapMinutes = absoluteStartMinutes(current) - absoluteEndMinutes(previous);
    if (gapMinutes < 0) {
      violations.push({
        code: 'overlapping_shifts',
        severity: 'blocking',
        employeeId,
        date: current.date,
        message: `Shift on ${current.date} overlaps the previous one`,
      });
    } else if (gapMinutes / 60 < WORKING_TIME.minRestBetweenShiftsHours) {
      violations.push({
        code: 'insufficient_rest',
        severity: 'blocking',
        employeeId,
        date: current.date,
        message: `Only ${(gapMinutes / 60).toFixed(1)}h rest before the ${current.date} shift; ${WORKING_TIME.minRestBetweenShiftsHours}h required`,
        legalBasis: WORKING_TIME.legalBasis,
      });
    }
  }

  if (context.weeklyRestDate && hoursByDate.has(context.weeklyRestDate)) {
    violations.push({
      code: 'no_weekly_rest_day',
      severity: 'warning',
      employeeId,
      date: context.weeklyRestDate,
      message: `${context.weeklyRestDate} is this employee\u2019s weekly rest day; hours worked attract the rest-day overtime rate`,
      legalBasis: WORKING_TIME.legalBasis,
    });
  }

  for (const shift of ordered) {
    if (context.leaveDates?.has(shift.date)) {
      violations.push({
        code: 'on_approved_leave',
        severity: 'blocking',
        employeeId,
        date: shift.date,
        message: `Employee has approved leave on ${shift.date}`,
      });
    }
  }

  return violations;
}

export interface CoverageRequirement {
  departmentId: string;
  date: string;
  /** Shift template this requirement applies to, e.g. the 06:00 morning shift. */
  shiftCode: string;
  minimumStaff: number;
  label: string;
}

/** Check a published roster against each department's minimum cover. */
export function validateCoverage(
  requirements: CoverageRequirement[],
  assignedCounts: Map<string, number>,
): RosterViolation[] {
  return requirements
    .filter((req) => (assignedCounts.get(coverageKey(req)) ?? 0) < req.minimumStaff)
    .map((req) => ({
      code: 'understaffed' as const,
      severity: 'blocking' as const,
      date: req.date,
      message: `${req.label} on ${req.date}: ${assignedCounts.get(coverageKey(req)) ?? 0} of ${req.minimumStaff} rostered`,
    }));
}

export function coverageKey(req: Pick<CoverageRequirement, 'departmentId' | 'date' | 'shiftCode'>): string {
  return `${req.departmentId}|${req.date}|${req.shiftCode}`;
}

function absoluteStartMinutes(shift: PlannedShift): number {
  return dayIndex(shift.date) * 1440 + shift.startMinutes;
}

function absoluteEndMinutes(shift: PlannedShift): number {
  return dayIndex(shift.date) * 1440 + shift.endMinutes;
}

function dayIndex(isoDate: string): number {
  return Math.floor(Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  ) / 86_400_000);
}
