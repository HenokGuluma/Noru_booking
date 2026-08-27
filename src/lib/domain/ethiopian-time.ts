/**
 * Ethiopian clock time ("የሀበሻ ሰዓት").
 *
 * The day is counted from dawn, so 07:00 international is 1:00 ጠዋት and noon is
 * 6:00 ከሰዓት. Hotel staff — especially housekeeping and kitchen brigades — give
 * and hear shift times this way, while the roster printout and the biometric
 * terminal use the international clock. Storing one and rendering both is the
 * only arrangement that avoids a whole category of "I came at 2:00" disputes.
 *
 * Storage is always international time. This module is display-only.
 */

export type DayPeriod = 'dawn' | 'afternoon' | 'evening' | 'night';

export const DAY_PERIODS: Record<DayPeriod, { latin: string; ethiopic: string }> = {
  dawn: { latin: 'Tewat', ethiopic: 'ጠዋት' },
  afternoon: { latin: 'Keseat', ethiopic: 'ከሰዓት' },
  evening: { latin: 'Mata', ethiopic: 'ማታ' },
  night: { latin: 'Lelit', ethiopic: 'ለሊት' },
};

export interface EthiopianTime {
  hour: number; // 1-12
  minute: number;
  period: DayPeriod;
}

/** @param minutesFromMidnight international clock minutes, 0-1439 */
export function toEthiopianTime(minutesFromMidnight: number): EthiopianTime {
  const normalised = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalised / 60);
  const minute = normalised % 60;
  return {
    hour: ((hour24 + 6) % 12) || 12,
    minute,
    period: periodFor(hour24),
  };
}

export function formatEthiopianTime(
  minutesFromMidnight: number,
  script: 'latin' | 'ethiopic' = 'ethiopic',
): string {
  const { hour, minute, period } = toEthiopianTime(minutesFromMidnight);
  const label = script === 'ethiopic' ? DAY_PERIODS[period].ethiopic : DAY_PERIODS[period].latin;
  return `${hour}:${String(minute).padStart(2, '0')} ${label}`;
}

export function formatInternationalTime(minutesFromMidnight: number): string {
  const normalised = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const hour = Math.floor(normalised / 60);
  return `${String(hour).padStart(2, '0')}:${String(normalised % 60).padStart(2, '0')}`;
}

export function parseTimeOfDay(value: string): number {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) throw new RangeError(`Expected HH:MM, got "${value}"`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new RangeError(`"${value}" is not a valid time of day`);
  return hour * 60 + minute;
}

function periodFor(hour24: number): DayPeriod {
  if (hour24 >= 6 && hour24 < 12) return 'dawn';
  if (hour24 >= 12 && hour24 < 18) return 'afternoon';
  if (hour24 >= 18) return 'evening';
  return 'night';
}
