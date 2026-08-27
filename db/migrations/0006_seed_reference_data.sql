-- =============================================================================
-- 0006  Reference data
-- =============================================================================
-- Statutory and structural data that every deployment needs. Idempotent, so it
-- can be re-run after a schema change without duplicating rows.

-- --- permissions -------------------------------------------------------------
INSERT INTO iam.permissions (code, description) VALUES
  ('employee.read',      'View employee records'),
  ('employee.write',     'Create and edit employee records'),
  ('employee.terminate', 'End an employment relationship'),
  ('salary.read',        'View salary figures'),
  ('salary.write',       'Set or change salary'),
  ('roster.read',        'View rosters'),
  ('roster.write',       'Draft and edit rosters'),
  ('roster.publish',     'Publish a roster to staff'),
  ('attendance.read',    'View attendance'),
  ('attendance.correct', 'Correct attendance records'),
  ('overtime.approve',   'Authorise overtime'),
  ('leave.read',         'View leave requests and balances'),
  ('leave.request',      'Submit a leave request'),
  ('leave.approve',      'Approve or reject leave'),
  ('payroll.read',       'View payroll runs and payslips'),
  ('payroll.calculate',  'Run payroll calculation'),
  ('payroll.approve',    'Approve a payroll run for payment'),
  ('discipline.write',   'Record disciplinary action'),
  ('settings.write',     'Change property settings'),
  ('user.manage',        'Manage users and role grants'),
  ('audit.read',         'Read the audit trail')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

-- --- roles -------------------------------------------------------------------
INSERT INTO iam.roles (id, code, name, name_am, description, is_system) VALUES
  ('00000000-0000-4000-8000-000000000001'::uuid, 'group_admin',   'Group administrator', 'የቡድን አስተዳዳሪ',  'Full access across every Noru Booking property', true),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'hr_manager',    'HR manager',          'የሰው ኃይል ሥራ አስኪያጅ', 'Full HR access at one property', true),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'payroll_officer','Payroll officer',    'የደመወዝ ኦፊሰር',    'Prepares payroll; cannot approve it', true),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'finance_approver','Finance approver',  'የፋይናንስ አጽዳቂ',   'Approves payroll for payment; cannot prepare it', true),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'department_head','Department head',    'የክፍል ኃላፊ',      'Rosters and approves leave for one department', true),
  ('00000000-0000-4000-8000-000000000006'::uuid, 'duty_manager',  'Duty manager',        'የተረኛ ሥራ አስኪያጅ', 'Handles attendance and cover during a shift', true),
  ('00000000-0000-4000-8000-000000000007'::uuid, 'employee',      'Employee',            'ሠራተኛ',          'Sees own roster, leave and payslips', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO iam.role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM iam.roles r CROSS JOIN iam.permissions p
WHERE r.code = 'group_admin'
ON CONFLICT DO NOTHING;

INSERT INTO iam.role_permissions (role_id, permission_code)
SELECT r.id, perm_code FROM iam.roles r, unnest(ARRAY[
  'employee.read','employee.write','employee.terminate','salary.read','salary.write',
  'roster.read','roster.write','roster.publish','attendance.read','attendance.correct',
  'overtime.approve','leave.read','leave.approve','discipline.write','settings.write','audit.read'
]) AS perm_code WHERE r.code = 'hr_manager' ON CONFLICT DO NOTHING;

INSERT INTO iam.role_permissions (role_id, permission_code)
SELECT r.id, perm_code FROM iam.roles r, unnest(ARRAY[
  'employee.read','salary.read','attendance.read','payroll.read','payroll.calculate','leave.read'
]) AS perm_code WHERE r.code = 'payroll_officer' ON CONFLICT DO NOTHING;

INSERT INTO iam.role_permissions (role_id, permission_code)
SELECT r.id, perm_code FROM iam.roles r, unnest(ARRAY[
  'employee.read','salary.read','payroll.read','payroll.approve','audit.read'
]) AS perm_code WHERE r.code = 'finance_approver' ON CONFLICT DO NOTHING;

INSERT INTO iam.role_permissions (role_id, permission_code)
SELECT r.id, perm_code FROM iam.roles r, unnest(ARRAY[
  'employee.read','roster.read','roster.write','roster.publish','attendance.read',
  'attendance.correct','overtime.approve','leave.read','leave.approve'
]) AS perm_code WHERE r.code = 'department_head' ON CONFLICT DO NOTHING;

INSERT INTO iam.role_permissions (role_id, permission_code)
SELECT r.id, perm_code FROM iam.roles r, unnest(ARRAY[
  'employee.read','roster.read','attendance.read','attendance.correct','leave.read'
]) AS perm_code WHERE r.code = 'duty_manager' ON CONFLICT DO NOTHING;

INSERT INTO iam.role_permissions (role_id, permission_code)
SELECT r.id, perm_code FROM iam.roles r, unnest(ARRAY['roster.read','leave.request'])
AS perm_code WHERE r.code = 'employee' ON CONFLICT DO NOTHING;

-- --- payroll rule sets -------------------------------------------------------
-- Mirrors packages/core/src/payroll/rules.ts. If you change one, change both;
-- the API asserts they agree at boot.

INSERT INTO payroll.rule_sets (
  id, effective_from, effective_to, legal_basis,
  pension_employee_rate, pension_employer_rate, pension_ceiling_santim, pension_covers_non_residents,
  overtime_day_multiplier, overtime_night_multiplier, overtime_rest_day_multiplier, overtime_holiday_multiplier,
  overtime_max_hours_per_day, overtime_max_hours_per_month, overtime_max_hours_per_year,
  monthly_to_hourly_divisor
) VALUES
  ('et-2016-07', '2016-07-08', '2025-07-06',
   'Federal Income Tax Proclamation No. 979/2016, Schedule A',
   0.0700, 0.1100, NULL, false, 1.50, 1.75, 2.00, 2.50, 2, 20, 100, 208),
  ('et-2025-07', '2025-07-07', NULL,
   'Federal Income Tax (Amendment) Proclamation No. 1395/2025, Schedule A',
   0.0700, 0.1100, NULL, false, 1.50, 1.75, 2.00, 2.50, 2, 20, 100, 208)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payroll.tax_brackets (id, rule_set_id, ordinal, from_santim, to_santim, rate) VALUES
  (gen_random_uuid(), 'et-2025-07', 1,        0,   200000, 0.0000),
  (gen_random_uuid(), 'et-2025-07', 2,   200000,   400000, 0.1500),
  (gen_random_uuid(), 'et-2025-07', 3,   400000,   700000, 0.2000),
  (gen_random_uuid(), 'et-2025-07', 4,   700000,  1000000, 0.2500),
  (gen_random_uuid(), 'et-2025-07', 5,  1000000,  1400000, 0.3000),
  (gen_random_uuid(), 'et-2025-07', 6,  1400000,     NULL, 0.3500),
  (gen_random_uuid(), 'et-2016-07', 1,        0,    60000, 0.0000),
  (gen_random_uuid(), 'et-2016-07', 2,    60000,   165000, 0.1000),
  (gen_random_uuid(), 'et-2016-07', 3,   165000,   320000, 0.1500),
  (gen_random_uuid(), 'et-2016-07', 4,   320000,   525000, 0.2000),
  (gen_random_uuid(), 'et-2016-07', 5,   525000,   780000, 0.2500),
  (gen_random_uuid(), 'et-2016-07', 6,   780000,  1090000, 0.3000),
  (gen_random_uuid(), 'et-2016-07', 7,  1090000,     NULL, 0.3500)
ON CONFLICT (rule_set_id, ordinal) DO NOTHING;

-- --- leave types (national defaults, property_id NULL) -----------------------
INSERT INTO hr.leave_types (id, property_id, code, name, name_am, is_paid, accrues, statutory_days, restricted_to_sex, requires_document, legal_basis) VALUES
  (gen_random_uuid(), NULL, 'ANNUAL',      'Annual leave',      'ዓመታዊ ፈቃድ',    true,  true,  NULL, NULL,     false, 'Proclamation 1156/2019 Art. 77'),
  (gen_random_uuid(), NULL, 'SICK',        'Sick leave',        'የሕመም ፈቃድ',    true,  false, NULL, NULL,     true,  'Proclamation 1156/2019 Arts. 85-86'),
  (gen_random_uuid(), NULL, 'MATERNITY',   'Maternity leave',   'የወሊድ ፈቃድ',    true,  false, 120,  'female', true,  'Proclamation 1156/2019 Art. 88'),
  (gen_random_uuid(), NULL, 'PATERNITY',   'Paternity leave',   'የአባትነት ፈቃድ',  true,  false, 3,    'male',   false, 'Proclamation 1156/2019 Art. 81(4)'),
  (gen_random_uuid(), NULL, 'MARRIAGE',    'Marriage leave',    'የጋብቻ ፈቃድ',    true,  false, 3,    NULL,     false, 'Proclamation 1156/2019 Art. 81(1)(a)'),
  (gen_random_uuid(), NULL, 'BEREAVEMENT', 'Bereavement leave', 'የሐዘን ፈቃድ',    true,  false, 3,    NULL,     false, 'Proclamation 1156/2019 Art. 81(1)(b)'),
  (gen_random_uuid(), NULL, 'UNPAID',      'Unpaid leave',      'ያለክፍያ ፈቃድ',   false, false, NULL, NULL,     false, 'Contractual')
ON CONFLICT DO NOTHING;

-- --- allowance and deduction types ------------------------------------------
INSERT INTO payroll.allowance_types (id, property_id, code, name, name_am, is_taxable, is_pensionable, tax_exempt_cap_santim, legal_basis) VALUES
  (gen_random_uuid(), NULL, 'TRANSPORT',      'Transport allowance',   'የትራንስፖርት አበል', true,  false, 60000, 'Exempt up to the lower of 1/4 of salary or the gazetted cap; verify with MoR'),
  (gen_random_uuid(), NULL, 'HOUSING',        'Housing allowance',     'የቤት አበል',      true,  false, NULL,  NULL),
  (gen_random_uuid(), NULL, 'SERVICE_CHARGE', 'Service charge share',  'የአገልግሎት ክፍያ', true,  false, NULL,  'Pooled service charge distribution'),
  (gen_random_uuid(), NULL, 'SHIFT',          'Night shift allowance', 'የሌሊት ፈረቃ አበል', true,  false, NULL,  NULL),
  (gen_random_uuid(), NULL, 'MEAL',           'Duty meal allowance',   'የምግብ አበል',     false, false, NULL,  'Meals provided on duty at the workplace')
ON CONFLICT DO NOTHING;

INSERT INTO payroll.deduction_types (id, property_id, code, name, name_am, priority) VALUES
  (gen_random_uuid(), NULL, 'COURT_ORDER',  'Court-ordered deduction', 'በፍርድ ቤት ትዕዛዝ',  10),
  (gen_random_uuid(), NULL, 'SALARY_ADVANCE','Salary advance recovery','የደመወዝ ቅድሚያ ተመላሽ', 50),
  (gen_random_uuid(), NULL, 'STAFF_LOAN',   'Staff loan repayment',    'የሠራተኛ ብድር',     60),
  (gen_random_uuid(), NULL, 'UNION_DUES',   'Union dues',              'የማኅበር መዋጮ',     70),
  (gen_random_uuid(), NULL, 'DAMAGE',       'Damage or loss recovery', 'የንብረት ጉዳት',     80)
ON CONFLICT DO NOTHING;
