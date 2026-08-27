import {
  ETHIOPIAN_MONTHS,
  ETHIOPIAN_WEEKDAYS,
  formatBirr,
  formatEthiopianTime,
  formatName,
  toEthiopian,
  type PersonName,
  type Santim,
} from './domain';

export type Locale = 'en-ET' | 'am-ET';
export type ClockMode = 'ethiopian' | 'international';

const script = (locale: Locale) => (locale === 'am-ET' ? 'ethiopic' : 'latin');

/**
 * By default the Ethiopian date leads and the Gregorian one sits beside it,
 * smaller — banks, suppliers and immigration all need the Gregorian date, so
 * it's never dropped. The Ethiopian/international clock toggle controls which
 * one leads: set to "international", the Gregorian date takes the primary
 * slot and switches to international weekday/month naming (e.g. "Thursday,
 * 27 August 2026" instead of the Ethiopian calendar's own names) — the
 * Ethiopian date drops to secondary rather than disappearing.
 */
export function formatWorkDate(
  isoDate: string,
  locale: Locale,
  clock: ClockMode,
): { primary: string; secondary: string } {
  const ethiopian = toEthiopian(isoDate);
  const month = ETHIOPIAN_MONTHS[ethiopian.month - 1];
  const ethWeekday = ETHIOPIAN_WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
  const isAmharic = script(locale) === 'ethiopic';

  const ethiopianLabel = isAmharic
    ? `${ethWeekday.ethiopic} · ${month.ethiopic} ${ethiopian.day} ቀን ${ethiopian.year}`
    : `${ethWeekday.latin} · ${month.latin} ${ethiopian.day}, ${ethiopian.year}`;

  const gregorianDate = new Date(`${isoDate}T00:00:00Z`);
  // Intl handles Amharic weekday/month names for the Gregorian calendar itself
  // (distinct from the Ethiopian calendar's own month names above).
  const gregorianLong = gregorianDate.toLocaleDateString(isAmharic ? 'am-ET' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const gregorianShort = gregorianDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return clock === 'international'
    ? { primary: gregorianLong, secondary: ethiopianLabel }
    : { primary: ethiopianLabel, secondary: gregorianShort };
}

export function formatTime(minutes: number, clock: ClockMode, locale: Locale): string {
  if (clock === 'international') {
    const m = ((minutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  return formatEthiopianTime(minutes, script(locale));
}

/** Always via `formatBirr` — never `toFixed`, which would imply float money. */
export const money = (santim: Santim): string => formatBirr(santim);

export const personName = (name: PersonName, form: 'short' | 'full' | 'legal' = 'short') =>
  formatName(name, form);

export const initials = (name: PersonName) =>
  `${name.givenName[0] ?? ''}${name.fathersName[0] ?? ''}`.toUpperCase();
