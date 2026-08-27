#!/usr/bin/env tsx
/**
 * Demo seed: one Addis Ababa property, 8 departments, ~40 staff with bilingual
 * Ethiopian names, a published roster for the current week, a full prior
 * calendar month of attendance (locked, so payroll can read it), a handful of
 * employees clocked in "now" for the tag board, and a calculated payroll run
 * built with the ported `buildPayslip` engine from `src/lib/domain`.
 *
 * Salaries and coverage numbers below are illustrative for a demo, not sourced
 * from a real Noru Booking property — unlike the tax bands in 0006, which are
 * cited. Idempotent: exits early if the demo property already exists.
 */
import postgres from 'postgres';
import { uuidv7 } from 'uuidv7';
import * as argon2 from 'argon2';
import { birrToSantim, normalisePhone, ruleSetFor, buildPayslip, annualLeaveEntitlement, type Santim } from '../domain';
import { DEMO_PROPERTY_ID, DEMO_ADMIN_USER_ID } from '../demo';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local.');
const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

// Fixed IDs so re-running against a fresh database is reproducible.
const PROPERTY_ID = DEMO_PROPERTY_ID;
const ADMIN_USER_ID = DEMO_ADMIN_USER_ID;
const GROUP_ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000001'; // seeded in 0006

const DEPARTMENTS = [
  { code: 'FO', name: 'Front Office', nameAm: 'የፊት ጽ/ቤት', minSantim: 8000, maxSantim: 14000, ops: true },
  { code: 'HK', name: 'Housekeeping', nameAm: 'ቤት ጽዳት', minSantim: 6000, maxSantim: 10000, ops: true },
  { code: 'FB', name: 'Food & Beverage', nameAm: 'ምግብና መጠጥ', minSantim: 6500, maxSantim: 11000, ops: true },
  { code: 'KIT', name: 'Kitchen', nameAm: 'ማብሰያ ቤት', minSantim: 7000, maxSantim: 12000, ops: true },
  { code: 'ENG', name: 'Engineering', nameAm: 'ኢንጂነሪንግ', minSantim: 9000, maxSantim: 15000, ops: true },
  { code: 'SEC', name: 'Security', nameAm: 'ደህንነት', minSantim: 6000, maxSantim: 9000, ops: true },
  { code: 'HR', name: 'Human Resources', nameAm: 'የሰው ኃይል', minSantim: 10000, maxSantim: 16000, ops: false },
  { code: 'FIN', name: 'Finance', nameAm: 'ፋይናንስ', minSantim: 11000, maxSantim: 17000, ops: false },
] as const;

// given/father's name pairs, Latin + Ge'ez. Illustrative demo people, not real staff.
const NAME_POOL: Array<{ g: string; f: string; gAm: string; fAm: string; sex: 'male' | 'female' }> = [
  { g: 'Abebe', f: 'Kebede', gAm: 'አበበ', fAm: 'ከበደ', sex: 'male' },
  { g: 'Tesfaye', f: 'Girma', gAm: 'ተስፋዬ', fAm: 'ግርማ', sex: 'male' },
  { g: 'Almaz', f: 'Tadesse', gAm: 'አልማዝ', fAm: 'ታደሠ', sex: 'female' },
  { g: 'Selamawit', f: 'Haile', gAm: 'ሰላማዊት', fAm: 'ኃይለ', sex: 'female' },
  { g: 'Mulugeta', f: 'Getachew', gAm: 'ሙሉጌታ', fAm: 'ገታቸው', sex: 'male' },
  { g: 'Solomon', f: 'Yohannes', gAm: 'ሰለሞን', fAm: 'ዮሐንስ', sex: 'male' },
  { g: 'Hirut', f: 'Dawit', gAm: 'ኂሩት', fAm: 'ዳዊት', sex: 'female' },
  { g: 'Meseret', f: 'Samuel', gAm: 'መሠረት', fAm: 'ሳሙኤል', sex: 'female' },
  { g: 'Daniel', f: 'Mesfin', gAm: 'ዳንኤል', fAm: 'መስፍን', sex: 'male' },
  { g: 'Tigist', f: 'Berhanu', gAm: 'ትዕግስት', fAm: 'በርሀኑ', sex: 'female' },
  { g: 'Fikru', f: 'Assefa', gAm: 'ፍቅሩ', fAm: 'አሰፋ', sex: 'male' },
  { g: 'Genet', f: 'Alemu', gAm: 'ገነት', fAm: 'አለሙ', sex: 'female' },
  { g: 'Aster', f: 'Bekele', gAm: 'አስቴር', fAm: 'በቀለ', sex: 'female' },
  { g: 'Yohannes', f: 'Tesfaye', gAm: 'ዮሐንስ', fAm: 'ተስፋዬ', sex: 'male' },
  { g: 'Hana', f: 'Girma', gAm: 'ሃና', fAm: 'ግርማ', sex: 'female' },
  { g: 'Rahel', f: 'Abebe', gAm: 'ራሔል', fAm: 'አበበ', sex: 'female' },
  { g: 'Samuel', f: 'Haile', gAm: 'ሳሙኤል', fAm: 'ኃይለ', sex: 'male' },
  { g: 'Sara', f: 'Mulugeta', gAm: 'ሳራ', fAm: 'ሙሉጌታ', sex: 'female' },
  { g: 'Bethlehem', f: 'Solomon', gAm: 'ቤተልሔም', fAm: 'ሰለሞን', sex: 'female' },
  { g: 'Eden', f: 'Fikru', gAm: 'ኤድን', fAm: 'ፍቅሩ', sex: 'female' },
  { g: 'Mihret', f: 'Daniel', gAm: 'ምሕረት', fAm: 'ዳንኤል', sex: 'female' },
  { g: 'Getachew', f: 'Assefa', gAm: 'ገታቸው', fAm: 'አሰፋ', sex: 'male' },
  { g: 'Fantu', f: 'Berhanu', gAm: 'ፋንቱ', fAm: 'በርሀኑ', sex: 'female' },
  { g: 'Zewditu', f: 'Kebede', gAm: 'ዘውዲቱ', fAm: 'ከበደ', sex: 'female' },
  { g: 'Yeshi', f: 'Tadesse', gAm: 'የሺ', fAm: 'ታደሠ', sex: 'female' },
  { g: 'Wubit', f: 'Mesfin', gAm: 'ውቢት', fAm: 'መስፍን', sex: 'female' },
  { g: 'Alemitu', f: 'Yohannes', gAm: 'አለሚቱ', fAm: 'ዮሐንስ', sex: 'female' },
  { g: 'Girma', f: 'Alemu', gAm: 'ግርማ', fAm: 'አለሙ', sex: 'male' },
  { g: 'Dawit', f: 'Samuel', gAm: 'ዳዊት', fAm: 'ሳሙኤል', sex: 'male' },
  { g: 'Bekele', f: 'Haile', gAm: 'በቀለ', fAm: 'ኃይለ', sex: 'male' },
  { g: 'Tadesse', f: 'Girma', gAm: 'ታደሠ', fAm: 'ግርማ', sex: 'male' },
  { g: 'Haile', f: 'Bekele', gAm: 'ኃይለ', fAm: 'በቀለ', sex: 'male' },
  { g: 'Berhanu', f: 'Tesfaye', gAm: 'በርሀኑ', fAm: 'ተስፋዬ', sex: 'male' },
  { g: 'Assefa', f: 'Kebede', gAm: 'አሰፋ', fAm: 'ከበደ', sex: 'male' },
  { g: 'Mesfin', f: 'Girma', gAm: 'መስፍን', fAm: 'ግርማ', sex: 'male' },
  { g: 'Alemu', f: 'Tadesse', gAm: 'አለሙ', fAm: 'ታደሠ', sex: 'male' },
  { g: 'Kebede', f: 'Haile', gAm: 'ከበደ', fAm: 'ኃይለ', sex: 'male' },
  { g: 'Tsehay', f: 'Girma', gAm: 'ፀሐይ', fAm: 'ግርማ', sex: 'female' },
  { g: 'Tigist', f: 'Dawit', gAm: 'ትዕግስት', fAm: 'ዳዊት', sex: 'female' },
  { g: 'Selamawit', f: 'Assefa', gAm: 'ሰላማዊት', fAm: 'አሰፋ', sex: 'female' },
  { g: 'Hirut', f: 'Berhanu', gAm: 'ኂሩት', fAm: 'በርሀኑ', sex: 'female' },
  { g: 'Genet', f: 'Mesfin', gAm: 'ገነት', fAm: 'መስፍን', sex: 'female' },
  { g: 'Meseret', f: 'Kebede', gAm: 'መሠረት', fAm: 'ከበደ', sex: 'female' },
];

const SHIFTS = [
  { code: 'AM', name: 'Morning', nameAm: 'ጠዋት', start: 480, end: 960, colour: '#0E6A5A', night: false },
  { code: 'PM', name: 'Afternoon', nameAm: 'ከሰዓት', start: 960, end: 1440, colour: '#D9932B', night: false },
  { code: 'NIGHT', name: 'Night', nameAm: 'ሌሊት', start: 1320, end: 1800, colour: '#2F3E57', night: true },
] as const;

function pad4(n: number) {
  return String(n).padStart(4, '0');
}

/** Ethiopia is UTC+3 with no DST, so local-minutes -> UTC instant is exact arithmetic (CLAUDE.md). */
function localMinutesOnDateToUtc(date: Date, minutesFromLocalMidnight: number): Date {
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(utcMidnight - 3 * 60 * 60 * 1000 + minutesFromLocalMidnight * 60 * 1000);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const existing = await sql`SELECT id FROM org.properties WHERE code = 'NB-ADD-01'`;
  if (existing.length > 0) {
    console.log('Demo data already present (org.properties NB-ADD-01 exists). Nothing to do.');
    return;
  }

  console.log('Seeding demo data…');

  // --- property, admin user, role grant ---------------------------------
  const passwordHash = await argon2.hash('noru-demo-2026');
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO org.properties (id, code, name, name_am, city, region, sub_city, tin, room_count, star_rating, opened_on)
      VALUES (${PROPERTY_ID}, 'NB-ADD-01', 'Noru Bole', 'ኑሩ ቦሌ', 'Addis Ababa', 'Addis Ababa', 'Bole',
              '0123456789', 84, 4, '2019-03-01')`;

    await tx`
      INSERT INTO iam.users (id, email, password_hash, display_name, preferred_locale, preferred_calendar)
      VALUES (${ADMIN_USER_ID}, 'admin@noru.local', ${passwordHash}, 'Selamawit Bekele', 'en-ET', 'ethiopian')`;

    await tx`
      INSERT INTO iam.user_roles (id, user_id, role_id, property_id, granted_by)
      VALUES (${uuidv7()}, ${ADMIN_USER_ID}, ${GROUP_ADMIN_ROLE_ID}, NULL, ${ADMIN_USER_ID})`;
  });

  // --- departments + one position each -----------------------------------
  const departmentIds: Record<string, string> = {};
  const positionIds: Record<string, string> = {};
  for (const dept of DEPARTMENTS) {
    const deptId = uuidv7();
    departmentIds[dept.code] = deptId;
    await sql`
      INSERT INTO org.departments (id, property_id, code, name, name_am, is_operational)
      VALUES (${deptId}, ${PROPERTY_ID}, ${dept.code}, ${dept.name}, ${dept.nameAm}, ${dept.ops})`;

    const posId = uuidv7();
    positionIds[dept.code] = posId;
    await sql`
      INSERT INTO org.positions
        (id, property_id, department_id, code, title, title_am, grade, salary_band_min_santim, salary_band_max_santim)
      VALUES (${posId}, ${PROPERTY_ID}, ${deptId}, ${dept.code + '-STF'}, ${dept.name + ' Associate'},
              ${dept.nameAm + ' ሠራተኛ'}, 3, ${birrToSantim(dept.minSantim)}, ${birrToSantim(dept.maxSantim)})`;
  }

  // --- shift templates -----------------------------------------------------
  const shiftTemplateIds: Record<string, string> = {};
  for (const shift of SHIFTS) {
    const id = uuidv7();
    shiftTemplateIds[shift.code] = id;
    await sql`
      INSERT INTO ops.shift_templates
        (id, property_id, code, name, name_am, start_minutes, end_minutes, unpaid_break_minutes, colour, is_night)
      VALUES (${id}, ${PROPERTY_ID}, ${shift.code}, ${shift.name}, ${shift.nameAm},
              ${shift.start}, ${shift.end}, 60, ${shift.colour}, ${shift.night})`;
  }

  // --- coverage requirements (AM + PM, every department, every weekday) ----
  for (const dept of DEPARTMENTS) {
    for (const shiftCode of ['AM', 'PM'] as const) {
      for (let weekday = 0; weekday <= 6; weekday++) {
        const isWeekend = weekday === 5 || weekday === 6;
        await sql`
          INSERT INTO ops.coverage_requirements
            (id, property_id, department_id, shift_template_id, weekday, minimum_staff)
          VALUES (${uuidv7()}, ${PROPERTY_ID}, ${departmentIds[dept.code]}, ${shiftTemplateIds[shiftCode]},
                  ${weekday}, ${isWeekend ? 3 : 2})`;
      }
    }
  }

  // --- employees + contracts -------------------------------------------
  interface SeededEmployee {
    id: string;
    name: string;
    deptCode: string;
    weeklyRestWeekday: number;
    basicSalarySantim: Santim;
    contractId: string;
    positionTitle: string;
    hiredOn: string;
  }
  const employees: SeededEmployee[] = [];
  const today = new Date();
  const perDept = Math.floor(NAME_POOL.length / DEPARTMENTS.length);

  let seq = 1;
  for (let d = 0; d < DEPARTMENTS.length; d++) {
    const dept = DEPARTMENTS[d];
    for (let i = 0; i < perDept; i++) {
      const person = NAME_POOL[d * perDept + i];
      const employeeId = uuidv7();
      const employeeNo = `NB-ADD-${pad4(seq)}`;
      const hiredOn = new Date(today.getTime() - (200 + seq * 17) * 24 * 60 * 60 * 1000);
      const dob = new Date(hiredOn.getTime() - (24 + (seq % 20)) * 365.25 * 24 * 60 * 60 * 1000);
      const phone = normalisePhone(`09${String(10000000 + seq).slice(0, 8)}`);
      const weeklyRestWeekday = seq % 7;
      const basicSalary = birrToSantim(dept.minSantim + ((seq * 137) % (dept.maxSantim - dept.minSantim)));

      await sql`
        INSERT INTO hr.employees
          (id, property_id, employee_no, given_name, fathers_name, given_name_am, fathers_name_am,
           sex, date_of_birth, nationality, phone, department_id, position_id, status, hired_on)
        VALUES (${employeeId}, ${PROPERTY_ID}, ${employeeNo}, ${person.g}, ${person.f}, ${person.gAm}, ${person.fAm},
                ${person.sex}, ${isoDate(dob)}, 'ET', ${phone}, ${departmentIds[dept.code]}, ${positionIds[dept.code]},
                'active', ${isoDate(hiredOn)})`;

      const contractId = uuidv7();
      await sql`
        INSERT INTO hr.employment_contracts
          (id, employee_id, property_id, position_id, department_id, employment_type, basic_salary_santim,
           weekly_rest_weekday, weekly_hours, effective_from, change_reason)
        VALUES (${contractId}, ${employeeId}, ${PROPERTY_ID}, ${positionIds[dept.code]}, ${departmentIds[dept.code]},
                'permanent', ${basicSalary}, ${weeklyRestWeekday}, 48, ${isoDate(hiredOn)}, 'hired')`;

      await sql`UPDATE hr.employees SET current_contract_id = ${contractId} WHERE id = ${employeeId}`;

      employees.push({
        id: employeeId,
        name: `${person.g} ${person.f}`,
        deptCode: dept.code,
        weeklyRestWeekday,
        basicSalarySantim: basicSalary,
        contractId,
        positionTitle: `${dept.name} Associate`,
        hiredOn: isoDate(hiredOn),
      });
      seq++;
    }
  }
  console.log(`  ${employees.length} employees across ${DEPARTMENTS.length} departments`);

  // --- this week's roster + shift assignments -----------------------------
  const monday = new Date(today);
  const jsDay = monday.getUTCDay(); // 0 = Sunday
  const diffToMonday = (jsDay + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const rosterIdByDept: Record<string, string> = {};
  for (const dept of DEPARTMENTS) {
    const rosterId = uuidv7();
    rosterIdByDept[dept.code] = rosterId;
    await sql`
      INSERT INTO ops.rosters (id, property_id, department_id, week_start, status, published_at, published_by, created_by)
      VALUES (${rosterId}, ${PROPERTY_ID}, ${departmentIds[dept.code]}, ${isoDate(monday)}, 'published', now(), ${ADMIN_USER_ID}, ${ADMIN_USER_ID})`;
  }

  // employeeId|isoDate -> shift_assignment id, so today's punches can reference a real assignment
  const assignmentByEmployeeDate = new Map<string, string>();
  for (const employee of employees) {
    const shiftCode = employee.deptCode === 'SEC' || employee.deptCode === 'FO' ? 'NIGHT' : (employees.indexOf(employee) % 2 === 0 ? 'AM' : 'PM');
    const shift = SHIFTS.find((s) => s.code === shiftCode)!;
    for (let day = 0; day < 7; day++) {
      const workDate = new Date(monday);
      workDate.setUTCDate(monday.getUTCDate() + day);
      const weekday = workDate.getUTCDay();
      if (weekday === employee.weeklyRestWeekday) continue;

      const assignmentId = uuidv7();
      await sql`
        INSERT INTO ops.shift_assignments
          (id, roster_id, employee_id, shift_template_id, work_date, start_minutes, end_minutes, unpaid_break_minutes)
        VALUES (${assignmentId}, ${rosterIdByDept[employee.deptCode]}, ${employee.id}, ${shiftTemplateIds[shift.code]},
                ${isoDate(workDate)}, ${shift.start}, ${shift.end}, 60)`;
      assignmentByEmployeeDate.set(`${employee.id}|${isoDate(workDate)}`, assignmentId);
    }
  }
  console.log('  current week roster published for all 8 departments');

  // --- a full prior calendar month of attendance, locked ------------------
  const prevMonthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  const prevMonthStart = new Date(Date.UTC(prevMonthEnd.getUTCFullYear(), prevMonthEnd.getUTCMonth(), 1));
  const workingDaysInPrevMonth = daysBetweenExcludingWeekday(prevMonthStart, prevMonthEnd);

  let attendanceRows = 0;
  for (const employee of employees) {
    const shiftCode = employee.deptCode === 'SEC' || employee.deptCode === 'FO' ? 'NIGHT' : (employees.indexOf(employee) % 2 === 0 ? 'AM' : 'PM');
    const shift = SHIFTS.find((s) => s.code === shiftCode)!;
    for (let d = new Date(prevMonthStart); d <= prevMonthEnd; d.setUTCDate(d.getUTCDate() + 1)) {
      const workDate = new Date(d);
      const weekday = workDate.getUTCDay();
      const attendanceId = uuidv7();

      if (weekday === employee.weeklyRestWeekday) {
        await sql`
          INSERT INTO ops.attendance_days (id, property_id, employee_id, work_date, state, locked_at)
          VALUES (${attendanceId}, ${PROPERTY_ID}, ${employee.id}, ${isoDate(workDate)}, 'rest_day', now())`;
        attendanceRows++;
        continue;
      }

      const isLate = (parseInt(employee.id.slice(-2), 16) + workDate.getUTCDate()) % 11 === 0;
      const lateMinutes = isLate ? 8 + (workDate.getUTCDate() % 15) : 0;
      const firstIn = localMinutesOnDateToUtc(workDate, shift.start + lateMinutes);
      const lastOut = localMinutesOnDateToUtc(workDate, shift.end);
      const workedMinutes = shift.end - shift.start - 60 - lateMinutes;

      await sql`
        INSERT INTO ops.attendance_days
          (id, property_id, employee_id, work_date, state, first_in_at, last_out_at,
           break_minutes, worked_minutes, late_minutes, locked_at)
        VALUES (${attendanceId}, ${PROPERTY_ID}, ${employee.id}, ${isoDate(workDate)}, ${isLate ? 'late' : 'present'},
                ${firstIn.toISOString()}, ${lastOut.toISOString()}, 60, ${workedMinutes}, ${lateMinutes}, now())`;
      attendanceRows++;
    }
  }
  console.log(`  ${attendanceRows} attendance days locked for ${isoDate(prevMonthStart)} – ${isoDate(prevMonthEnd)}`);

  // --- a handful of employees clocked in "now", for the tag board ---------
  const onDutyCount = Math.min(9, employees.length);
  for (let i = 0; i < onDutyCount; i++) {
    const employee = employees[i * 4];
    if (!employee) continue;
    const isLate = i % 4 === 0;
    const lateMinutes = isLate ? 12 : 0;
    const clockedInAgo = 40 + i * 11; // minutes ago
    const firstIn = new Date(today.getTime() - clockedInAgo * 60 * 1000);
    const assignmentId = assignmentByEmployeeDate.get(`${employee.id}|${isoDate(today)}`) ?? null;

    await sql`
      INSERT INTO ops.attendance_days
        (id, property_id, employee_id, work_date, assignment_id, state, first_in_at, late_minutes)
      VALUES (${uuidv7()}, ${PROPERTY_ID}, ${employee.id}, ${isoDate(today)}, ${assignmentId},
              ${isLate ? 'late' : 'present'}, ${firstIn.toISOString()}, ${lateMinutes})
      ON CONFLICT (employee_id, work_date) DO UPDATE SET
        assignment_id = EXCLUDED.assignment_id, state = EXCLUDED.state,
        first_in_at = EXCLUDED.first_in_at, late_minutes = EXCLUDED.late_minutes, last_out_at = NULL`;
  }
  console.log(`  ${onDutyCount} employees clocked in for the tag board`);

  // --- a calculated payroll run, built with the ported domain engine ------
  const periodEndIso = isoDate(prevMonthEnd);
  const rules = ruleSetFor(periodEndIso);
  const [ethYear, ethMonth] = approximateEthiopianYearMonth(prevMonthEnd);

  const runId = uuidv7();
  // Plain numbers, not bigint: a single property's monthly payroll totals sit
  // far below Number.MAX_SAFE_INTEGER, and postgres.js's typed template tags
  // don't accept raw `bigint` parameters.
  let totalGross = 0, totalPaye = 0, totalEmpPension = 0, totalErPension = 0, totalNet = 0, totalEmployerCost = 0;

  interface PayslipRow {
    id: string;
    run_id: string;
    employee_id: string;
    contract_id: string;
    position_title: string;
    department_name: string;
    basic_salary_santim: Santim;
    prorated_basic_santim: Santim;
    gross_santim: Santim;
    taxable_gross_santim: Santim;
    paye_santim: Santim;
    employee_pension_santim: Santim;
    employer_pension_santim: Santim;
    total_deductions_santim: Santim;
    net_pay_santim: Santim;
    employer_cost_santim: Santim;
    earning_lines: string;
    deduction_lines: string;
    warnings: string[];
  }
  const payslipRows: PayslipRow[] = [];
  for (const employee of employees) {
    const slip = buildPayslip({
      employeeId: employee.id,
      periodEnd: periodEndIso,
      basicSalarySantim: employee.basicSalarySantim,
      workingDaysInPeriod: workingDaysInPrevMonth,
      rules,
    });

    totalGross += slip.grossSantim;
    totalPaye += slip.paye.taxSantim;
    totalEmpPension += slip.pension.employeeSantim;
    totalErPension += slip.pension.employerSantim;
    totalNet += slip.netPaySantim;
    totalEmployerCost += slip.employerCostSantim;

    const dept = DEPARTMENTS.find((d) => d.code === employee.deptCode)!;
    payslipRows.push({
      id: uuidv7(),
      run_id: runId,
      employee_id: employee.id,
      contract_id: employee.contractId,
      position_title: employee.positionTitle,
      department_name: dept.name,
      basic_salary_santim: employee.basicSalarySantim,
      prorated_basic_santim: employee.basicSalarySantim,
      gross_santim: slip.grossSantim,
      taxable_gross_santim: slip.taxableGrossSantim,
      paye_santim: slip.paye.taxSantim,
      employee_pension_santim: slip.pension.employeeSantim,
      employer_pension_santim: slip.pension.employerSantim,
      total_deductions_santim: slip.totalDeductionsSantim,
      net_pay_santim: slip.netPaySantim,
      employer_cost_santim: slip.employerCostSantim,
      earning_lines: JSON.stringify(slip.earnings),
      deduction_lines: JSON.stringify(slip.deductions),
      warnings: slip.warnings,
    });
  }

  await sql`
    INSERT INTO payroll.runs
      (id, property_id, rule_set_id, period_start, period_end, ethiopian_year, ethiopian_month,
       working_days, status, headcount, gross_santim, paye_santim, employee_pension_santim,
       employer_pension_santim, net_pay_santim, employer_cost_santim, calculated_at, calculated_by)
    VALUES (${runId}, ${PROPERTY_ID}, ${rules.id}, ${isoDate(prevMonthStart)}, ${periodEndIso}, ${ethYear}, ${ethMonth},
            ${workingDaysInPrevMonth}, 'calculated', ${employees.length}, ${totalGross}, ${totalPaye},
            ${totalEmpPension}, ${totalErPension}, ${totalNet}, ${totalEmployerCost}, now(), ${ADMIN_USER_ID})`;

  for (const row of payslipRows) {
    const employee = employees.find((e) => e.id === row.employee_id)!;
    const empRows = await sql<{ employee_no: string; given_name: string; fathers_name: string; tin: string | null; pension_number: string | null }[]>`
      SELECT employee_no, given_name, fathers_name, grandfathers_name, tin, pension_number
      FROM hr.employees WHERE id = ${employee.id}`;
    const empRow = empRows[0]!;
    const legalName = [empRow.given_name, empRow.fathers_name].filter(Boolean).join(' ');

    await sql`
      INSERT INTO payroll.payslips
        (id, run_id, employee_id, contract_id, employee_no, legal_name, tin, pension_number,
         position_title, department_name, basic_salary_santim, prorated_basic_santim,
         gross_santim, taxable_gross_santim, paye_santim, employee_pension_santim, employer_pension_santim,
         total_deductions_santim, net_pay_santim, employer_cost_santim, earning_lines, deduction_lines, warnings)
      VALUES (${row.id}, ${row.run_id}, ${row.employee_id}, ${row.contract_id}, ${empRow.employee_no}, ${legalName},
              ${empRow.tin}, ${empRow.pension_number}, ${row.position_title}, ${row.department_name},
              ${row.basic_salary_santim}, ${row.prorated_basic_santim}, ${row.gross_santim}, ${row.taxable_gross_santim},
              ${row.paye_santim}, ${row.employee_pension_santim}, ${row.employer_pension_santim},
              ${row.total_deductions_santim}, ${row.net_pay_santim}, ${row.employer_cost_santim},
              ${row.earning_lines}::jsonb, ${row.deduction_lines}::jsonb, ${row.warnings as string[]})`;
  }
  console.log(`  payroll run calculated for ${periodEndIso}: ${employees.length} payslips, rule set ${rules.id}`);

  // --- leave balances + a handful of requests ------------------------------
  const [annualType] = await sql<{ id: string }[]>`
    SELECT id FROM hr.leave_types WHERE code = 'ANNUAL' AND property_id IS NULL`;
  const [sickType] = await sql<{ id: string }[]>`
    SELECT id FROM hr.leave_types WHERE code = 'SICK' AND property_id IS NULL`;
  const fiscalYear = approximateEthiopianYearMonth(today)[0];

  for (const employee of employees) {
    const yearsOfService = Math.floor(
      (today.getTime() - new Date(employee.hiredOn).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );
    const entitled = annualLeaveEntitlement(yearsOfService);
    const taken = (parseInt(employee.id.slice(-1), 16) % 5); // 0-4 days, deterministic spread
    await sql`
      INSERT INTO hr.leave_balances (id, employee_id, leave_type_id, ethiopian_year, entitled_days, taken_days)
      VALUES (${uuidv7()}, ${employee.id}, ${annualType.id}, ${fiscalYear}, ${entitled}, ${taken})`;
  }
  console.log(`  ${employees.length} annual leave balances set for ${fiscalYear} EC (Art. 77: 16 + 1 per 2 years after the first)`);

  const inDays = (n: number) => isoDate(new Date(today.getTime() + n * 24 * 60 * 60 * 1000));
  const sample = [employees[2], employees[9], employees[16], employees[23], employees[30], employees[37]].filter(
    (e): e is SeededEmployee => !!e,
  );
  const requests: Array<{
    employee: SeededEmployee;
    leaveTypeId: string;
    startsOn: string;
    endsOn: string;
    workingDays: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
  }> = [
    { employee: sample[0], leaveTypeId: annualType.id, startsOn: inDays(5), endsOn: inDays(9), workingDays: 4, reason: 'Family event in Bahir Dar', status: 'pending' },
    { employee: sample[1], leaveTypeId: annualType.id, startsOn: inDays(12), endsOn: inDays(14), workingDays: 3, reason: 'Annual leave', status: 'pending' },
    { employee: sample[2], leaveTypeId: sickType.id, startsOn: inDays(-3), endsOn: inDays(-1), workingDays: 3, reason: 'Flu, doctor’s note on file', status: 'approved' },
    { employee: sample[3], leaveTypeId: annualType.id, startsOn: inDays(-14), endsOn: inDays(-10), workingDays: 5, reason: 'Annual leave — Timkat travel', status: 'approved' },
    { employee: sample[4], leaveTypeId: annualType.id, startsOn: inDays(20), endsOn: inDays(21), workingDays: 2, reason: 'Personal', status: 'rejected' },
    { employee: sample[5], leaveTypeId: sickType.id, startsOn: inDays(2), endsOn: inDays(2), workingDays: 1, reason: 'Clinic appointment', status: 'pending' },
  ];

  for (const request of requests) {
    const decided = request.status !== 'pending';
    await sql`
      INSERT INTO hr.leave_requests
        (id, employee_id, property_id, leave_type_id, starts_on, ends_on, working_days, reason, status,
         decided_by, decided_at, decision_note, ethiopian_year, created_by)
      VALUES (${uuidv7()}, ${request.employee.id}, ${PROPERTY_ID}, ${request.leaveTypeId}, ${request.startsOn},
              ${request.endsOn}, ${request.workingDays}, ${request.reason}, ${request.status},
              ${decided ? ADMIN_USER_ID : null}, ${decided ? new Date().toISOString() : null},
              ${request.status === 'rejected' ? 'Coverage too tight that week' : null}, ${fiscalYear}, ${ADMIN_USER_ID})`;
  }
  console.log(`  ${requests.length} leave requests (${requests.filter((r) => r.status === 'pending').length} pending)`);

  console.log('Done.');
  console.log('Demo login: admin@noru.local / noru-demo-2026 (no login UI wired up yet — see README TODO)');
}

function daysBetweenExcludingWeekday(start: Date, end: Date): number {
  let count = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0) count++; // exclude Sundays as a stand-in "working days" count
  }
  return count;
}

/**
 * Rough Ethiopian year/month for labelling the seeded run — NOT the verified
 * JDN conversion in src/lib/domain/ethiopian-calendar.ts, which the payroll
 * UI should use once it renders period labels. Good enough for a seed label.
 */
function approximateEthiopianYearMonth(gregorian: Date): [number, number] {
  const ethYear = gregorian.getUTCFullYear() - (gregorian.getUTCMonth() < 8 ? 8 : 7);
  const ethMonth = ((gregorian.getUTCMonth() + 4) % 12) + 1;
  return [ethYear, ethMonth];
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
