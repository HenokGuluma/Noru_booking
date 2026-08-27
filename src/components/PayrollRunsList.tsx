'use client';

import Link from 'next/link';
import { useLocalOverlay } from '../lib/local-store';
import { formatBirr, santim } from '../lib/domain';

interface RunRow {
  id: string;
  period_start: string;
  period_end: string;
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

export function PayrollRunsList({ initialRuns }: { initialRuns: RunRow[] }) {
  // Same overlay key ('payroll-runs') that the run detail page's Approve /
  // Mark-as-paid actions write to, so a status change made there doesn't
  // look stale here — the shape differs (this page only cares about
  // `status`) but a shallow-merged patch applies to any base row with a
  // matching field name.
  const { rows: runs } = useLocalOverlay<RunRow>('payroll-runs', initialRuns);

  return (
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
              <tr key={run.id}>
                <td colSpan={5} style={{ padding: 0 }}>
                  <Link
                    href={`/payroll/${run.id}`}
                    style={{
                      display: 'grid',
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
  );
}
