import Link from 'next/link';
import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../lib/demo';
import { formatBirr, santim } from '../../../lib/domain';
import { Icon } from '../../../components/Icon';

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

const STATUS_PILL: Record<string, string> = {
  draft: 'pill--muted',
  calculating: 'pill--warning',
  calculated: 'pill--indigo',
  approved: 'pill--success',
  paid: 'pill--success',
  cancelled: 'pill--danger',
};

export default async function PayrollPage() {
  const runs = await withScope({ userId: DEMO_ADMIN_USER_ID }, (tx) =>
    tx<RunRow[]>`
      SELECT id, period_start::text, period_end::text, ethiopian_year, ethiopian_month,
             status, headcount, net_pay_santim::text, rule_set_id
      FROM payroll.runs
      WHERE property_id = ${DEMO_PROPERTY_ID}
      ORDER BY period_end DESC`,
  );

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">Money</span>
          <h1>Payroll</h1>
        </div>
      </header>

      {runs.length === 0 ? (
        <section className="card">
          <div className="empty">
            <Icon name="banknote" size={30} />
            <h4>No runs yet</h4>
            <p>Run <span className="mono">pnpm seed</span> against a fresh database to generate one.</p>
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Rule set</th>
                  <th>Payslips</th>
                  <th>Net pay</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} style={{ cursor: 'pointer' }}>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <Link
                        href={`/payroll/${run.id}`}
                        style={{
                          display: 'grid',
                          // minmax(0, ...), not bare fr — a bare fr track has an
                          // implicit min-width equal to its content's min-content
                          // size, so the net-pay column refuses to shrink and
                          // spills the row past the card edge instead of just
                          // wrapping or eliding.
                          gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.9fr)',
                          alignItems: 'center',
                          gap: 8,
                          padding: '12px 16px',
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <span className="col-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {run.period_start} – {run.period_end}
                        </span>
                        <span className="mono muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {run.rule_set_id}
                        </span>
                        <span className="mono">{run.headcount}</span>
                        <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatBirr(santim(Number(run.net_pay_santim)))}
                        </span>
                        <span className={`pill ${STATUS_PILL[run.status] ?? 'pill--muted'}`} style={{ justifySelf: 'start' }}>
                          <span className="pill__dot" />
                          {run.status}
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
