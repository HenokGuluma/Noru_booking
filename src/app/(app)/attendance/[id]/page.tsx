import Link from 'next/link';
import { withScope } from '../../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../../lib/demo';
import { Icon } from '../../../../components/Icon';
import { AttendanceCorrections } from '../../../../components/AttendanceCorrections';

export const dynamic = 'force-dynamic';

interface DayRow {
  work_date: string;
  state: string;
  first_in_at: string | null;
  last_out_at: string | null;
  worked_minutes: number;
  late_minutes: number;
  locked_at: string | null;
}

const STATE_PILL: Record<string, string> = {
  present: 'pill--success',
  late: 'pill--warning',
  absent: 'pill--danger',
  on_leave: 'pill--indigo',
  rest_day: 'pill--muted',
  holiday: 'pill--indigo',
  incomplete: 'pill--warning',
};

function hhmm(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export default async function AttendanceEmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { employee, days } = await withScope({ userId: DEMO_ADMIN_USER_ID }, async (tx) => {
    const [emp] = await tx<{ id: string; given_name: string; fathers_name: string; department_name: string | null }[]>`
      SELECT e.id, e.given_name, e.fathers_name, d.name AS department_name
      FROM hr.employees e
      LEFT JOIN org.departments d ON d.id = e.department_id
      WHERE e.id = ${id} AND e.property_id = ${DEMO_PROPERTY_ID}`;

    if (!emp) return { employee: null, days: [] as DayRow[] };

    const dayRows = await tx<DayRow[]>`
      SELECT work_date::text, state, first_in_at, last_out_at, worked_minutes, late_minutes, locked_at
      FROM ops.attendance_days
      WHERE employee_id = ${id}
      ORDER BY work_date DESC
      LIMIT 45`;

    return { employee: emp, days: dayRows };
  });

  if (!employee) {
    return (
      <main className="page">
        <section className="card">
          <div className="empty">
            <Icon name="clock" size={30} />
            <h4>No attendance record</h4>
            <p>
              Either this employee doesn&rsquo;t exist, or was added locally in this session (see the Staff tab) —
              there&rsquo;s no database row to read attendance from either way.{' '}
              <Link href="/attendance" style={{ color: 'var(--enamel)' }}>Back to attendance</Link>.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <p>
        <Link href="/attendance" className="mono muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12.5 }}>
          <Icon name="chevronLeft" size={13} />
          Attendance
        </Link>
      </p>

      <header className="page__head">
        <div>
          <span className="page__eyebrow">{employee.department_name}</span>
          <h1>{employee.given_name} {employee.fathers_name}</h1>
          <p className="page__sub">
            <Link href={`/staff/${employee.id}`} style={{ color: 'var(--enamel)' }}>View staff record</Link>
          </p>
        </div>
      </header>

      <div className="local-note">
        <Icon name="info" size={15} />
        <span>
          The daily record below is read-only by design: <span className="mono">ops.attendance_days</span> and the
          punches behind it are append-only (CLAUDE.md §6). A correction is logged as a new, separate record — see
          Corrections below — never an edit to the original row.
        </span>
      </div>

      <section className="card">
        <header className="card__head">
          <h2 className="card__title">Daily record</h2>
          <span className="card__note mono">last {days.length} days</span>
        </header>
        {days.length === 0 ? (
          <div className="empty">
            <Icon name="clock" size={28} />
            <h4>No attendance recorded</h4>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>State</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Worked</th>
                  <th>Late</th>
                  <th>Locked</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.work_date}>
                    <td className="mono">{day.work_date}</td>
                    <td>
                      <span className={`pill ${STATE_PILL[day.state] ?? 'pill--muted'}`}>
                        <span className="pill__dot" />
                        {day.state.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="mono">{hhmm(day.first_in_at)}</td>
                    <td className="mono">{hhmm(day.last_out_at)}</td>
                    <td className="mono">{(day.worked_minutes / 60).toFixed(1)}h</td>
                    <td className="mono">{day.late_minutes > 0 ? `${day.late_minutes}m` : '—'}</td>
                    <td>{day.locked_at ? <Icon name="check" size={14} /> : <span className="muted">open</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AttendanceCorrections employeeId={employee.id} availableDates={days.map((d) => d.work_date)} />
    </main>
  );
}
