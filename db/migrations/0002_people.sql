-- =============================================================================
-- 0002  People: employees, contracts, documents, discipline
-- =============================================================================

CREATE TYPE hr.sex AS ENUM ('female', 'male');

CREATE TYPE hr.marital_status AS ENUM ('single', 'married', 'divorced', 'widowed');

CREATE TYPE hr.employment_type AS ENUM (
  'permanent',   -- indefinite contract
  'fixed_term',  -- definite period, Proclamation 1156/2019 Art. 10
  'piece_work',
  'casual',      -- irregular work, common for banqueting
  'seasonal',    -- high season only; Lalibela and Bahir Dar run on these
  'intern'       -- TVET and hotel-school placements
);

CREATE TYPE hr.employment_status AS ENUM (
  'probation', 'active', 'on_leave', 'suspended', 'notice_period', 'terminated'
);

-- --- hr.employees ------------------------------------------------------------
-- NOTE ON NAMES: there is no surname column, and adding one would be a bug.
-- Ethiopian names are given name + father's name + grandfather's name. Payroll
-- and pension filings need all three; rosters and badges use the first two.

CREATE TABLE hr.employees (
  id                    uuid PRIMARY KEY,
  property_id           uuid NOT NULL REFERENCES org.properties(id) ON DELETE RESTRICT,
  employee_no           text NOT NULL,          -- 'NB-ADD-0417', printed on the badge

  given_name            text NOT NULL,
  fathers_name          text NOT NULL,
  grandfathers_name     text,
  given_name_am         text,
  fathers_name_am       text,
  grandfathers_name_am  text,

  sex                   hr.sex NOT NULL,
  date_of_birth         date NOT NULL,
  marital_status        hr.marital_status,
  nationality           text NOT NULL DEFAULT 'ET',   -- ISO 3166-1 alpha-2

  -- Fayda is the national digital ID; kanniya (kebele ID) is still common.
  fayda_number          text,
  kebele_id_number      text,
  tin                   text,                   -- required before first payroll
  pension_number        text,                   -- POESSA membership number
  -- Non-Ethiopian staff need a work permit; expiry drives a renewal reminder
  -- and blocks rostering once lapsed.
  work_permit_number    text,
  work_permit_expires_on date,

  phone                 text NOT NULL,
  alternate_phone       text,
  personal_email        citext,
  photo_object_key      text,                   -- object storage key, not a URL

  region                text,
  city                  text,
  sub_city              text,
  woreda                text,
  house_number          text,

  emergency_contact_name  text,
  emergency_contact_phone text,
  emergency_contact_relation text,

  bank_name             text,
  bank_account_number   text,
  bank_account_name     text,

  -- Denormalised for the roster grid and the staff directory, both of which are
  -- read hundreds of times per shift. Kept in step by trigger from the current
  -- contract; hr.employment_contracts remains the source of truth.
  current_contract_id   uuid,
  department_id         uuid REFERENCES org.departments(id) ON DELETE RESTRICT,
  position_id           uuid REFERENCES org.positions(id) ON DELETE RESTRICT,
  manager_id            uuid REFERENCES hr.employees(id) ON DELETE SET NULL,
  status                hr.employment_status NOT NULL DEFAULT 'probation',

  hired_on              date NOT NULL,
  probation_ends_on     date,
  terminated_on         date,
  termination_reason    text,
  -- Proclamation 1156/2019 Arts. 39-45 distinguish lawful grounds; severance
  -- entitlement depends on which one, so it is an explicit field.
  termination_ground    text,

  notes                 text,
  archived_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES iam.users(id),

  UNIQUE (property_id, employee_no),
  CONSTRAINT employees_tin_format CHECK (tin IS NULL OR tin ~ '^[0-9]{10}$'),
  CONSTRAINT employees_phone_format CHECK (phone ~ '^\+251[0-9]{9}$'),
  CONSTRAINT employees_alt_phone_format
    CHECK (alternate_phone IS NULL OR alternate_phone ~ '^\+251[0-9]{9}$'),
  CONSTRAINT employees_not_own_manager CHECK (id <> manager_id),
  CONSTRAINT employees_termination_coherent CHECK (
    (status = 'terminated') = (terminated_on IS NOT NULL)
  ),
  -- Proclamation 1156/2019 Art. 89: no employment under 15, and 15-18 year-olds
  -- are restricted from night work — which the roster enforces separately.
  CONSTRAINT employees_minimum_age CHECK (date_of_birth <= hired_on - INTERVAL '15 years'),
  CONSTRAINT employees_expat_needs_permit CHECK (
    nationality = 'ET' OR work_permit_number IS NOT NULL
  )
);

CREATE INDEX employees_property_status_idx
  ON hr.employees (property_id, status) WHERE archived_at IS NULL;
CREATE INDEX employees_department_idx
  ON hr.employees (department_id) WHERE archived_at IS NULL;
CREATE INDEX employees_manager_idx ON hr.employees (manager_id);
CREATE UNIQUE INDEX employees_tin_idx ON hr.employees (tin) WHERE tin IS NOT NULL;
CREATE UNIQUE INDEX employees_fayda_idx ON hr.employees (fayda_number) WHERE fayda_number IS NOT NULL;

-- Directory search across both scripts. Amharic needs its own vector because
-- the default text search configuration does not stem Ge'ez.
CREATE INDEX employees_search_idx ON hr.employees USING gin (
  to_tsvector('simple',
    coalesce(given_name,'') || ' ' || coalesce(fathers_name,'') || ' ' ||
    coalesce(grandfathers_name,'') || ' ' || coalesce(given_name_am,'') || ' ' ||
    coalesce(fathers_name_am,'') || ' ' || coalesce(employee_no,''))
);

CREATE TRIGGER employees_updated_at BEFORE UPDATE ON hr.employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE iam.users
  ADD CONSTRAINT users_employee_fk FOREIGN KEY (employee_id)
  REFERENCES hr.employees(id) ON DELETE SET NULL;

ALTER TABLE org.departments
  ADD CONSTRAINT departments_head_fk FOREIGN KEY (head_employee_id)
  REFERENCES hr.employees(id) ON DELETE SET NULL;

-- --- hr.employment_contracts -------------------------------------------------
-- Every change to pay, position or hours creates a new row. Nothing is ever
-- edited in place, because "what was this person earning in Sene 2017?" must be
-- answerable years later, and because a raise is a fact with a date.

CREATE TABLE hr.employment_contracts (
  id                    uuid PRIMARY KEY,
  employee_id           uuid NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  property_id           uuid NOT NULL REFERENCES org.properties(id) ON DELETE RESTRICT,
  position_id           uuid NOT NULL REFERENCES org.positions(id) ON DELETE RESTRICT,
  department_id         uuid NOT NULL REFERENCES org.departments(id) ON DELETE RESTRICT,
  employment_type       hr.employment_type NOT NULL,

  effective_from        date NOT NULL,
  effective_to          date,                   -- null = current
  -- Fixed-term contracts must state their end; indefinite ones must not.
  contract_ends_on      date,

  basic_salary_santim   bigint NOT NULL CHECK (basic_salary_santim >= 0),
  -- Contracted hours per week. Statutory maximum is 48 (Art. 61).
  weekly_hours          numeric(4,1) NOT NULL DEFAULT 48 CHECK (weekly_hours > 0 AND weekly_hours <= 48),
  weekly_rest_weekday   smallint NOT NULL CHECK (weekly_rest_weekday BETWEEN 0 AND 6),
  -- Contractual leave above the statutory 16 days.
  annual_leave_bonus_days smallint NOT NULL DEFAULT 0 CHECK (annual_leave_bonus_days >= 0),
  shares_service_charge boolean NOT NULL DEFAULT false,

  change_reason         text NOT NULL,          -- 'hired', 'promotion', 'annual_increment', 'transfer'
  signed_on             date,
  document_object_key   text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES iam.users(id),

  CONSTRAINT contracts_period_ordered CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT contracts_fixed_term_has_end CHECK (
    (employment_type <> 'fixed_term') OR (contract_ends_on IS NOT NULL)
  ),
  -- One contract may be in force at a time. Postgres enforces this rather than
  -- application code, because overlapping contracts would double-pay someone.
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_from, effective_to, '[)') WITH &&
  )
);

CREATE INDEX contracts_employee_idx ON hr.employment_contracts (employee_id, effective_from DESC);
CREATE INDEX contracts_current_idx ON hr.employment_contracts (property_id)
  WHERE effective_to IS NULL;

ALTER TABLE hr.employees
  ADD CONSTRAINT employees_current_contract_fk FOREIGN KEY (current_contract_id)
  REFERENCES hr.employment_contracts(id) ON DELETE SET NULL;

COMMENT ON TABLE hr.employment_contracts IS
  'Temporal record of employment terms. Insert-only: correct a mistake by superseding the row, never by updating it.';

-- --- hr.employee_documents ---------------------------------------------------

CREATE TYPE hr.document_kind AS ENUM (
  'contract', 'id_copy', 'cv', 'certificate', 'work_permit', 'medical',
  'police_clearance', 'warning_letter', 'termination_letter', 'other'
);

CREATE TABLE hr.employee_documents (
  id           uuid PRIMARY KEY,
  employee_id  uuid NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  kind         hr.document_kind NOT NULL,
  title        text NOT NULL,
  object_key   text NOT NULL,        -- S3-compatible key; files never live in Postgres
  content_type text NOT NULL,
  size_bytes   bigint NOT NULL CHECK (size_bytes > 0),
  issued_on    date,
  expires_on   date,                 -- drives the expiry dashboard
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  uploaded_by  uuid REFERENCES iam.users(id),
  archived_at  timestamptz
);

CREATE INDEX employee_documents_employee_idx ON hr.employee_documents (employee_id, kind);
CREATE INDEX employee_documents_expiring_idx ON hr.employee_documents (expires_on)
  WHERE expires_on IS NOT NULL AND archived_at IS NULL;

-- --- hr.certifications -------------------------------------------------------
-- Food handling, first aid, pool lifeguard, fire marshal. A lapsed certificate
-- is a rostering blocker, not a reminder, for positions that legally require it.

CREATE TABLE hr.certifications (
  id             uuid PRIMARY KEY,
  employee_id    uuid NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  code           text NOT NULL,       -- 'FOOD_HANDLER', 'FIRST_AID', 'FIRE_MARSHAL'
  name           text NOT NULL,
  issuing_body   text,
  issued_on      date NOT NULL,
  expires_on     date,
  document_id    uuid REFERENCES hr.employee_documents(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, code, issued_on)
);

CREATE INDEX certifications_expiry_idx ON hr.certifications (expires_on)
  WHERE expires_on IS NOT NULL;

-- --- hr.disciplinary_actions -------------------------------------------------
-- Ethiopian dismissal law is procedural: a valid termination for misconduct
-- usually needs a documented warning history. Recording it loosely is how
-- hotels lose cases at the labour court.

CREATE TYPE hr.disciplinary_measure AS ENUM (
  'verbal_warning', 'written_warning', 'final_warning', 'suspension',
  'demotion', 'dismissal'
);

CREATE TABLE hr.disciplinary_actions (
  id               uuid PRIMARY KEY,
  employee_id      uuid NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  measure          hr.disciplinary_measure NOT NULL,
  incident_on      date NOT NULL,
  issued_on        date NOT NULL,
  summary          text NOT NULL,
  legal_basis      text,             -- article of the proclamation or work rules
  suspension_days  smallint CHECK (suspension_days IS NULL OR suspension_days > 0),
  -- Warnings expire; a written warning from three years ago should not be
  -- counted toward a dismissal decision today.
  expires_on       date,
  employee_response text,
  acknowledged_at  timestamptz,
  document_id      uuid REFERENCES hr.employee_documents(id) ON DELETE SET NULL,
  issued_by        uuid REFERENCES iam.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disciplinary_dates_ordered CHECK (issued_on >= incident_on)
);

CREATE INDEX disciplinary_employee_idx ON hr.disciplinary_actions (employee_id, issued_on DESC);
