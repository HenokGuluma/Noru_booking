import { withScope } from '../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../lib/demo';
import { DutyDeskClient } from '../../components/DutyDeskClient';
import type { OnDutyEntry, EmployeeOption, LeaveRequestEntry } from '../../lib/records';
import '../../components/duty-desk.css';

// Who's on duty changes minute to minute; never freeze this at build time.
export const dynamic = 'force-dynamic';

/** Ethiopia is UTC+3 with no DST, so this local-minutes conversion is exact (CLAUDE.md). */
function minutesOfDayAddis(instant: Date): number {
  return ((instant.getUTCHours() + 3) * 60 + instant.getUTCMinutes()) % 1440;
}

interface OnDutyRow {
  employee_id: string;
  employee_no: string;
  given_name: string;
  fathers_name: string;
  given_name_am: string | null;
  fathers_name_am: string | null;
  department_code: string;
  shift_colour: string | null;
  first_in_at: string;
  state: string;
}

interface CoverageRow {
  department_id: string;
  name: string;
  name_am: string | null;
  department_code: string;
  required: number;
}

interface PendingLeaveRow {
  id: string;
  given_name: string;
  fathers_name: string;
  leave_type_name: string;
  starts_on: string;
  ends_on: string;
  working_days: string;
}

export default async function DutyDeskPage() {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekday = today.getUTCDay();

  const { onDuty, coverage, rosteredToday, pendingLeave, employeeOptions } = await withScope(
    { userId: DEMO_ADMIN_USER_ID },
    async (tx) => {
      const onDutyRows = await tx<OnDutyRow[]>`
        SELECT v.employee_id, e.employee_no, e.given_name, e.fathers_name,
               e.given_name_am, e.fathers_name_am, v.department_code, v.shift_colour,
               v.first_in_at, v.state
        FROM ops.on_duty_now v
        JOIN hr.employees e ON e.id = v.employee_id
        WHERE v.property_id = ${DEMO_PROPERTY_ID}
        ORDER BY v.first_in_at`;

      const coverageRows = await tx<CoverageRow[]>`
        SELECT d.id AS department_id, d.name, d.name_am, d.code AS department_code,
               COALESCE(req.total, 0)::int AS required
        FROM org.departments d
        LEFT JOIN (
          SELECT department_id, SUM(minimum_staff) AS total
          FROM ops.coverage_requirements
          WHERE property_id = ${DEMO_PROPERTY_ID} AND weekday = ${weekday}
          GROUP BY department_id
        ) req ON req.department_id = d.id
        WHERE d.property_id = ${DEMO_PROPERTY_ID} AND d.archived_at IS NULL
        ORDER BY d.name`;

      const rosteredRows = await tx<{ count: string }[]>`
        SELECT COUNT(*)::text AS count
        FROM ops.shift_assignments sa
        JOIN ops.rosters r ON r.id = sa.roster_id
        WHERE r.property_id = ${DEMO_PROPERTY_ID}
          AND sa.work_date = ${todayIso}
          AND sa.status <> 'cancelled'`;

      const pendingLeaveRows = await tx<PendingLeaveRow[]>`
        SELECT r.id, e.given_name, e.fathers_name, lt.name AS leave_type_name,
               r.starts_on::text, r.ends_on::text, r.working_days::text
        FROM hr.leave_requests r
        JOIN hr.employees e ON e.id = r.employee_id
        JOIN hr.leave_types lt ON lt.id = r.leave_type_id
        WHERE r.property_id = ${DEMO_PROPERTY_ID} AND r.status = 'pending'
        ORDER BY r.starts_on`;

      const employeeRows = await tx<Array<{ id: string; given_name: string; fathers_name: string; employee_no: string; department_code: string | null }>>`
        SELECT e.id, e.given_name, e.fathers_name, e.employee_no, d.code AS department_code
        FROM hr.employees e
        LEFT JOIN org.departments d ON d.id = e.department_id
        WHERE e.property_id = ${DEMO_PROPERTY_ID} AND e.archived_at IS NULL AND e.status != 'terminated'
        ORDER BY e.given_name`;

      return {
        onDuty: onDutyRows,
        coverage: coverageRows,
        rosteredToday: Number(rosteredRows[0]?.count ?? 0),
        pendingLeave: pendingLeaveRows,
        employeeOptions: employeeRows,
      };
    },
  );

  const onDutyEntries: OnDutyEntry[] = onDuty.map((row) => ({
    id: row.employee_id,
    employeeNumber: row.employee_no,
    shortName: [row.given_name, row.fathers_name].filter(Boolean).join(' '),
    amharicName: [row.given_name_am, row.fathers_name_am].filter(Boolean).join(' ') || row.given_name,
    departmentCode: row.department_code,
    departmentColour: row.shift_colour ?? '#0E6A5A',
    clockedInMinutes: minutesOfDayAddis(new Date(row.first_in_at)),
    isLate: row.state === 'late',
  }));

  const employeeOptionRecords: EmployeeOption[] = employeeOptions.map((e) => ({
    id: e.id,
    name: [e.given_name, e.fathers_name].filter(Boolean).join(' '),
    employeeNo: e.employee_no,
    departmentCode: e.department_code ?? '—',
    departmentColour: '#0E6A5A',
  }));

  const pendingLeaveEntries: LeaveRequestEntry[] = pendingLeave.map((row) => ({
    id: row.id,
    employeeName: [row.given_name, row.fathers_name].filter(Boolean).join(' '),
    leaveTypeName: row.leave_type_name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    workingDays: row.working_days,
    status: 'pending',
  }));

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">Today</span>
          <h1>Duty desk</h1>
        </div>
      </header>

      <DutyDeskClient
        initialOnDuty={onDutyEntries}
        employeeOptions={employeeOptionRecords}
        coverage={coverage}
        rosteredToday={rosteredToday}
        initialPendingLeave={pendingLeaveEntries}
      />
    </main>
  );
}
