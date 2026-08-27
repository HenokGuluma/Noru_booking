-- =============================================================================
-- 0004  Payroll: versioned statutory rules, runs, payslips, bank files
-- =============================================================================

-- --- payroll.rule_sets -------------------------------------------------------
-- Statutory rates are versioned data, never constants. Ethiopia rewrote its
-- employment income tax bands in July 2025 (Proclamation 1395/2025) and will do
-- so again. A payslip issued in Sene 2017 must remain reproducible with the
-- bands that applied then, so a run pins the rule set it used and that row is
-- never edited afterwards.

CREATE TABLE payroll.rule_sets (
  id                      text PRIMARY KEY,       -- 'et-2025-07'
  effective_from          date NOT NULL,
  effective_to            date,
  legal_basis             text NOT NULL,
  pension_employee_rate   numeric(5,4) NOT NULL CHECK (pension_employee_rate BETWEEN 0 AND 1),
  pension_employer_rate   numeric(5,4) NOT NULL CHECK (pension_employer_rate BETWEEN 0 AND 1),
  pension_ceiling_santim  bigint,                 -- null = uncapped, as in Ethiopia
  pension_covers_non_residents boolean NOT NULL DEFAULT false,
  overtime_day_multiplier      numeric(4,2) NOT NULL,
  overtime_night_multiplier    numeric(4,2) NOT NULL,
  overtime_rest_day_multiplier numeric(4,2) NOT NULL,
  overtime_holiday_multiplier  numeric(4,2) NOT NULL,
  overtime_max_hours_per_day   smallint NOT NULL,
  overtime_max_hours_per_month smallint NOT NULL,
  overtime_max_hours_per_year  smallint NOT NULL,
  monthly_to_hourly_divisor    numeric(6,2) NOT NULL CHECK (monthly_to_hourly_divisor > 0),
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rule_sets_period_ordered CHECK (effective_to IS NULL OR effective_to > effective_from),
  -- Exactly one rule set may be in force on any given day.
  EXCLUDE USING gist (daterange(effective_from, effective_to, '[]') WITH &&)
);

CREATE TABLE payroll.tax_brackets (
  id            uuid PRIMARY KEY,
  rule_set_id   text NOT NULL REFERENCES payroll.rule_sets(id) ON DELETE CASCADE,
  ordinal       smallint NOT NULL,
  from_santim   bigint NOT NULL CHECK (from_santim >= 0),
  to_santim     bigint,                       -- null = top band
  rate          numeric(5,4) NOT NULL CHECK (rate BETWEEN 0 AND 1),
  UNIQUE (rule_set_id, ordinal),
  CONSTRAINT tax_brackets_ordered CHECK (to_santim IS NULL OR to_santim > from_santim)
);

COMMENT ON TABLE payroll.tax_brackets IS
  'Marginal PAYE bands. Verify against mor.gov.et before each Ethiopian fiscal year.';

-- --- payroll.allowance_types / deduction_types -------------------------------
-- Taxability is a property of the allowance, not a hard-coded rule. Transport
-- allowance is exempt up to a statutory cap; service charge is fully taxable but
-- not pensionable. Getting these flags right is most of Ethiopian payroll.

CREATE TABLE payroll.allowance_types (
  id                uuid PRIMARY KEY,
  property_id       uuid REFERENCES org.properties(id) ON DELETE CASCADE,
  code              text NOT NULL,
  name              text NOT NULL,
  name_am           text,
  is_taxable        boolean NOT NULL,
  is_pensionable    boolean NOT NULL DEFAULT false,
  -- Exempt only up to this amount per month; the excess is taxable.
  tax_exempt_cap_santim bigint CHECK (tax_exempt_cap_santim IS NULL OR tax_exempt_cap_santim >= 0),
  legal_basis       text,
  archived_at       timestamptz
);

CREATE UNIQUE INDEX allowance_types_unique_idx ON payroll.allowance_types (
  COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid), code
);

CREATE TABLE payroll.deduction_types (
  id           uuid PRIMARY KEY,
  property_id  uuid REFERENCES org.properties(id) ON DELETE CASCADE,
  code         text NOT NULL,
  name         text NOT NULL,
  name_am      text,
  -- Court orders and pension outrank staff-loan recovery when net pay is short.
  priority     smallint NOT NULL DEFAULT 100,
  archived_at  timestamptz
);

CREATE UNIQUE INDEX deduction_types_unique_idx ON payroll.deduction_types (
  COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid), code
);

-- Recurring allowances attached to a person, with their own validity window so
-- a housing allowance can start in Tir and stop in Sene without losing history.
CREATE TABLE payroll.employee_allowances (
  id                uuid PRIMARY KEY,
  employee_id       uuid NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  allowance_type_id uuid NOT NULL REFERENCES payroll.allowance_types(id) ON DELETE RESTRICT,
  amount_santim     bigint NOT NULL CHECK (amount_santim >= 0),
  effective_from    date NOT NULL,
  effective_to      date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES iam.users(id),
  EXCLUDE USING gist (
    employee_id WITH =,
    allowance_type_id WITH =,
    daterange(effective_from, effective_to, '[)') WITH &&
  )
);

-- Salary advances and staff loans, recovered across periods.
CREATE TABLE payroll.employee_deductions (
  id                 uuid PRIMARY KEY,
  employee_id        uuid NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  deduction_type_id  uuid NOT NULL REFERENCES payroll.deduction_types(id) ON DELETE RESTRICT,
  total_santim       bigint NOT NULL CHECK (total_santim > 0),
  instalment_santim  bigint NOT NULL CHECK (instalment_santim > 0),
  recovered_santim   bigint NOT NULL DEFAULT 0 CHECK (recovered_santim >= 0),
  starts_on          date NOT NULL,
  reference          text,
  settled_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES iam.users(id),
  CONSTRAINT deductions_not_over_recovered CHECK (recovered_santim <= total_santim)
);

CREATE INDEX employee_deductions_open_idx ON payroll.employee_deductions (employee_id)
  WHERE settled_at IS NULL;

-- --- payroll.runs ------------------------------------------------------------
-- A run is a state machine: draft -> calculated -> approved -> paid. Approval is
-- a separate act by a separate person from calculation, which is the control
-- that stops one clerk from both inventing and paying a salary.

CREATE TYPE payroll.run_status AS ENUM (
  'draft', 'calculating', 'calculated', 'approved', 'paid', 'cancelled'
);

CREATE TABLE payroll.runs (
  id                  uuid PRIMARY KEY,
  property_id         uuid NOT NULL REFERENCES org.properties(id) ON DELETE RESTRICT,
  rule_set_id         text NOT NULL REFERENCES payroll.rule_sets(id) ON DELETE RESTRICT,
  period_start        date NOT NULL,
  period_end          date NOT NULL,
  -- The Ethiopian month this run pays, which is what the payslip and the MoR
  -- declaration are labelled with.
  ethiopian_year      smallint NOT NULL,
  ethiopian_month     smallint NOT NULL CHECK (ethiopian_month BETWEEN 1 AND 13),
  working_days        smallint NOT NULL CHECK (working_days > 0),
  status              payroll.run_status NOT NULL DEFAULT 'draft',

  headcount           integer NOT NULL DEFAULT 0,
  gross_santim            bigint NOT NULL DEFAULT 0,
  paye_santim             bigint NOT NULL DEFAULT 0,
  employee_pension_santim bigint NOT NULL DEFAULT 0,
  employer_pension_santim bigint NOT NULL DEFAULT 0,
  other_deductions_santim bigint NOT NULL DEFAULT 0,
  net_pay_santim          bigint NOT NULL DEFAULT 0,
  employer_cost_santim    bigint NOT NULL DEFAULT 0,

  calculated_at       timestamptz,
  calculated_by       uuid REFERENCES iam.users(id),
  approved_at         timestamptz,
  approved_by         uuid REFERENCES iam.users(id),
  paid_at             timestamptz,
  payment_reference   text,
  cancelled_at        timestamptz,
  cancellation_reason text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, ethiopian_year, ethiopian_month),
  CONSTRAINT runs_period_ordered CHECK (period_end >= period_start),
  CONSTRAINT runs_approved_has_actor CHECK (
    (status NOT IN ('approved','paid')) OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  -- Segregation of duties: whoever calculates a run cannot be the one to
  -- approve it. Enforced here so no future code path can bypass it.
  CONSTRAINT runs_four_eyes CHECK (approved_by IS NULL OR approved_by <> calculated_by)
);

CREATE INDEX runs_property_period_idx ON payroll.runs (property_id, period_end DESC);
CREATE TRIGGER runs_updated_at BEFORE UPDATE ON payroll.runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- payroll.payslips --------------------------------------------------------
-- Every figure that appears on the payslip is stored, including ones that could
-- be recomputed. A payslip is a statement issued to a person on a date; it must
-- still render the same next year even if a rate, a name or a rule has changed.

CREATE TABLE payroll.payslips (
  id                      uuid PRIMARY KEY,
  run_id                  uuid NOT NULL REFERENCES payroll.runs(id) ON DELETE CASCADE,
  employee_id             uuid NOT NULL REFERENCES hr.employees(id) ON DELETE RESTRICT,
  contract_id             uuid REFERENCES hr.employment_contracts(id) ON DELETE SET NULL,

  -- Snapshot of identity at the time of payment, for the archived PDF.
  employee_no             text NOT NULL,
  legal_name              text NOT NULL,
  tin                     text,
  pension_number          text,
  position_title          text NOT NULL,
  department_name         text NOT NULL,

  basic_salary_santim     bigint NOT NULL,
  prorated_basic_santim   bigint NOT NULL,
  unpaid_absence_days     numeric(4,1) NOT NULL DEFAULT 0,
  allowances_santim       bigint NOT NULL DEFAULT 0,
  overtime_santim         bigint NOT NULL DEFAULT 0,
  gross_santim            bigint NOT NULL,
  taxable_gross_santim    bigint NOT NULL,
  paye_santim             bigint NOT NULL,
  employee_pension_santim bigint NOT NULL,
  employer_pension_santim bigint NOT NULL,
  other_deductions_santim bigint NOT NULL DEFAULT 0,
  total_deductions_santim bigint NOT NULL,
  net_pay_santim          bigint NOT NULL,
  employer_cost_santim    bigint NOT NULL,

  overtime_day_hours      numeric(6,2) NOT NULL DEFAULT 0,
  overtime_night_hours    numeric(6,2) NOT NULL DEFAULT 0,
  overtime_rest_day_hours numeric(6,2) NOT NULL DEFAULT 0,
  overtime_holiday_hours  numeric(6,2) NOT NULL DEFAULT 0,

  bank_name               text,
  bank_account_number     text,

  -- Per-band tax working and the individual earning/deduction lines, kept as
  -- JSONB because their shape is defined by the rule set, not by this schema.
  tax_bands               jsonb NOT NULL DEFAULT '[]'::jsonb,
  earning_lines           jsonb NOT NULL DEFAULT '[]'::jsonb,
  deduction_lines         jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings                text[] NOT NULL DEFAULT '{}',

  document_object_key     text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, employee_id),
  CONSTRAINT payslips_balances CHECK (
    net_pay_santim = gross_santim - total_deductions_santim
  )
);

CREATE INDEX payslips_employee_idx ON payroll.payslips (employee_id, created_at DESC);
CREATE INDEX payslips_run_idx ON payroll.payslips (run_id);

COMMENT ON CONSTRAINT payslips_balances ON payroll.payslips IS
  'A payslip that does not balance is a bug that must never reach an employee.';

-- --- payroll.bank_transfers --------------------------------------------------
-- Ethiopian salary payment is overwhelmingly a bulk transfer file handed to
-- CBE, Awash, Dashen or Abyssinia. Cash still happens for casual banqueting
-- staff, so the payment method is per payslip.

CREATE TYPE payroll.payment_method AS ENUM ('bank_transfer', 'cash', 'mobile_money');

CREATE TABLE payroll.payment_batches (
  id              uuid PRIMARY KEY,
  run_id          uuid NOT NULL REFERENCES payroll.runs(id) ON DELETE CASCADE,
  method          payroll.payment_method NOT NULL,
  bank_name       text,
  file_object_key text,
  total_santim    bigint NOT NULL,
  item_count      integer NOT NULL,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  generated_by    uuid REFERENCES iam.users(id),
  confirmed_at    timestamptz,
  confirmation_reference text
);

CREATE INDEX payment_batches_run_idx ON payroll.payment_batches (run_id);

-- --- payroll.statutory_filings -----------------------------------------------
-- PAYE and pension are both remitted by the 8th of the following month. Missing
-- that date attracts penalties, so the deadline is a tracked object.

CREATE TABLE payroll.statutory_filings (
  id            uuid PRIMARY KEY,
  run_id        uuid NOT NULL REFERENCES payroll.runs(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('paye', 'pension')),
  authority     text NOT NULL,        -- 'Ministry of Revenues', 'POESSA'
  amount_santim bigint NOT NULL,
  due_on        date NOT NULL,
  filed_on      date,
  reference     text,
  receipt_object_key text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, kind)
);

CREATE INDEX statutory_filings_due_idx ON payroll.statutory_filings (due_on)
  WHERE filed_on IS NULL;
