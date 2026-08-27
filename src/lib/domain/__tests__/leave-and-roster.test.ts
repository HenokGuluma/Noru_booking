import { describe, expect, it } from 'vitest';
import {
  annualLeaveEntitlement,
  availableDays,
  proratedFirstYearEntitlement,
  sickPayRateForDay,
} from '../leave/entitlement';
import { validateCoverage, validateEmployeeWeek, coverageKey } from '../scheduling/rules';
import { formatEthiopianTime, toEthiopianTime, parseTimeOfDay } from '../ethiopian-time';
import { formatName, initials, normalisePhone } from '../names';

describe('annual leave, Art. 77', () => {
  it.each([
    [0, 16],
    [1, 16],
    [2, 16],
    [3, 17],
    [4, 17],
    [5, 18],
    [11, 21],
  ])('gives %i years of service %i working days', (years, expected) => {
    expect(annualLeaveEntitlement(years)).toBe(expected);
  });

  it('prorates a first partial year', () => {
    expect(proratedFirstYearEntitlement(6)).toBe(8);
    expect(proratedFirstYearEntitlement(18)).toBe(16);
  });

  it('subtracts pending requests from what is bookable', () => {
    expect(
      availableDays({ entitledDays: 18, carriedOverDays: 4, takenDays: 10, pendingDays: 3 }),
    ).toBe(9);
  });
});

describe('sick pay taper, Art. 86', () => {
  it.each([
    [1, 1],
    [30, 1],
    [31, 0.5],
    [90, 0.5],
    [91, 0],
    [180, 0],
  ])('pays day %i at %f of salary', (day, rate) => {
    expect(sickPayRateForDay(day)).toBe(rate);
  });

  it('stops at six months', () => {
    expect(() => sickPayRateForDay(181)).toThrow(/six-month/);
  });
});

describe('roster validation', () => {
  const shift = (date: string, start: number, end: number) => ({
    employeeId: 'emp_1',
    date,
    startMinutes: start,
    endMinutes: end,
    departmentId: 'dept_fo',
    positionId: 'pos_agent',
  });

  it('blocks a night shift followed by a morning shift', () => {
    const violations = validateEmployeeWeek('emp_1', [
      shift('2026-08-24', 22 * 60, 30 * 60), // 22:00-06:00
      shift('2026-08-25', 6 * 60, 14 * 60), // straight back on at 06:00
    ]);
    expect(violations.map((v) => v.code)).toContain('insufficient_rest');
    expect(violations[0].severity).toBe('blocking');
  });

  it('accepts a legal week', () => {
    const violations = validateEmployeeWeek('emp_1', [
      shift('2026-08-24', 6 * 60, 14 * 60),
      shift('2026-08-25', 6 * 60, 14 * 60),
      shift('2026-08-26', 6 * 60, 14 * 60),
    ]);
    expect(violations).toEqual([]);
  });

  it('blocks a week over 48 hours', () => {
    const shifts = ['24', '25', '26', '27', '28', '29', '30'].map((d) =>
      shift(`2026-08-${d}`, 6 * 60, 14 * 60),
    );
    expect(validateEmployeeWeek('emp_1', shifts).map((v) => v.code)).toContain(
      'weekly_hours_exceeded',
    );
  });

  it('blocks rostering someone who is on approved leave', () => {
    const violations = validateEmployeeWeek('emp_1', [shift('2026-08-24', 6 * 60, 14 * 60)], {
      leaveDates: new Set(['2026-08-24']),
    });
    expect(violations[0].code).toBe('on_approved_leave');
  });

  it('reports understaffed shifts', () => {
    const requirement = {
      departmentId: 'dept_hk',
      date: '2026-08-24',
      shiftCode: 'AM',
      minimumStaff: 6,
      label: 'Housekeeping morning',
    };
    const counts = new Map([[coverageKey(requirement), 4]]);
    expect(validateCoverage([requirement], counts)[0].message).toMatch(/4 of 6 rostered/);
  });
});

describe('Ethiopian clock', () => {
  it.each([
    ['07:00', '1:00 ጠዋት'],
    ['12:00', '6:00 ከሰዓት'],
    ['14:30', '8:30 ከሰዓት'],
    ['22:00', '4:00 ማታ'],
    ['00:00', '6:00 ለሊት'],
  ])('renders %s as %s', (international, ethiopian) => {
    expect(formatEthiopianTime(parseTimeOfDay(international))).toBe(ethiopian);
  });

  it('never returns a zero hour', () => {
    for (let m = 0; m < 1440; m += 1) {
      expect(toEthiopianTime(m).hour).toBeGreaterThanOrEqual(1);
      expect(toEthiopianTime(m).hour).toBeLessThanOrEqual(12);
    }
  });
});

describe('names', () => {
  const name = {
    givenName: 'Selamawit',
    fathersName: 'Bekele',
    grandfathersName: 'Tadesse',
    givenNameAm: 'ሰላማዊት',
    fathersNameAm: 'በቀለ',
    grandfathersNameAm: 'ታደሰ',
  };

  it('uses given + father for everyday display', () => {
    expect(formatName(name)).toBe('Selamawit Bekele');
    expect(formatName(name, 'full')).toBe('Selamawit Bekele Tadesse');
    expect(formatName(name, 'full', 'ethiopic')).toBe('ሰላማዊት በቀለ ታደሰ');
    expect(initials(name)).toBe('SB');
  });

  it('refuses a legal name without the grandfather\u2019s name', () => {
    expect(() => formatName({ givenName: 'Abel', fathersName: 'Girma' }, 'legal')).toThrow(
      /statutory filings/,
    );
  });

  it('normalises phone numbers to E.164', () => {
    expect(normalisePhone('0911 22 33 44')).toBe('+251911223344');
    expect(normalisePhone('+251911223344')).toBe('+251911223344');
    expect(() => normalisePhone('12345')).toThrow();
  });
});
