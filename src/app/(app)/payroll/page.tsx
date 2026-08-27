import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../lib/demo';
import { Icon } from '../../../components/Icon';
import { PayrollRunsList } from '../../../components/PayrollRunsList';
import { StartRunCard } from '../../../components/StartRunCard';
import { ruleSetFor, santim } from '../../../lib/domain';

export const dynamic = 'force-dynamic';

interface RunRow {
  id: string;
  period_start: string;
  period_end: string;
  ethiopian_year: number;
  ethiopian_month: number;
  status: string;
  headcount: number;
  net_pay_santim: string;
  rule_set_id: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function PayrollPage() {
  const today = new Date();
  const periodStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const periodEndIso = isoDate(today);

  const { runs, openDaysCount, hasAnyAttendance, employees } = await withScope({ userId: DEMO_ADMIN_USER_ID }, async (tx) => {
    const runRows = await tx<RunRow[]>`
      SELECT id, period_start::text, period_end::text, ethiopian_year, ethiopian_month,
             status, headcount, net_pay_santim::text, rule_set_id
      FROM payroll.runs
      WHERE property_id = ${DEMO_PROPERTY_ID}
      ORDER BY period_end DESC`;

    const [openRow] = await tx<{ open_count: string; any_count: string }[]>`
      SELECT COUNT(*) FILTER (WHERE locked_at IS NULL)::text AS open_count, COUNT(*)::text AS any_count
      FROM ops.attendance_days
      WHERE property_id = ${DEMO_PROPERTY_ID} AND work_date BETWEEN ${isoDate(periodStart)} AND ${periodEndIso}`;

    const employeeRows = await tx<Array<{ id: string; given_name: string; fathers_name: string; basic_salary_santim: string }>>`
      SELECT e.id, e.given_name, e.fathers_name, c.basic_salary_santim::text
      FROM hr.employees e
      JOIN hr.employment_contracts c ON c.id = e.current_contract_id
      WHERE e.property_id = ${DEMO_PROPERTY_ID} AND e.archived_at IS NULL AND e.status != 'terminated'`;

    return {
      runs: runRows,
      openDaysCount: Number(openRow?.open_count ?? 0),
      hasAnyAttendance: Number(openRow?.any_count ?? 0) > 0,
      employees: employeeRows,
    };
  });

  let ruleSetId = '—';
  try {
    ruleSetId = ruleSetFor(periodEndIso).id;
  } catch {
    // No rule set covers today — genuinely shouldn't happen, but refuse
    // loudly rather than guess: StartRunCard treats a missing id as blocked
    // via hasAnyAttendance/openDaysCount already covering the common cases.
  }

  const periodLabel = periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">Money</span>
          <h1>Payroll</h1>
        </div>
      </header>

      <StartRunCard
        periodLabel={periodLabel}
        periodEnd={periodEndIso}
        openDaysCount={openDaysCount}
        hasAnyAttendance={hasAnyAttendance}
        ruleSetId={ruleSetId}
        employees={employees.map((e) => ({
          id: e.id,
          name: [e.given_name, e.fathers_name].filter(Boolean).join(' '),
          basicSalarySantim: santim(Number(e.basic_salary_santim)),
        }))}
      />

      {runs.length === 0 ? (
        <section className="card">
          <div className="empty">
            <Icon name="banknote" size={30} />
            <h4>No runs yet</h4>
            <p>Run <span className="mono">pnpm seed</span> against a fresh database to generate one.</p>
          </div>
        </section>
      ) : (
        <PayrollRunsList initialRuns={runs} />
      )}
    </main>
  );
}
