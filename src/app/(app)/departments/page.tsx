import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../lib/demo';
import { Icon } from '../../../components/Icon';

export const dynamic = 'force-dynamic';

interface DepartmentRow {
  id: string;
  code: string;
  name: string;
  name_am: string | null;
  is_operational: boolean;
  headcount: number;
  position_title: string | null;
  salary_band_min_santim: string | null;
  salary_band_max_santim: string | null;
}

export default async function DepartmentsPage() {
  const departments = await withScope({ userId: DEMO_ADMIN_USER_ID }, (tx) =>
    tx<DepartmentRow[]>`
      SELECT d.id, d.code, d.name, d.name_am, d.is_operational,
             COUNT(e.id)::int AS headcount,
             p.title AS position_title, p.salary_band_min_santim::text, p.salary_band_max_santim::text
      FROM org.departments d
      LEFT JOIN hr.employees e ON e.department_id = d.id AND e.archived_at IS NULL
      LEFT JOIN org.positions p ON p.department_id = d.id
      WHERE d.property_id = ${DEMO_PROPERTY_ID} AND d.archived_at IS NULL
      GROUP BY d.id, p.title, p.salary_band_min_santim, p.salary_band_max_santim
      ORDER BY headcount DESC`,
  );

  const totalHeadcount = departments.reduce((sum, d) => sum + d.headcount, 0);
  const operational = departments.filter((d) => d.is_operational).length;

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">People</span>
          <h1>Departments</h1>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__icon"><Icon name="grid" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Departments</span>
            <div className="kpi__value">{departments.length}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon kpi__icon--indigo"><Icon name="users" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Total headcount</span>
            <div className="kpi__value">{totalHeadcount}</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon"><Icon name="scale" /></span>
          <div className="kpi__body">
            <span className="kpi__label">Operational</span>
            <div className="kpi__value">{operational}</div>
            <div className="kpi__delta">vs {departments.length - operational} back office</div>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Code</th>
                <th>Position</th>
                <th>Headcount</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id}>
                  <td>
                    <div className="col-name">{dept.name}</div>
                    {dept.name_am && <div className="muted" style={{ fontSize: 11.5 }}>{dept.name_am}</div>}
                  </td>
                  <td className="mono muted">{dept.code}</td>
                  <td className="muted">{dept.position_title ?? '—'}</td>
                  <td className="mono">{dept.headcount}</td>
                  <td>
                    <span className={`pill ${dept.is_operational ? 'pill--success' : 'pill--indigo'}`}>
                      <span className="pill__dot" />
                      {dept.is_operational ? 'operational' : 'back office'}
                    </span>
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
