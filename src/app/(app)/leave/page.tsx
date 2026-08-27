import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../lib/demo';
import { Icon } from '../../../components/Icon';

export const dynamic = 'force-dynamic';

interface BalanceRow {
  employee_id: string;
  given_name: string;
  fathers_name: string;
  department_name: string;
  entitled_days: string;
  carried_over_days: string;
  taken_days: string;
  pending_days: string;
}

interface RequestRow {
  id: string;
  given_name: string;
  fathers_name: string;
  leave_type_name: string;
  starts_on: string;
  ends_on: string;
  working_days: string;
  reason: string | null;
  status: string;
  decision_note: string | null;
}

const STATUS_PILL: Record<string, string> = {
  pending: 'pill--warning',
  approved: 'pill--success',
  taken: 'pill--success',
  rejected: 'pill--danger',
  cancelled: 'pill--muted',
  draft: 'pill--muted',
};

export default async function LeavePage() {
  const { balances, requests } = await withScope({ userId: DEMO_ADMIN_USER_ID }, async (tx) => {
    const balanceRows = await tx<BalanceRow[]>`
      SELECT b.employee_id, e.given_name, e.fathers_name, d.name AS department_name,
             b.entitled_days::text, b.carried_over_days::text, b.taken_days::text, b.pending_days::text
      FROM hr.leave_balances b
      JOIN hr.employees e ON e.id = b.employee_id
      JOIN org.departments d ON d.id = e.department_id
      JOIN hr.leave_types lt ON lt.id = b.leave_type_id
      WHERE e.property_id = ${DEMO_PROPERTY_ID} AND lt.code = 'ANNUAL'
      ORDER BY e.given_name, e.fathers_name`;

    const requestRows = await tx<RequestRow[]>`
      SELECT r.id, e.given_name, e.fathers_name, lt.name AS leave_type_name,
             r.starts_on::text, r.ends_on::text, r.working_days::text, r.reason, r.status, r.decision_note
      FROM hr.leave_requests r
      JOIN hr.employees e ON e.id = r.employee_id
      JOIN hr.leave_types lt ON lt.id = r.leave_type_id
      WHERE r.property_id = ${DEMO_PROPERTY_ID}
      ORDER BY (r.status = 'pending') DESC, r.starts_on`;

    return { balances: balanceRows, requests: requestRows };
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const totalEntitled = balances.reduce((sum, b) => sum + Number(b.entitled_days), 0);
  const totalTaken = balances.reduce((sum, b) => sum + Number(b.taken_days), 0);

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">People</span>
          <h1>Leave</h1>
          <p className="page__sub">Annual leave entitlement per Art. 77 — 16 days plus one for every two years after the first.</p>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__icon kpi__icon--ochre"><Icon name="umbrella" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Pending requests</span>
            <div className="kpi__value">{pendingCount}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon"><Icon name="calendar" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Days entitled (all staff)</span>
            <div className="kpi__value">{totalEntitled}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--indigo"><Icon name="scale" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Days taken</span>
            <div className="kpi__value">{totalTaken}</div>
          </div>
        </div>
      </div>

      <section className="card">
        <header className="card__head">
          <h2 className="card__title">Requests</h2>
          <span className="card__note mono">{requests.length}</span>
        </header>
        {requests.length === 0 ? (
          <div className="empty">
            <Icon name="umbrella" size={30} />
            <h4>No requests yet</h4>
            <p>Run <span className="mono">pnpm seed</span> against a fresh database to generate some.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="col-name">{request.given_name} {request.fathers_name}</td>
                    <td className="muted">{request.leave_type_name}</td>
                    <td className="mono">{request.starts_on} – {request.ends_on}</td>
                    <td className="mono">{request.working_days}</td>
                    <td className="muted" style={{ maxWidth: 220 }}>
                      {request.reason}
                      {request.decision_note && (
                        <div style={{ fontSize: 11, marginTop: 2 }}>Note: {request.decision_note}</div>
                      )}
                    </td>
                    <td>
                      <span className={`pill ${STATUS_PILL[request.status] ?? 'pill--muted'}`}>
                        <span className="pill__dot" />
                        {request.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <header className="card__head">
          <h2 className="card__title">Balances</h2>
          <span className="card__note mono">Fiscal year · Hamle 1 – Sene 30</span>
        </header>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Entitled</th>
                <th>Carried over</th>
                <th>Taken</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((balance) => {
                const remaining = Number(balance.entitled_days) + Number(balance.carried_over_days) - Number(balance.taken_days) - Number(balance.pending_days);
                return (
                  <tr key={balance.employee_id}>
                    <td className="col-name">{balance.given_name} {balance.fathers_name}</td>
                    <td className="muted">{balance.department_name}</td>
                    <td className="mono">{balance.entitled_days}</td>
                    <td className="mono muted">{balance.carried_over_days}</td>
                    <td className="mono">{balance.taken_days}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{remaining}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
