import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../lib/demo';
import { RosterGrid } from '../../../components/RosterGrid';
import type { ShiftAssignmentEntry, ShiftTemplateOption } from '../../../lib/records';

export const dynamic = 'force-dynamic';

export default async function RosterPage() {
  const { assignments, employees, shiftTemplates, rosterStatuses, weekStart } = await withScope(
    { userId: DEMO_ADMIN_USER_ID },
    async (tx) => {
      const assignmentRows = await tx<
        Array<{
          id: string;
          employee_id: string;
          given_name: string;
          fathers_name: string;
          department_name: string;
          work_date: string;
          shift_template_id: string | null;
          shift_code: string | null;
          shift_colour: string | null;
          start_minutes: number;
          end_minutes: number;
        }>
      >`
        SELECT sa.id, sa.employee_id, e.given_name, e.fathers_name, d.name AS department_name,
               sa.work_date::text AS work_date, sa.shift_template_id, st.code AS shift_code, st.colour AS shift_colour,
               sa.start_minutes, sa.end_minutes
        FROM ops.shift_assignments sa
        JOIN ops.rosters r ON r.id = sa.roster_id
        JOIN hr.employees e ON e.id = sa.employee_id
        JOIN org.departments d ON d.id = e.department_id
        LEFT JOIN ops.shift_templates st ON st.id = sa.shift_template_id
        WHERE r.property_id = ${DEMO_PROPERTY_ID} AND sa.status <> 'cancelled'
        ORDER BY d.name, e.given_name, sa.work_date`;

      const employeeRows = await tx<Array<{ id: string; given_name: string; fathers_name: string; department_name: string }>>`
        SELECT e.id, e.given_name, e.fathers_name, d.name AS department_name
        FROM hr.employees e
        LEFT JOIN org.departments d ON d.id = e.department_id
        WHERE e.property_id = ${DEMO_PROPERTY_ID} AND e.archived_at IS NULL AND e.status != 'terminated'
        ORDER BY d.name, e.given_name`;

      const shiftTemplateRows = await tx<ShiftTemplateOption[]>`
        SELECT id, code, name, colour, start_minutes AS "startMinutes", end_minutes AS "endMinutes"
        FROM ops.shift_templates
        WHERE property_id = ${DEMO_PROPERTY_ID} AND archived_at IS NULL
        ORDER BY start_minutes`;

      const rosterRows = await tx<Array<{ id: string; department_name: string; status: string }>>`
        SELECT r.id, d.name AS department_name, r.status
        FROM ops.rosters r
        JOIN org.departments d ON d.id = r.department_id
        WHERE r.property_id = ${DEMO_PROPERTY_ID}
        ORDER BY d.name`;

      const [weekRow] = await tx<{ week_start: string }[]>`
        SELECT week_start::text FROM ops.rosters WHERE property_id = ${DEMO_PROPERTY_ID} LIMIT 1`;

      return {
        assignments: assignmentRows,
        employees: employeeRows,
        shiftTemplates: shiftTemplateRows,
        rosterStatuses: rosterRows,
        weekStart: weekRow?.week_start ?? new Date().toISOString().slice(0, 10),
      };
    },
  );

  const assignmentEntries: ShiftAssignmentEntry[] = assignments.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: [row.given_name, row.fathers_name].filter(Boolean).join(' '),
    departmentName: row.department_name,
    workDate: row.work_date,
    shiftTemplateId: row.shift_template_id ?? '',
    shiftCode: row.shift_code ?? '?',
    shiftColour: row.shift_colour ?? '#0E6A5A',
    startMinutes: row.start_minutes,
    endMinutes: row.end_minutes,
  }));

  const employeeList = employees.map((e) => ({
    id: e.id,
    name: [e.given_name, e.fathers_name].filter(Boolean).join(' '),
    departmentName: e.department_name,
  }));

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">Operate</span>
          <h1>Roster — week of {weekStart}</h1>
          <p className="page__sub">{employeeList.length} staff across {new Set(employeeList.map((e) => e.departmentName)).size} departments</p>
        </div>
      </header>

      <RosterGrid
        weekStart={weekStart}
        initialAssignments={assignmentEntries}
        employees={employeeList}
        shiftTemplates={shiftTemplates}
        initialRosterStatuses={rosterStatuses}
      />
    </main>
  );
}
