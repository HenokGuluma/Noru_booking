-- =============================================================================
-- 0005  Row-level security and read models
-- =============================================================================
-- Tenancy is enforced in the database, not only in the service layer. The API
-- sets `app.current_user_id` and `app.current_property_id` on the connection at
-- the start of every request; a query that forgets a WHERE clause returns
-- nothing rather than another hotel's payroll.

CREATE OR REPLACE FUNCTION iam.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION iam.accessible_properties() RETURNS SETOF uuid
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT p.id
  FROM org.properties p
  WHERE EXISTS (
    SELECT 1 FROM iam.user_roles ur
    WHERE ur.user_id = iam.current_user_id()
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
      -- A NULL property_id on the grant means group-wide access.
      AND (ur.property_id IS NULL OR ur.property_id = p.id)
  )
$$;

CREATE OR REPLACE FUNCTION iam.has_permission(permission text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM iam.user_roles ur
    JOIN iam.role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = iam.current_user_id()
      AND rp.permission_code = permission
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  )
$$;

ALTER TABLE hr.employees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employment_contracts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.rosters               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.attendance_days       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.leave_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll.runs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll.payslips          ENABLE ROW LEVEL SECURITY;

CREATE POLICY employees_tenant ON hr.employees
  USING (property_id IN (SELECT iam.accessible_properties()));

CREATE POLICY contracts_tenant ON hr.employment_contracts
  USING (property_id IN (SELECT iam.accessible_properties()));

CREATE POLICY rosters_tenant ON ops.rosters
  USING (property_id IN (SELECT iam.accessible_properties()));

CREATE POLICY attendance_tenant ON ops.attendance_days
  USING (property_id IN (SELECT iam.accessible_properties()));

CREATE POLICY leave_tenant ON hr.leave_requests
  USING (property_id IN (SELECT iam.accessible_properties()));

CREATE POLICY runs_tenant ON payroll.runs
  USING (property_id IN (SELECT iam.accessible_properties()));

-- Salary is the most sensitive data here. A department head can see who is on
-- shift; only payroll roles see what anyone is paid, and everyone can see their
-- own payslip.
CREATE POLICY payslips_own_or_permitted ON payroll.payslips
  USING (
    iam.has_permission('payroll.read')
    OR employee_id = (SELECT employee_id FROM iam.users WHERE id = iam.current_user_id())
  );

-- --- read models -------------------------------------------------------------

-- The staff directory the roster grid and search box read from. Flattens the
-- current contract so the hot path never joins a temporal table.
CREATE VIEW hr.employee_directory AS
SELECT
  e.id,
  e.property_id,
  e.employee_no,
  e.given_name,
  e.fathers_name,
  e.grandfathers_name,
  e.given_name_am,
  e.fathers_name_am,
  concat_ws(' ', e.given_name, e.fathers_name)                         AS display_name,
  concat_ws(' ', e.given_name_am, e.fathers_name_am)                   AS display_name_am,
  e.sex,
  e.phone,
  e.photo_object_key,
  e.status,
  e.hired_on,
  e.probation_ends_on,
  d.id     AS department_id,
  d.name   AS department_name,
  d.name_am AS department_name_am,
  d.code   AS department_code,
  p.id     AS position_id,
  p.title  AS position_title,
  p.title_am AS position_title_am,
  p.grade,
  c.id     AS contract_id,
  c.employment_type,
  c.basic_salary_santim,
  c.weekly_rest_weekday,
  c.weekly_hours,
  -- Completed years of service, which drives annual leave entitlement.
  floor(EXTRACT(EPOCH FROM (now() - e.hired_on::timestamptz)) / 31557600)::int AS years_of_service,
  m.id     AS manager_id,
  concat_ws(' ', m.given_name, m.fathers_name)                         AS manager_name
FROM hr.employees e
LEFT JOIN org.departments d ON d.id = e.department_id
LEFT JOIN org.positions   p ON p.id = e.position_id
LEFT JOIN hr.employment_contracts c ON c.id = e.current_contract_id
LEFT JOIN hr.employees m ON m.id = e.manager_id
WHERE e.archived_at IS NULL;

COMMENT ON VIEW hr.employee_directory IS
  'Read model for rosters, search and the staff directory. Includes basic_salary_santim, so grant it only where salary visibility is intended.';

-- Who is on the premises right now: the digital equivalent of the tag board at
-- the staff entrance. Backs the dashboard header.
CREATE VIEW ops.on_duty_now AS
SELECT
  a.employee_id,
  a.property_id,
  a.work_date,
  a.first_in_at,
  a.state,
  sa.start_minutes,
  sa.end_minutes,
  st.code  AS shift_code,
  st.name  AS shift_name,
  st.colour AS shift_colour,
  d.code   AS department_code,
  d.name   AS department_name
FROM ops.attendance_days a
JOIN hr.employees e ON e.id = a.employee_id
LEFT JOIN ops.shift_assignments sa ON sa.id = a.assignment_id
LEFT JOIN ops.shift_templates st ON st.id = sa.shift_template_id
LEFT JOIN org.departments d ON d.id = e.department_id
WHERE a.first_in_at IS NOT NULL
  AND a.last_out_at IS NULL
  AND a.state IN ('present', 'late');

-- Everything that expires and would otherwise be noticed too late: work permits,
-- food-handler certificates, probation end dates, fixed-term contract endings.
CREATE VIEW hr.upcoming_expiries AS
SELECT e.property_id, e.id AS employee_id,
       concat_ws(' ', e.given_name, e.fathers_name) AS employee_name,
       'work_permit' AS kind, 'Work permit' AS label, e.work_permit_expires_on AS expires_on
FROM hr.employees e
WHERE e.work_permit_expires_on IS NOT NULL AND e.archived_at IS NULL
UNION ALL
SELECT e.property_id, e.id,
       concat_ws(' ', e.given_name, e.fathers_name),
       'probation', 'Probation ends', e.probation_ends_on
FROM hr.employees e
WHERE e.status = 'probation' AND e.probation_ends_on IS NOT NULL AND e.archived_at IS NULL
UNION ALL
SELECT e.property_id, e.id,
       concat_ws(' ', e.given_name, e.fathers_name),
       'certification', c.name, c.expires_on
FROM hr.certifications c
JOIN hr.employees e ON e.id = c.employee_id
WHERE c.expires_on IS NOT NULL AND e.archived_at IS NULL
UNION ALL
SELECT e.property_id, e.id,
       concat_ws(' ', e.given_name, e.fathers_name),
       'contract', 'Fixed-term contract ends', ct.contract_ends_on
FROM hr.employment_contracts ct
JOIN hr.employees e ON e.id = ct.employee_id
WHERE ct.contract_ends_on IS NOT NULL AND ct.effective_to IS NULL AND e.archived_at IS NULL;
