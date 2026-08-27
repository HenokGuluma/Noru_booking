import { describe, expect, it } from 'vitest';
import {
  addEthiopianDays,
  ethiopianMonthLength,
  ethiopianToJDN,
  ethiopianWeekday,
  fiscalYearOf,
  formatEthiopian,
  gregorianToJDN,
  isEthiopianLeapYear,
  instantToWorkDate,
  jdnToEthiopian,
  toEthiopian,
  toGregorian,
} from '../ethiopian-calendar';

describe('Ethiopian calendar', () => {
  it('maps Ethiopian New Year to 11 September', () => {
    expect(toEthiopian('2026-09-11')).toEqual({ year: 2019, month: 1, day: 1 });
    expect(toEthiopian('2025-09-11')).toEqual({ year: 2018, month: 1, day: 1 });
  });

  it('maps Genna (Ethiopian Christmas) to Tahsas 29', () => {
    expect(toEthiopian('2026-01-07')).toEqual({ year: 2018, month: 4, day: 29 });
  });

  it('places the last day of Pagume immediately before New Year', () => {
    expect(toEthiopian('2026-09-10')).toEqual({ year: 2018, month: 13, day: 5 });
  });

  it('round-trips every day between 1900 and 2100', () => {
    const start = gregorianToJDN({ year: 1900, month: 1, day: 1 });
    const end = gregorianToJDN({ year: 2100, month: 1, day: 1 });
    for (let jdn = start; jdn <= end; jdn += 1) {
      expect(ethiopianToJDN(jdnToEthiopian(jdn))).toBe(jdn);
    }
  });

  it('gives Pagume six days only in a leap year', () => {
    expect(isEthiopianLeapYear(2019)).toBe(true); // 2019 % 4 === 3
    expect(ethiopianMonthLength(2019, 13)).toBe(6);
    expect(ethiopianMonthLength(2018, 13)).toBe(5);
  });

  it('rolls Pagume into Meskerem when adding days', () => {
    expect(addEthiopianDays({ year: 2018, month: 13, day: 5 }, 1)).toEqual({
      year: 2019,
      month: 1,
      day: 1,
    });
  });

  it('rejects impossible dates instead of silently normalising them', () => {
    expect(() => ethiopianToJDN({ year: 2018, month: 13, day: 6 })).toThrow(/has 5 days/);
    expect(() => ethiopianToJDN({ year: 2018, month: 14, day: 1 })).toThrow(/1-13/);
  });

  it('names months and weekdays in both scripts', () => {
    expect(formatEthiopian({ year: 2018, month: 12, day: 21 })).toBe('Nehase 21, 2018');
    expect(formatEthiopian({ year: 2018, month: 12, day: 21 }, 'ethiopic')).toBe('ነሐሴ 21 ቀን 2018');
    // 27 August 2026 was a Thursday.
    expect(ethiopianWeekday({ year: 2018, month: 12, day: 21 }).latin).toBe('Hamus');
  });

  it('shifts a UTC instant into the Addis work date', () => {
    // 23:30 UTC is 02:30 the next day in Addis: a night auditor's clock-out.
    expect(instantToWorkDate(new Date('2026-03-04T23:30:00Z'))).toEqual({
      year: 2026,
      month: 3,
      day: 5,
    });
  });

  it('runs the fiscal year from Hamle', () => {
    expect(fiscalYearOf({ year: 2018, month: 10, day: 30 })).toBe(2017); // Sene — end of FY2017
    expect(fiscalYearOf({ year: 2018, month: 11, day: 1 })).toBe(2018); // Hamle 1 — FY2018 opens
  });

  it('inverts cleanly', () => {
    expect(toGregorian({ year: 2018, month: 12, day: 21 })).toEqual({
      year: 2026,
      month: 8,
      day: 27,
    });
  });
});
