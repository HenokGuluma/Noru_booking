/**
 * Ethiopian public holidays.
 *
 * These cannot be a hard-coded list. Orthodox feasts move with the Ethiopian
 * calendar, Muslim feasts move with the lunar one and are gazetted only after
 * the moon is sighted, and the government occasionally adds a day. So holidays
 * are a **table** (`hr.public_holidays`), confirmed annually, and this module
 * only describes their shape and the fixed-in-Ethiopian-calendar subset that can
 * be generated in advance.
 *
 * Holidays matter to payroll here: hours worked on a gazetted holiday are paid
 * at 2.5x, and a hotel works every one of them.
 */

import { type EthiopianDate, toGregorian, formatISODate } from './ethiopian-calendar';

export type HolidayTradition = 'national' | 'orthodox' | 'muslim';

export interface PublicHoliday {
  code: string;
  name: string;
  nameAm: string;
  tradition: HolidayTradition;
  /** ISO Gregorian date for a specific year. */
  date: string;
  /** Lunar-calendar holidays are provisional until the government gazettes them. */
  confirmed: boolean;
}

interface FixedEthiopianHoliday {
  code: string;
  name: string;
  nameAm: string;
  tradition: HolidayTradition;
  month: number;
  day: number;
}

/** Holidays that sit on a fixed Ethiopian calendar date and can be generated. */
const FIXED_ETHIOPIAN: FixedEthiopianHoliday[] = [
  { code: 'ENKUTATASH', name: 'Ethiopian New Year', nameAm: 'እንቁጣጣሽ', tradition: 'national', month: 1, day: 1 },
  { code: 'MESKEL', name: 'Finding of the True Cross', nameAm: 'መስቀል', tradition: 'orthodox', month: 1, day: 17 },
  { code: 'GENNA', name: 'Ethiopian Christmas', nameAm: 'ገና', tradition: 'orthodox', month: 4, day: 29 },
  { code: 'TIMKAT', name: 'Epiphany', nameAm: 'ጥምቀት', tradition: 'orthodox', month: 5, day: 11 },
  { code: 'ADWA', name: 'Victory of Adwa', nameAm: 'የአድዋ ድል በዓል', tradition: 'national', month: 6, day: 23 },
  { code: 'LABOUR_DAY', name: 'International Labour Day', nameAm: 'የሠራተኞች ቀን', tradition: 'national', month: 8, day: 23 },
  { code: 'PATRIOTS_DAY', name: 'Patriots\u2019 Victory Day', nameAm: 'የአርበኞች ቀን', tradition: 'national', month: 8, day: 27 },
  { code: 'DERG_DOWNFALL', name: 'Downfall of the Derg', nameAm: 'ደርግ የወደቀበት ቀን', tradition: 'national', month: 9, day: 20 },
];

/**
 * Generate the fixed-date holidays for an Ethiopian year.
 *
 * Movable feasts — Fasika (Orthodox Easter) and Siklet (Good Friday), which
 * follow the Julian computus, and Eid al-Fitr, Eid al-Adha and Mawlid, which
 * follow the Hijri calendar — are **not** generated. They are entered into
 * `hr.public_holidays` once gazetted, and the roster refuses to publish a period
 * containing an unconfirmed holiday.
 */
export function fixedHolidaysForEthiopianYear(year: number): PublicHoliday[] {
  return FIXED_ETHIOPIAN.map((holiday) => ({
    code: holiday.code,
    name: holiday.name,
    nameAm: holiday.nameAm,
    tradition: holiday.tradition,
    date: formatISODate(toGregorian({ year, month: holiday.month, day: holiday.day } as EthiopianDate)),
    confirmed: true,
  }));
}

export const MOVABLE_HOLIDAY_CODES = [
  { code: 'SIKLET', name: 'Good Friday', nameAm: 'ስቅለት', tradition: 'orthodox' as const },
  { code: 'FASIKA', name: 'Ethiopian Easter', nameAm: 'ፋሲካ', tradition: 'orthodox' as const },
  { code: 'EID_AL_FITR', name: 'Eid al-Fitr', nameAm: 'ኢድ አል ፈጥር', tradition: 'muslim' as const },
  { code: 'EID_AL_ADHA', name: 'Eid al-Adha', nameAm: 'ኢድ አል አድሐ', tradition: 'muslim' as const },
  { code: 'MAWLID', name: 'Birth of the Prophet', nameAm: 'መውሊድ', tradition: 'muslim' as const },
];

export function isPublicHoliday(isoDate: string, holidays: PublicHoliday[]): boolean {
  return holidays.some((holiday) => holiday.date === isoDate);
}
