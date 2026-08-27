import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../lib/demo';
import { DepartmentsTable } from '../../../components/DepartmentsTable';
import type { DepartmentRecord } from '../../../lib/records';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  const departments = await withScope({ userId: DEMO_ADMIN_USER_ID }, (tx) =>
    tx<
      Array<{
        id: string;
        code: string;
        name: string;
        name_am: string | null;
        is_operational: boolean;
        headcount: number;
        position_title: string | null;
      }>
    >`
      SELECT d.id, d.code, d.name, d.name_am, d.is_operational,
             COUNT(e.id)::int AS headcount,
             p.title AS position_title
      FROM org.departments d
      LEFT JOIN hr.employees e ON e.department_id = d.id AND e.archived_at IS NULL
      LEFT JOIN org.positions p ON p.department_id = d.id
      WHERE d.property_id = ${DEMO_PROPERTY_ID} AND d.archived_at IS NULL
      GROUP BY d.id, p.title
      ORDER BY headcount DESC`,
  );

  const records: DepartmentRecord[] = departments.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    nameAm: d.name_am,
    isOperational: d.is_operational,
    headcount: d.headcount,
    positionTitle: d.position_title,
  }));

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">People</span>
          <h1>Departments</h1>
        </div>
      </header>

      <DepartmentsTable initialDepartments={records} />
    </main>
  );
}
