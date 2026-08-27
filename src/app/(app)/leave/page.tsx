import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../lib/demo';
import { Icon } from '../../../components/Icon';
import { LeaveRequestsTable } from '../../../components/LeaveRequestsTable';
import type { LeaveRequestEntry, EmployeeOption } from '../../../lib/records';
import type { LeaveTypeOption } from '../../../components/LeaveRequestForm';

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
  employee_id: string;
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

export default async function LeavePage() {
  const { balances, requests, employees, leaveTypes } = await withScope({ userId: DEMO_ADMIN_USER_ID }, async (tx) => {
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
      SELECT r.id, r.employee_id, e.given_name, e.fathers_name, lt.name AS leave_type_name,
             r.starts_on::text, r.ends_on::text, r.working_days::text, r.reason, r.status, r.decision_note
      FROM hr.leave_requests r
      JOIN hr.employees e ON e.id = r.employee_id
      JOIN hr.leave_types lt ON lt.id = r.leave_type_id
      WHERE r.property_id = ${DEMO_PROPERTY_ID}
      ORDER BY (r.status = 'pending') DESC, r.starts_on`;

    const employeeRows = await tx<Array<{ id: string; given_name: string; fathers_name: string; employee_no: string }>>`
      SELECT id, given_name, fathers_name, employee_no FROM hr.employees
      WHERE property_id = ${DEMO_PROPERTY_ID} AND archived_at IS NULL AND status != 'terminated'
      ORDER BY given_name`;

    const leaveTypeRows = await tx<LeaveTypeOption[]>`
      SELECT id, name FROM hr.leave_types WHERE property_id IS NULL OR property_id = ${DEMO_PROPERTY_ID} ORDER BY name`;

    return { balances: balanceRows, requests: requestRows, employees: employeeRows, leaveTypes: leaveTypeRows };
  });

  const requestEntries: LeaveRequestEntry[] = requests.map((r) => ({
    id: r.id,
    employeeId: r.employee_id,
    employeeName: [r.given_name, r.fathers_name].filter(Boolean).join(' '),
    leaveTypeName: r.leave_type_name,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    workingDays: r.working_days,
    status: r.status,
    reason: r.reason,
    decisionNote: r.decision_note,
  }));

  const employeeOptions: EmployeeOption[] = employees.map((e) => ({
    id: e.id,
    name: [e.given_name, e.fathers_name].filter(Boolean).join(' '),
    employeeNo: e.employee_no,
    departmentCode: '',
    departmentColour: '#0E6A5A',
  }));

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
            <div className="kpi__value">{requestEntries.filter((r) => r.status === 'pending').length}</div>
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

      <LeaveRequestsTable initialRequests={requestEntries} employees={employeeOptions} leaveTypes={leaveTypes} />

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
