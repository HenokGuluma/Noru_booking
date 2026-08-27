import Link from 'next/link';
import { withScope } from '../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../lib/demo';
import { TagBoard, type OnDuty } from '../../components/TagBoard';
import { Icon } from '../../components/Icon';
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
  on_duty: number;
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

  const { onDuty, coverage, rosteredToday, pendingLeave } = await withScope(
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
        SELECT d.id AS department_id, d.name, d.name_am,
               COALESCE(onduty.cnt, 0)::int AS on_duty,
               COALESCE(req.total, 0)::int AS required
        FROM org.departments d
        LEFT JOIN (
          SELECT e.department_id, COUNT(*) AS cnt
          FROM ops.on_duty_now v
          JOIN hr.employees e ON e.id = v.employee_id
          WHERE v.property_id = ${DEMO_PROPERTY_ID}
          GROUP BY e.department_id
        ) onduty ON onduty.department_id = d.id
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
        ORDER BY r.starts_on
        LIMIT 6`;

      return {
        onDuty: onDutyRows,
        coverage: coverageRows,
        rosteredToday: Number(rosteredRows[0]?.count ?? 0),
        pendingLeave: pendingLeaveRows,
      };
    },
  );

  const tagBoardData: OnDuty[] = onDuty.map((row) => ({
    employeeId: row.employee_id,
    employeeNumber: row.employee_no,
    shortName: [row.given_name, row.fathers_name].filter(Boolean).join(' '),
    amharicName: [row.given_name_am, row.fathers_name_am].filter(Boolean).join(' ') || row.given_name,
    departmentCode: row.department_code,
    departmentColour: row.shift_colour ?? '#0E6A5A',
    clockedInMinutes: minutesOfDayAddis(new Date(row.first_in_at)),
    isLate: row.state === 'late',
  }));

  const lateCount = onDuty.filter((row) => row.state === 'late').length;
  const shortCount = coverage.filter((d) => d.required > 0 && d.on_duty < d.required).length;

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">Today</span>
          <h1>Duty desk</h1>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__icon"><Icon name="grid" /></span>
          <div className="kpi__body">
            <span className="kpi__label">On duty now</span>
            <div className="kpi__value">{onDuty.length}</div>
            <div className="kpi__delta">of {rosteredToday} rostered today</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--ochre"><Icon name="clock" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Late</span>
            <div className="kpi__value">{lateCount}</div>
            <div className="kpi__delta">clocked in past shift start</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--ember"><Icon name="scale" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Short-staffed</span>
            <div className="kpi__value">{shortCount}</div>
            <div className="kpi__delta">of {coverage.length} departments</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--indigo"><Icon name="calendar" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Rostered today</span>
            <div className="kpi__value">{rosteredToday}</div>
            <div className="kpi__delta">shift assignments</div>
          </div>
        </div>
      </div>

      <TagBoard onDuty={tagBoardData} rosteredCount={rosteredToday} />

      <div className="desk__grid">
        <section className="card">
          <header className="card__head">
            <h2 className="card__title">Cover by department</h2>
          </header>
          <div className="card__body">
            <ul className="cov">
              {coverage.map((department) => {
                const short = department.on_duty < department.required;
                const tight = department.on_duty === department.required && department.required > 0;
                const pct = department.required > 0 ? (department.on_duty / department.required) * 100 : 100;
                return (
                  <li className="cov__row" key={department.department_id}>
                    <span className="cov__name">{department.name}</span>
                    <span
                      className="cov__track"
                      role="meter"
                      aria-valuenow={department.on_duty}
                      aria-valuemin={0}
                      aria-valuemax={department.required}
                      aria-label={`${department.name}: ${department.on_duty} of ${department.required}`}
                    >
                      <span
                        className={`cov__fill${short ? ' cov__fill--short' : tight ? ' cov__fill--tight' : ''}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </span>
                    <span className={`cov__n mono${short ? ' cov__n--short' : ''}`}>
                      {department.on_duty}/{department.required}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="card">
          <header className="card__head">
            <h2 className="card__title">Waiting on you</h2>
            <span className="card__note mono">{pendingLeave.length}</span>
          </header>
          {pendingLeave.length === 0 ? (
            <div className="empty">
              <Icon name="tag" size={30} />
              <h4>Nothing waiting</h4>
              <p>No pending leave requests right now.</p>
            </div>
          ) : (
            <ul className="queue">
              {pendingLeave.map((request) => (
                <li className="queue__item" key={request.id}>
                  <span className="queue__avatar" aria-hidden="true">
                    {request.given_name[0]}
                    {request.fathers_name[0]}
                  </span>
                  <span className="queue__main">
                    <span className="queue__title">
                      {request.given_name} {request.fathers_name} · {request.leave_type_name}
                    </span>
                    <span className="queue__meta mono">
                      {request.starts_on} – {request.ends_on} · {request.working_days}d
                    </span>
                  </span>
                  <Link href="/leave" className="mini mini--ok">
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
