import Link from 'next/link';
import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../lib/demo';
import { Icon } from '../../../components/Icon';

export const dynamic = 'force-dynamic';

interface SummaryRow {
  employee_id: string;
  given_name: string;
  fathers_name: string;
  department_name: string;
  days_present: number;
  days_late: number;
  days_rest: number;
  worked_minutes: number;
  late_minutes: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

export default async function AttendancePage() {
  const today = new Date();
  // The most recently reconciled, locked period — the one payroll actually
  // read from. "Today" (still open) is what the duty desk's tag board covers.
  const periodEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  const periodStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1));

  const rows = await withScope({ userId: DEMO_ADMIN_USER_ID }, (tx) =>
    tx<SummaryRow[]>`
      SELECT a.employee_id, e.given_name, e.fathers_name, d.name AS department_name,
             COUNT(*) FILTER (WHERE a.state IN ('present', 'late'))::int AS days_present,
             COUNT(*) FILTER (WHERE a.state = 'late')::int AS days_late,
             COUNT(*) FILTER (WHERE a.state = 'rest_day')::int AS days_rest,
             COALESCE(SUM(a.worked_minutes), 0)::int AS worked_minutes,
             COALESCE(SUM(a.late_minutes), 0)::int AS late_minutes
      FROM ops.attendance_days a
      JOIN hr.employees e ON e.id = a.employee_id
      JOIN org.departments d ON d.id = e.department_id
      WHERE a.property_id = ${DEMO_PROPERTY_ID}
        AND a.work_date BETWEEN ${isoDate(periodStart)} AND ${isoDate(periodEnd)}
      GROUP BY a.employee_id, e.given_name, e.fathers_name, d.name
      ORDER BY days_late DESC, e.given_name`,
  );

  const totalPresent = rows.reduce((sum, r) => sum + r.days_present, 0);
  const totalLate = rows.reduce((sum, r) => sum + r.days_late, 0);
  const totalWorkedMinutes = rows.reduce((sum, r) => sum + r.worked_minutes, 0);
  const presentRate = totalPresent > 0 ? Math.round(((totalPresent - totalLate) / totalPresent) * 100) : 0;

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">Operate</span>
          <h1>Attendance</h1>
          <p className="page__sub">
            Reconciled and locked for {periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            {' '}— the period the payroll run on the Payroll tab was calculated from.
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <section className="card">
          <div className="empty">
            <Icon name="clock" size={30} />
            <h4>No attendance recorded yet</h4>
            <p>Run <span className="mono">pnpm seed</span> against a fresh database to generate a locked month.</p>
          </div>
        </section>
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__icon"><Icon name="clock" /></span>
              <div className="kpi__body">
                <span className="kpi__label">On-time rate</span>
                <div className="kpi__value">{presentRate}%</div>
                <div className="kpi__delta">across {rows.length} staff</div>
              </div>
            </div>
            <div className="kpi">
              <span className="kpi__icon kpi__icon--ochre"><Icon name="clock" /></span>
              <div className="kpi__body">
                <span className="kpi__label">Late instances</span>
                <div className="kpi__value">{totalLate}</div>
              </div>
            </div>
            <div className="kpi">
              <span className="kpi__icon kpi__icon--indigo"><Icon name="scale" /></span>
              <div className="kpi__body">
                <span className="kpi__label">Hours worked</span>
                <div className="kpi__value">{hours(totalWorkedMinutes)}</div>
              </div>
            </div>
            <div className="kpi">
              <span className="kpi__icon"><Icon name="grid" /></span>
              <div className="kpi__body">
                <span className="kpi__label">Days present</span>
                <div className="kpi__value">{totalPresent}</div>
              </div>
            </div>
          </div>

          <section className="card">
            <header className="card__head">
              <h2 className="card__title">By employee</h2>
              <span className="card__note mono">{rows.length}</span>
            </header>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Present</th>
                    <th>Late</th>
                    <th>Rest days</th>
                    <th>Hours worked</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.employee_id}>
                      <td>
                        <Link href={`/attendance/${row.employee_id}`} className="col-name" style={{ textDecoration: 'none', color: 'inherit' }}>
                          {row.given_name} {row.fathers_name}
                        </Link>
                      </td>
                      <td className="muted">{row.department_name}</td>
                      <td className="mono">{row.days_present}</td>
                      <td>
                        {row.days_late > 0 ? (
                          <span className="pill pill--warning">
                            <span className="pill__dot" />
                            {row.days_late}
                          </span>
                        ) : (
                          <span className="mono muted">0</span>
                        )}
                      </td>
                      <td className="mono muted">{row.days_rest}</td>
                      <td className="mono">{hours(row.worked_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
