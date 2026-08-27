/**
 * Ethiopian (Ge'ez) calendar conversion.
 *
 * Thirteen months: twelve of 30 days plus Pagume, which has 5 days (6 in a leap
 * year, i.e. when `year % 4 === 3`). The year begins on Meskerem 1, which falls
 * on 11 September Gregorian, or 12 September in the year preceding a Gregorian
 * leap year. The Ethiopian year runs roughly 7–8 years behind the Gregorian one.
 *
 * Conversion goes through the Julian Day Number so both directions are exact
 * integer arithmetic with no date-library dependency and no timezone surface.
 *
 * IMPORTANT: this module deals in *calendar dates*, not instants. All storage is
 * UTC; Ethiopia is UTC+3 year-round with no daylight saving, so a "work date" is
 * derived by shifting the instant by +3h before taking the date part. Use
 * `toEthiopian(instantToWorkDate(t))`, never `toEthiopian(new Date(t))`.
 */

/** JDN of Meskerem 1 of year 0, Amete Mihret reckoning. */
const JDN_EPOCH_AMETE_MIHRET = 1_723_856;

export const ETHIOPIAN_UTC_OFFSET_MINUTES = 180; // EAT, fixed, no DST

export interface EthiopianDate {
  /** Amete Mihret year, e.g. 2018 */
  year: number;
  /** 1 = Meskerem … 13 = Pagume */
  month: number;
  /** 1-30, or 1-5/6 in Pagume */
  day: number;
}

export interface GregorianDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export const ETHIOPIAN_MONTHS = [
  { number: 1, latin: 'Meskerem', ethiopic: 'መስከረም' },
  { number: 2, latin: 'Tikimt', ethiopic: 'ጥቅምት' },
  { number: 3, latin: 'Hidar', ethiopic: 'ኅዳር' },
  { number: 4, latin: 'Tahsas', ethiopic: 'ታኅሣሥ' },
  { number: 5, latin: 'Tir', ethiopic: 'ጥር' },
  { number: 6, latin: 'Yekatit', ethiopic: 'የካቲት' },
  { number: 7, latin: 'Megabit', ethiopic: 'መጋቢት' },
  { number: 8, latin: 'Miyazia', ethiopic: 'ሚያዝያ' },
  { number: 9, latin: 'Ginbot', ethiopic: 'ግንቦት' },
  { number: 10, latin: 'Sene', ethiopic: 'ሰኔ' },
  { number: 11, latin: 'Hamle', ethiopic: 'ሐምሌ' },
  { number: 12, latin: 'Nehase', ethiopic: 'ነሐሴ' },
  { number: 13, latin: 'Pagume', ethiopic: 'ጳጉሜን' },
] as const;

export const ETHIOPIAN_WEEKDAYS = [
  { latin: 'Ehud', ethiopic: 'እሑድ' }, // Sunday
  { latin: 'Segno', ethiopic: 'ሰኞ' },
  { latin: 'Maksegno', ethiopic: 'ማክሰኞ' },
  { latin: 'Erob', ethiopic: 'ረቡዕ' },
  { latin: 'Hamus', ethiopic: 'ሐሙስ' },
  { latin: 'Arb', ethiopic: 'ዓርብ' },
  { latin: 'Kidame', ethiopic: 'ቅዳሜ' },
] as const;

export function isEthiopianLeapYear(year: number): boolean {
  return ((year % 4) + 4) % 4 === 3;
}

export function ethiopianMonthLength(year: number, month: number): number {
  if (month < 1 || month > 13) throw new RangeError(`Ethiopian month must be 1-13, got ${month}`);
  if (month < 13) return 30;
  return isEthiopianLeapYear(year) ? 6 : 5;
}

export function ethiopianYearLength(year: number): number {
  return isEthiopianLeapYear(year) ? 366 : 365;
}

export function ethiopianToJDN({ year, month, day }: EthiopianDate): number {
  assertValidEthiopian({ year, month, day });
  return JDN_EPOCH_AMETE_MIHRET + 365 + 365 * (year - 1) + Math.floor(year / 4) + 30 * month + day - 31;
}

export function jdnToEthiopian(jdn: number): EthiopianDate {
  const r = ((jdn - JDN_EPOCH_AMETE_MIHRET) % 1461 + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year =
    4 * Math.floor((jdn - JDN_EPOCH_AMETE_MIHRET) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day };
}

export function gregorianToJDN({ year, month, day }: GregorianDate): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

export function jdnToGregorian(jdn: number): GregorianDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

export function toEthiopian(date: GregorianDate | string): EthiopianDate {
  return jdnToEthiopian(gregorianToJDN(typeof date === 'string' ? parseISODate(date) : date));
}

export function toGregorian(date: EthiopianDate): GregorianDate {
  return jdnToGregorian(ethiopianToJDN(date));
}

/** ISO `YYYY-MM-DD` — the only string form of a date this system accepts. */
export function parseISODate(iso: string): GregorianDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new RangeError(`Expected an ISO date (YYYY-MM-DD), got "${iso}"`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function formatISODate({ year, month, day }: GregorianDate): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The local Ethiopian work date for a UTC instant. A night-shift clock-out at
 * 23:30 UTC is 02:30 the next day in Addis, so this shift is not cosmetic.
 */
export function instantToWorkDate(instant: Date): GregorianDate {
  const shifted = new Date(instant.getTime() + ETHIOPIAN_UTC_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function formatEthiopian(
  date: EthiopianDate,
  script: 'latin' | 'ethiopic' = 'latin',
): string {
  const month = ETHIOPIAN_MONTHS[date.month - 1];
  return script === 'ethiopic'
    ? `${month.ethiopic} ${date.day} ቀን ${date.year}`
    : `${month.latin} ${date.day}, ${date.year}`;
}

export function ethiopianWeekday(date: EthiopianDate): (typeof ETHIOPIAN_WEEKDAYS)[number] {
  // JDN 0 was a Monday; (jdn + 1) % 7 gives 0 = Sunday.
  return ETHIOPIAN_WEEKDAYS[(ethiopianToJDN(date) + 1) % 7];
}

export function addEthiopianDays(date: EthiopianDate, days: number): EthiopianDate {
  return jdnToEthiopian(ethiopianToJDN(date) + days);
}

export function differenceInDays(a: GregorianDate | string, b: GregorianDate | string): number {
  const toJdn = (d: GregorianDate | string) =>
    gregorianToJDN(typeof d === 'string' ? parseISODate(d) : d);
  return toJdn(a) - toJdn(b);
}

/**
 * The Ethiopian fiscal year (Hamle 1 – Sene 30, roughly 8 July – 7 July) that a
 * given date falls in. Payroll declarations and annual leave accrual both run on
 * this year, not the Gregorian one.
 */
export function fiscalYearOf(date: EthiopianDate): number {
  return date.month >= 11 ? date.year : date.year - 1;
}

function assertValidEthiopian({ year, month, day }: EthiopianDate): void {
  if (!Number.isInteger(year)) throw new RangeError(`Ethiopian year must be an integer, got ${year}`);
  if (month < 1 || month > 13) throw new RangeError(`Ethiopian month must be 1-13, got ${month}`);
  const length = ethiopianMonthLength(year, month);
  if (day < 1 || day > length) {
    throw new RangeError(
      `${ETHIOPIAN_MONTHS[month - 1].latin} ${year} has ${length} days, got day ${day}`,
    );
  }
}
