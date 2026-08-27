import { withScope } from '../../../../lib/db/scope';
import { DEMO_ADMIN_USER_ID, DEMO_PROPERTY_ID } from '../../../../lib/demo';
import type { EmployeeRecord, DepartmentOption } from '../../../../lib/records';
import { EmployeeDetailClient } from '../../../../components/EmployeeDetailClient';

export const dynamic = 'force-dynamic';

interface EmployeeExtra {
  personalEmail: string | null;
  region: string | null;
  city: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  managerName: string | null;
  attendanceDaysPresent: number;
  attendanceDaysLate: number;
  leaveEntitled: number;
  leaveTaken: number;
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { record, extra, departments } = await withScope({ userId: DEMO_ADMIN_USER_ID }, async (tx) => {
    const rows = await tx<
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
        personal_email: string | null;
        region: string | null;
        city: string | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        manager_name: string | null;
      }>
    >`
      SELECT e.id, e.employee_no, e.given_name, e.fathers_name, e.grandfathers_name,
             e.given_name_am, e.fathers_name_am, e.sex, e.phone, e.status, e.hired_on::text,
             e.department_id, d.name AS department_name, p.title AS position_title,
             floor(EXTRACT(EPOCH FROM (now() - e.hired_on::timestamptz)) / 31557600)::int AS years_of_service,
             e.personal_email, e.region, e.city,
             e.emergency_contact_name, e.emergency_contact_phone,
             concat_ws(' ', m.given_name, m.fathers_name) AS manager_name
      FROM hr.employees e
      LEFT JOIN org.departments d ON d.id = e.department_id
      LEFT JOIN org.positions p ON p.id = e.position_id
      LEFT JOIN hr.employees m ON m.id = e.manager_id
      WHERE e.id = ${id} AND e.property_id = ${DEMO_PROPERTY_ID} AND e.archived_at IS NULL`;

    const row = rows[0];
    if (!row) {
      const departmentRows = await tx<DepartmentOption[]>`
        SELECT id, name FROM org.departments WHERE property_id = ${DEMO_PROPERTY_ID} AND archived_at IS NULL ORDER BY name`;
      return { record: null, extra: null, departments: departmentRows };
    }

    const [attendance] = await tx<{ present: string; late: string }[]>`
      SELECT COUNT(*) FILTER (WHERE state IN ('present','late'))::text AS present,
             COUNT(*) FILTER (WHERE state = 'late')::text AS late
      FROM ops.attendance_days WHERE employee_id = ${id}`;

    const [leave] = await tx<{ entitled: string; taken: string }[]>`
      SELECT COALESCE(SUM(entitled_days), 0)::text AS entitled, COALESCE(SUM(taken_days), 0)::text AS taken
      FROM hr.leave_balances WHERE employee_id = ${id}`;

    const departmentRows = await tx<DepartmentOption[]>`
      SELECT id, name FROM org.departments WHERE property_id = ${DEMO_PROPERTY_ID} AND archived_at IS NULL ORDER BY name`;

    const employeeRecord: EmployeeRecord = {
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
    };

    const extraInfo: EmployeeExtra = {
      personalEmail: row.personal_email,
      region: row.region,
      city: row.city,
      emergencyContactName: row.emergency_contact_name,
      emergencyContactPhone: row.emergency_contact_phone,
      managerName: row.manager_name?.trim() || null,
      attendanceDaysPresent: Number(attendance?.present ?? 0),
      attendanceDaysLate: Number(attendance?.late ?? 0),
      leaveEntitled: Number(leave?.entitled ?? 0),
      leaveTaken: Number(leave?.taken ?? 0),
    };

    return { record: employeeRecord, extra: extraInfo, departments: departmentRows };
  });

  return <EmployeeDetailClient id={id} serverRecord={record} extra={extra} departments={departments} />;
}
