import { withScope } from '../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../lib/demo';
import { StaffTable } from '../../../components/StaffTable';
import type { EmployeeRecord, DepartmentOption } from '../../../lib/records';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  // basic_salary_santim exists on hr.employee_directory but is deliberately
  // not selected — salary is never rendered without checking salary.read
  // (CLAUDE.md, Interface rules), and no permission check is wired up yet.
  const { staff, departments } = await withScope({ userId: DEMO_ADMIN_USER_ID }, async (tx) => {
    const staffRows = await tx<
      Array<{
        id: string;
        employee_no: string;
        given_name: string;
        fathers_name: string;
        grandfathers_name: string | null;
        given_name_am: string | null;
        fathers_name_am: string | null;
        sex: 'male' | 'female';
        phone: string;
        status: string;
        hired_on: string;
        department_id: string;
        department_name: string | null;
        position_title: string | null;
        years_of_service: number | null;
      }>
    >`
      SELECT id, employee_no, given_name, fathers_name, grandfathers_name, given_name_am, fathers_name_am,
             sex, phone, status, hired_on::text, department_id, department_name, position_title, years_of_service
      FROM hr.employee_directory
      WHERE property_id = ${DEMO_PROPERTY_ID}
      ORDER BY given_name, fathers_name`;

    const departmentRows = await tx<DepartmentOption[]>`
      SELECT id, name FROM org.departments
      WHERE property_id = ${DEMO_PROPERTY_ID} AND archived_at IS NULL
      ORDER BY name`;

    return { staff: staffRows, departments: departmentRows };
  });

  const records: EmployeeRecord[] = staff.map((row) => ({
    id: row.id,
    employeeNo: row.employee_no,
    givenName: row.given_name,
    fathersName: row.fathers_name,
    grandfathersName: row.grandfathers_name,
    givenNameAm: row.given_name_am,
    fathersNameAm: row.fathers_name_am,
    sex: row.sex,
    phone: row.phone,
    status: row.status,
    hiredOn: row.hired_on,
    departmentId: row.department_id,
    departmentName: row.department_name ?? '—',
    positionTitle: row.position_title,
    yearsOfService: row.years_of_service,
  }));

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <span className="page__eyebrow">People</span>
          <h1>Staff</h1>
        </div>
      </header>

      <StaffTable initialStaff={records} departments={departments} />
    </main>
  );
}
