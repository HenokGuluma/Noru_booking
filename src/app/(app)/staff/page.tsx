import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../lib/demo';
import { Icon } from '../../../components/Icon';

export const dynamic = 'force-dynamic';

interface DirectoryRow {
  id: string;
  employee_no: string;
  given_name: string;
  fathers_name: string;
  department_name: string | null;
  position_title: string | null;
  status: string;
  years_of_service: number | null;
}

const STATUS_PILL: Record<string, string> = {
  active: 'pill--success',
  probation: 'pill--warning',
  on_leave: 'pill--indigo',
  suspended: 'pill--danger',
  notice_period: 'pill--danger',
  terminated: 'pill--muted',
};

function initials(given: string, father: string): string {
  return `${given[0] ?? ''}${father[0] ?? ''}`.toUpperCase();
}

export default async function StaffPage() {
  // basic_salary_santim exists on this view but is deliberately not selected —
  // salary is never rendered without checking salary.read (CLAUDE.md, Interface rules).
  const staff = await withScope({ userId: DEMO_ADMIN_USER_ID }, (tx) =>
    tx<DirectoryRow[]>`
      SELECT id, employee_no, given_name, fathers_name, department_name, position_title, status, years_of_service
      FROM hr.employee_directory
      WHERE property_id = ${DEMO_PROPERTY_ID}
      ORDER BY given_name, fathers_name`,
  );

  const departmentCount = new Set(staff.map((s) => s.department_name)).size;
  const activeCount = staff.filter((s) => s.status === 'active').length;
  const probationCount = staff.filter((s) => s.status === 'probation').length;

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">People</span>
          <h1>Staff</h1>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__icon"><Icon name="users" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Total staff</span>
            <div className="kpi__value">{staff.length}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--indigo"><Icon name="grid" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Departments</span>
            <div className="kpi__value">{departmentCount}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon"><Icon name="scale" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Active</span>
            <div className="kpi__value">{activeCount}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--ochre"><Icon name="clock" /></span>
          <div className="kpi__body">
            <span className="kpi__label">On probation</span>
            <div className="kpi__value">{probationCount}</div>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>No.</th>
                <th>Department</th>
                <th>Position</th>
                <th>Status</th>
                <th>Years</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((person) => (
                <tr key={person.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        className="mono"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: 'var(--enamel-tint)',
                          color: 'var(--enamel-deep)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 11,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {initials(person.given_name, person.fathers_name)}
                      </span>
                      <span className="col-name">
                        {person.given_name} {person.fathers_name}
                      </span>
                    </div>
                  </td>
                  <td className="mono muted">{person.employee_no}</td>
                  <td>{person.department_name}</td>
                  <td className="muted">{person.position_title}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[person.status] ?? 'pill--muted'}`}>
                      <span className="pill__dot" />
                      {person.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="mono">{person.years_of_service}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
