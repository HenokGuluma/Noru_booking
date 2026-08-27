import Link from 'next/link';
import { withScope } from '../../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../../lib/demo';
import { formatBirr, santim } from '../../../../lib/domain';
import { Icon } from '../../../../components/Icon';
import { PayrollRunActions } from '../../../../components/PayrollRunActions';
import type { PayrollRunEntry, ApproverOption } from '../../../../lib/records';

export const dynamic = 'force-dynamic';

interface PayslipRow {
  id: string;
  employee_id: string;
  employee_no: string;
  legal_name: string;
  department_name: string;
  gross_santim: string;
  paye_santim: string;
  employee_pension_santim: string;
  net_pay_santim: string;
}

interface RunRow {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  headcount: number;
  gross_santim: string;
  paye_santim: string;
  employee_pension_santim: string;
  net_pay_santim: string;
  rule_set_id: string;
  calculated_by: string;
  calculated_by_name: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  paid_at: string | null;
}

const money = (v: string) => formatBirr(santim(Number(v)));

export default async function PayrollRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const { run, payslips, approvers } = await withScope({ userId: DEMO_ADMIN_USER_ID }, async (tx) => {
    const [runRow] = await tx<RunRow[]>`
      SELECT r.id, r.period_start::text, r.period_end::text, r.status, r.headcount,
             r.gross_santim::text, r.paye_santim::text, r.employee_pension_santim::text,
             r.net_pay_santim::text, r.rule_set_id, r.calculated_by, cu.display_name AS calculated_by_name,
             r.approved_by, au.display_name AS approved_by_name, r.approved_at::text, r.paid_at::text
      FROM payroll.runs r
      JOIN iam.users cu ON cu.id = r.calculated_by
      LEFT JOIN iam.users au ON au.id = r.approved_by
      WHERE r.id = ${runId}`;
    const payslipRows = await tx<PayslipRow[]>`
      SELECT id, employee_id, employee_no, legal_name, department_name,
             gross_santim::text, paye_santim::text, employee_pension_santim::text, net_pay_santim::text
      FROM payroll.payslips WHERE run_id = ${runId} ORDER BY employee_no`;
    const approverRows = await tx<ApproverOption[]>`
      SELECT u.id, u.display_name AS name
      FROM iam.users u
      JOIN iam.user_roles ur ON ur.user_id = u.id
      JOIN iam.role_permissions rp ON rp.role_id = ur.role_id
      WHERE rp.permission_code = 'payroll.approve'
        AND (ur.property_id IS NULL OR ur.property_id = ${DEMO_PROPERTY_ID})
      GROUP BY u.id, u.display_name
      ORDER BY u.display_name`;
    return { run: runRow, payslips: payslipRows, approvers: approverRows };
  });

  if (!run) {
    return (
      <main className="page">
        <p className="banner banner--error">No run with that ID.</p>
      </main>
    );
  }

  const runEntry: PayrollRunEntry = {
    id: run.id,
    status: run.status,
    calculatedBy: run.calculated_by,
    calculatedByName: run.calculated_by_name,
    approvedBy: run.approved_by,
    approvedByName: run.approved_by_name,
    approvedAt: run.approved_at,
    paidAt: run.paid_at,
  };

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">Money · Payroll run</span>
          <h1>{run.period_start} — {run.period_end}</h1>
          <PayrollRunActions initialRun={runEntry} approvers={approvers} />
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__icon"><Icon name="users" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Headcount</span>
            <div className="kpi__value">{run.headcount}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--indigo"><Icon name="banknote" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Gross</span>
            <div className="kpi__value">{money(run.gross_santim)}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--ochre"><Icon name="scale" /></span>
          <div className="kpi__body">
            <span className="kpi__label">PAYE</span>
            <div className="kpi__value">{money(run.paye_santim)}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--ember"><Icon name="scale" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Pension (7%)</span>
            <div className="kpi__value">{money(run.employee_pension_santim)}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon"><Icon name="banknote" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Net pay</span>
            <div className="kpi__value">{money(run.net_pay_santim)}</div>
          </div>
        </div>
      </div>

      <section className="card">
        <header className="card__head">
          <h2 className="card__title">Payslips</h2>
          <span className="card__note mono">{payslips.length}</span>
        </header>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Name</th>
                <th>Department</th>
                <th>Gross</th>
                <th>PAYE</th>
                <th>Pension</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((slip) => (
                <tr key={slip.id}>
                  <td colSpan={7} style={{ padding: 0 }}>
                    <Link
                      href={`/payroll/${runId}/${slip.employee_id}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 0.9fr)',
                        gap: 8, alignItems: 'center', padding: '12px 16px', textDecoration: 'none', color: 'inherit',
                      }}
                    >
                      <span className="mono muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slip.employee_no}</span>
                      <span className="col-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slip.legal_name}</span>
                      <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slip.department_name}</span>
                      <span className="mono">{money(slip.gross_santim)}</span>
                      <span className="mono">{money(slip.paye_santim)}</span>
                      <span className="mono">{money(slip.employee_pension_santim)}</span>
                      <span className="mono" style={{ fontWeight: 600 }}>{money(slip.net_pay_santim)}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
