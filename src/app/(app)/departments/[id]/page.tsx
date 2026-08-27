import { withScope } from '../../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../../lib/demo';
import type { DepartmentRecord } from '../../../../lib/records';
import { DepartmentDetailClient, type DepartmentEmployee } from '../../../../components/DepartmentDetailClient';

export const dynamic = 'force-dynamic';

export default async function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { record, employees } = await withScope({ userId: DEMO_ADMIN_USER_ID }, async (tx) => {
    const rows = await tx<
      Array<{ id: string; code: string; name: string; name_am: string | null; is_operational: boolean; position_title: string | null }>
    >`
      SELECT d.id, d.code, d.name, d.name_am, d.is_operational, p.title AS position_title
      FROM org.departments d
      LEFT JOIN org.positions p ON p.department_id = d.id
      WHERE d.id = ${id} AND d.property_id = ${DEMO_PROPERTY_ID} AND d.archived_at IS NULL`;

    const row = rows[0];
    if (!row) return { record: null, employees: [] as DepartmentEmployee[] };

    const employeeRows = await tx<DepartmentEmployee[]>`
      SELECT e.id, e.given_name AS "givenName", e.fathers_name AS "fathersName", e.employee_no AS "employeeNo", e.status
      FROM hr.employees e
      WHERE e.department_id = ${id} AND e.archived_at IS NULL
      ORDER BY e.given_name`;

    const department: DepartmentRecord = {
      id: row.id,
      code: row.code,
      name: row.name,
      nameAm: row.name_am,
      isOperational: row.is_operational,
      headcount: employeeRows.length,
      positionTitle: row.position_title,
    };

    return { record: department, employees: employeeRows };
  });

  return <DepartmentDetailClient id={id} serverRecord={record} employees={employees} />;
}
