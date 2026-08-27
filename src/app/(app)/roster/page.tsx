import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../lib/demo';

export const dynamic = 'force-dynamic';

interface AssignmentRow {
  employee_id: string;
  given_name: string;
  fathers_name: string;
  department_name: string;
  work_date: string;
  shift_code: string | null;
  shift_colour: string | null;
  start_minutes: number;
  end_minutes: number;
}

function fmt(minutes: number): string {
  const m = minutes % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export default async function RosterPage() {
  const rows = await withScope({ userId: DEMO_ADMIN_USER_ID }, (tx) =>
    tx<AssignmentRow[]>`
      SELECT sa.employee_id, e.given_name, e.fathers_name, d.name AS department_name,
             sa.work_date::text AS work_date, st.code AS shift_code, st.colour AS shift_colour,
             sa.start_minutes, sa.end_minutes
      FROM ops.shift_assignments sa
      JOIN ops.rosters r ON r.id = sa.roster_id
      JOIN hr.employees e ON e.id = sa.employee_id
      JOIN org.departments d ON d.id = e.department_id
      LEFT JOIN ops.shift_templates st ON st.id = sa.shift_template_id
      WHERE r.property_id = ${DEMO_PROPERTY_ID} AND sa.status <> 'cancelled'
      ORDER BY d.name, e.given_name, sa.work_date`,
  );

  const days = [...new Set(rows.map((r) => r.work_date))].sort();
  const byEmployee = new Map<string, { name: string; department: string; cells: Map<string, AssignmentRow> }>();
  for (const row of rows) {
    if (!byEmployee.has(row.employee_id)) {
      byEmployee.set(row.employee_id, {
        name: `${row.given_name} ${row.fathers_name}`,
        department: row.department_name,
        cells: new Map(),
      });
    }
    byEmployee.get(row.employee_id)!.cells.set(row.work_date, row);
  }

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">Operate</span>
          <h1>Roster — this week</h1>
          <p className="page__sub">
            {byEmployee.size} staff scheduled across {new Set(rows.map((r) => r.department_name)).size} departments
          </p>
        </div>
      </header>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Dept.</th>
                {days.map((day) => (
                  <th key={day}>
                    {new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...byEmployee.entries()].map(([employeeId, employee]) => (
                <tr key={employeeId}>
                  <td className="col-name" style={{ whiteSpace: 'nowrap' }}>{employee.name}</td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{employee.department}</td>
                  {days.map((day) => {
                    const shift = employee.cells.get(day);
                    return (
                      <td key={day}>
                        {shift ? (
                          <span className="shift-chip">
                            <span className="shift-chip__dot" style={{ background: shift.shift_colour ?? 'var(--enamel)' }} />
                            {shift.shift_code} {fmt(shift.start_minutes)}–{fmt(shift.end_minutes)}
                          </span>
                        ) : (
                          <span className="shift-chip shift-chip--rest">rest</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
