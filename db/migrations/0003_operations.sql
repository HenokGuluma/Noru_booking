-- =============================================================================
-- 0003  Operations: holidays, shift templates, rosters, attendance, leave
-- =============================================================================

-- --- ops.public_holidays -----------------------------------------------------
-- A table, not a constant. Orthodox feasts move with the Ethiopian calendar,
-- Muslim feasts are gazetted only after the moon is sighted, and hours worked on
-- a gazetted holiday are paid at 2.5x — so an unconfirmed holiday must block the
-- roster from being published, not silently default to a normal day.

CREATE TYPE ops.holiday_tradition AS ENUM ('national', 'orthodox', 'muslim');

CREATE TABLE ops.public_holidays (
  id           uuid PRIMARY KEY,
  -- Null property_id = observed nationwide. A property may add local ones
  -- (a regional saint's day that closes the town it operates in).
  property_id  uuid REFERENCES org.properties(id) ON DELETE CASCADE,
  code         text NOT NULL,
  name         text NOT NULL,
  name_am      text,
  tradition    ops.holiday_tradition NOT NULL,
  observed_on  date NOT NULL,
  ethiopian_year  smallint NOT NULL,
  ethiopian_month smallint NOT NULL CHECK (ethiopian_month BETWEEN 1 AND 13),
  ethiopian_day   smallint NOT NULL CHECK (ethiopian_day BETWEEN 1 AND 30),
  -- Lunar holidays start life provisional and are confirmed once gazetted.
  confirmed_at timestamptz,
  is_paid      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Nationwide holidays have a NULL property_id, and Postgres treats NULLs as
-- distinct, so the scope is coalesced to a sentinel to keep the row unique.
CREATE UNIQUE INDEX public_holidays_unique_idx ON ops.public_holidays (
  COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid), code, observed_on
);

CREATE INDEX public_holidays_date_idx ON ops.public_holidays (observed_on);

-- --- ops.shift_templates -----------------------------------------------------

CREATE TABLE ops.shift_templates (
  id                uuid PRIMARY KEY,
  property_id       uuid NOT NULL REFERENCES org.properties(id) ON DELETE CASCADE,
  department_id     uuid REFERENCES org.departments(id) ON DELETE CASCADE,
  code              text NOT NULL,          -- 'AM', 'PM', 'NIGHT', 'SPLIT-AM'
  name              text NOT NULL,
  name_am           text,
  -- Minutes from local midnight. `end_minutes` may exceed 1440 for a shift that
  -- crosses midnight: the 22:00-06:00 night audit is 1320 to 1800.
  start_minutes     smallint NOT NULL CHECK (start_minutes BETWEEN 0 AND 1439),
  end_minutes       smallint NOT NULL CHECK (end_minutes > 0 AND end_minutes <= 2880),
  unpaid_break_minutes smallint NOT NULL DEFAULT 0 CHECK (unpaid_break_minutes >= 0),
  -- Rendered on the roster grid; also the legend colour in the printed roster
  -- pinned up in the back office.
  colour            text NOT NULL DEFAULT '#0E6A5A',
  is_night          boolean NOT NULL DEFAULT false,
  archived_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, code),
  CONSTRAINT shift_templates_ordered CHECK (end_minutes > start_minutes)
);

-- Minimum cover per department, shift and weekday. Housekeeping needs more
-- attendants on a Saturday checkout day than on a Tuesday.
CREATE TABLE ops.coverage_requirements (
  id                uuid PRIMARY KEY,
  property_id       uuid NOT NULL REFERENCES org.properties(id) ON DELETE CASCADE,
  department_id     uuid NOT NULL REFERENCES org.departments(id) ON DELETE CASCADE,
  shift_template_id uuid NOT NULL REFERENCES ops.shift_templates(id) ON DELETE CASCADE,
  weekday           smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  minimum_staff     smallint NOT NULL CHECK (minimum_staff >= 0),
  -- Optional occupancy trigger: "if the house is over 70% full, add one".
  occupancy_threshold_pct smallint CHECK (occupancy_threshold_pct BETWEEN 0 AND 100),
  additional_staff  smallint NOT NULL DEFAULT 0 CHECK (additional_staff >= 0),
  UNIQUE (department_id, shift_template_id, weekday)
);

-- --- ops.rosters -------------------------------------------------------------
-- A roster is a weekly, department-scoped document with a lifecycle. Publishing
-- is the moment it becomes a promise to staff, so it is a state change with an
-- actor and a timestamp, not a boolean.

CREATE TYPE ops.roster_status AS ENUM ('draft', 'in_review', 'published', 'archived');

CREATE TABLE ops.rosters (
  id            uuid PRIMARY KEY,
  property_id   uuid NOT NULL REFERENCES org.properties(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES org.departments(id) ON DELETE CASCADE,
  week_start    date NOT NULL,           -- always a Monday
  status        ops.roster_status NOT NULL DEFAULT 'draft',
  published_at  timestamptz,
  published_by  uuid REFERENCES iam.users(id),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES iam.users(id),
  UNIQUE (department_id, week_start),
  CONSTRAINT rosters_week_starts_monday CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  CONSTRAINT rosters_published_has_actor CHECK (
    (status <> 'published') OR (published_at IS NOT NULL AND published_by IS NOT NULL)
  )
);

CREATE TRIGGER rosters_updated_at BEFORE UPDATE ON ops.rosters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TYPE ops.assignment_status AS ENUM (
  'scheduled', 'confirmed', 'swap_requested', 'swapped', 'cancelled'
);

CREATE TABLE ops.shift_assignments (
  id                uuid PRIMARY KEY,
  roster_id         uuid NOT NULL REFERENCES ops.rosters(id) ON DELETE CASCADE,
  employee_id       uuid NOT NULL REFERENCES hr.employees(id) ON DELETE RESTRICT,
  shift_template_id uuid REFERENCES ops.shift_templates(id) ON DELETE SET NULL,
  work_date         date NOT NULL,
  -- Copied from the template at assignment time so that editing a template
  -- never rewrites a roster that staff have already read and planned around.
  start_minutes     smallint NOT NULL CHECK (start_minutes BETWEEN 0 AND 1439),
  end_minutes       smallint NOT NULL CHECK (end_minutes > 0 AND end_minutes <= 2880),
  unpaid_break_minutes smallint NOT NULL DEFAULT 0,
  status            ops.assignment_status NOT NULL DEFAULT 'scheduled',
  -- Local wall-clock span, generated so overlap detection works across midnight.
  -- Deliberately `timestamp` and not `timestamptz`: generated columns must be
  -- IMMUTABLE, and `AT TIME ZONE` is only STABLE. Ethiopia is UTC+3 all year
  -- with no daylight saving, so local wall-clock arithmetic is exact and total
  -- ordering is preserved. Conversion to an instant happens in the API layer.
  local_starts_at   timestamp GENERATED ALWAYS AS (
    work_date::timestamp + (start_minutes::int * INTERVAL '1 minute')
  ) STORED,
  local_ends_at     timestamp GENERATED ALWAYS AS (
    work_date::timestamp + (end_minutes::int * INTERVAL '1 minute')
  ) STORED,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignments_ordered CHECK (end_minutes > start_minutes),
  -- No one can be in two places at once. The database says so, so no race
  -- between two managers editing adjacent rosters can produce a double-booking.
  EXCLUDE USING gist (
    employee_id WITH =,
    tsrange(
      work_date::timestamp + (start_minutes::int * INTERVAL '1 minute'),
      work_date::timestamp + (end_minutes::int * INTERVAL '1 minute'),
      '[)'
    ) WITH &&
  ) WHERE (status <> 'cancelled')
);

CREATE INDEX assignments_roster_idx ON ops.shift_assignments (roster_id, work_date);
CREATE INDEX assignments_employee_date_idx ON ops.shift_assignments (employee_id, work_date);
CREATE TRIGGER assignments_updated_at BEFORE UPDATE ON ops.shift_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Shift swaps between colleagues, which happen constantly in hotels and are
-- otherwise negotiated over WhatsApp and lost.
CREATE TABLE ops.shift_swap_requests (
  id                  uuid PRIMARY KEY,
  assignment_id       uuid NOT NULL REFERENCES ops.shift_assignments(id) ON DELETE CASCADE,
  requested_by        uuid NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  offered_to          uuid REFERENCES hr.employees(id) ON DELETE CASCADE,
  counterpart_assignment_id uuid REFERENCES ops.shift_assignments(id) ON DELETE SET NULL,
  reason              text,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','accepted','declined','approved','rejected','withdrawn')),
  accepted_at         timestamptz,
  decided_by          uuid REFERENCES iam.users(id),
  decided_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX swap_requests_status_idx ON ops.shift_swap_requests (status, created_at DESC);

-- --- ops.attendance ----------------------------------------------------------
-- Two-layer design. `punches` is an append-only log of raw events from clocks,
-- phones and supervisors; `attendance_days` is the reconciled daily record that
-- payroll reads. Raw punches are never edited — a correction is a new punch with
-- a supervisor's justification, which is what makes a wage dispute resolvable.

CREATE TYPE ops.punch_direction AS ENUM ('in', 'out', 'break_start', 'break_end');
CREATE TYPE ops.punch_source AS ENUM ('biometric', 'kiosk', 'mobile', 'web', 'supervisor', 'import');

CREATE TABLE ops.punches (
  id              uuid PRIMARY KEY,
  property_id     uuid NOT NULL REFERENCES org.properties(id) ON DELETE RESTRICT,
  employee_id     uuid NOT NULL REFERENCES hr.employees(id) ON DELETE RESTRICT,
  direction       ops.punch_direction NOT NULL,
  punched_at      timestamptz NOT NULL,
  source          ops.punch_source NOT NULL,
  device_id       text,
  -- Mobile punches carry a location so a room attendant cannot clock in from home.
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  accuracy_metres numeric(6,1),
  -- Set when this punch corrects an earlier one; the original stays in place.
  corrects_punch_id uuid REFERENCES ops.punches(id),
  justification   text,
  recorded_by     uuid REFERENCES iam.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT punches_manual_needs_justification CHECK (
    source <> 'supervisor' OR justification IS NOT NULL
  )
);

CREATE INDEX punches_employee_time_idx ON ops.punches (employee_id, punched_at DESC);
CREATE INDEX punches_property_time_idx ON ops.punches (property_id, punched_at DESC);
REVOKE UPDATE, DELETE ON ops.punches FROM PUBLIC;

CREATE TYPE ops.attendance_state AS ENUM (
  'present', 'late', 'absent', 'on_leave', 'rest_day', 'holiday', 'incomplete'
);

CREATE TABLE ops.attendance_days (
  id                  uuid PRIMARY KEY,
  property_id         uuid NOT NULL REFERENCES org.properties(id) ON DELETE RESTRICT,
  employee_id         uuid NOT NULL REFERENCES hr.employees(id) ON DELETE RESTRICT,
  work_date           date NOT NULL,
  assignment_id       uuid REFERENCES ops.shift_assignments(id) ON DELETE SET NULL,
  state               ops.attendance_state NOT NULL,
  first_in_at         timestamptz,
  last_out_at         timestamptz,
  break_minutes       smallint NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  worked_minutes      integer NOT NULL DEFAULT 0 CHECK (worked_minutes >= 0),
  late_minutes        integer NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  early_leave_minutes integer NOT NULL DEFAULT 0 CHECK (early_leave_minutes >= 0),

  -- Overtime split into its statutory buckets at reconciliation time, because
  -- the split depends on the roster and holiday calendar as they were that day.
  overtime_day_minutes           integer NOT NULL DEFAULT 0 CHECK (overtime_day_minutes >= 0),
  overtime_night_minutes         integer NOT NULL DEFAULT 0 CHECK (overtime_night_minutes >= 0),
  overtime_rest_day_minutes      integer NOT NULL DEFAULT 0 CHECK (overtime_rest_day_minutes >= 0),
  overtime_holiday_minutes       integer NOT NULL DEFAULT 0 CHECK (overtime_holiday_minutes >= 0),

  -- Overtime must be authorised before it is paid (Art. 67); this is the record
  -- that it was, and by whom.
  overtime_approved_by uuid REFERENCES iam.users(id),
  overtime_approved_at timestamptz,

  -- Frozen once the period is paid. Payroll reads only locked days, so a late
  -- edit cannot silently change a payslip that has already been issued.
  locked_at           timestamptz,
  reconciled_at       timestamptz NOT NULL DEFAULT now(),
  notes               text,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date),
  -- A locked day carrying overtime must name who authorised it. Unlocked days
  -- may hold unapproved overtime: that is exactly the reconciliation queue.
  CONSTRAINT attendance_locked_overtime_is_approved CHECK (
    locked_at IS NULL
    OR overtime_day_minutes + overtime_night_minutes +
       overtime_rest_day_minutes + overtime_holiday_minutes = 0
    OR overtime_approved_by IS NOT NULL
  )
);

CREATE INDEX attendance_property_date_idx ON ops.attendance_days (property_id, work_date);
CREATE INDEX attendance_employee_date_idx ON ops.attendance_days (employee_id, work_date DESC);
CREATE INDEX attendance_unlocked_idx ON ops.attendance_days (property_id, work_date)
  WHERE locked_at IS NULL;
CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON ops.attendance_days
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- hr.leave ----------------------------------------------------------------

CREATE TABLE hr.leave_types (
  id                uuid PRIMARY KEY,
  property_id       uuid REFERENCES org.properties(id) ON DELETE CASCADE,
  code              text NOT NULL,
  name              text NOT NULL,
  name_am           text,
  is_paid           boolean NOT NULL,
  accrues           boolean NOT NULL DEFAULT false,
  statutory_days    smallint,
  restricted_to_sex hr.sex,
  requires_document boolean NOT NULL DEFAULT false,
  legal_basis       text,
  archived_at       timestamptz
);

CREATE UNIQUE INDEX leave_types_unique_idx ON hr.leave_types (
  COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid), code
);

-- Balances are held per Ethiopian fiscal year (Hamle 1 - Sene 30), because that
-- is the year Ethiopian employment contracts and payroll declarations run on.
CREATE TABLE hr.leave_balances (
  id                 uuid PRIMARY KEY,
  employee_id        uuid NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  leave_type_id      uuid NOT NULL REFERENCES hr.leave_types(id) ON DELETE RESTRICT,
  ethiopian_year     smallint NOT NULL,
  entitled_days      numeric(5,1) NOT NULL DEFAULT 0 CHECK (entitled_days >= 0),
  carried_over_days  numeric(5,1) NOT NULL DEFAULT 0 CHECK (carried_over_days >= 0),
  taken_days         numeric(5,1) NOT NULL DEFAULT 0 CHECK (taken_days >= 0),
  pending_days       numeric(5,1) NOT NULL DEFAULT 0 CHECK (pending_days >= 0),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_id, ethiopian_year)
);

CREATE TRIGGER leave_balances_updated_at BEFORE UPDATE ON hr.leave_balances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TYPE hr.leave_status AS ENUM (
  'draft', 'pending', 'approved', 'rejected', 'cancelled', 'taken'
);

CREATE TABLE hr.leave_requests (
  id                uuid PRIMARY KEY,
  employee_id       uuid NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  property_id       uuid NOT NULL REFERENCES org.properties(id) ON DELETE RESTRICT,
  leave_type_id     uuid NOT NULL REFERENCES hr.leave_types(id) ON DELETE RESTRICT,
  starts_on         date NOT NULL,
  ends_on           date NOT NULL,
  -- Counted in working days against this employee's own roster, so a rest day
  -- inside a leave period is not spent from the balance.
  working_days      numeric(5,1) NOT NULL CHECK (working_days > 0),
  reason            text,
  status            hr.leave_status NOT NULL DEFAULT 'pending',
  document_id       uuid REFERENCES hr.employee_documents(id) ON DELETE SET NULL,
  decided_by        uuid REFERENCES iam.users(id),
  decided_at        timestamptz,
  decision_note     text,
  -- Which balance year the days were drawn from.
  ethiopian_year    smallint NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES iam.users(id),
  CONSTRAINT leave_dates_ordered CHECK (ends_on >= starts_on),
  CONSTRAINT leave_decision_coherent CHECK (
    (status NOT IN ('approved','rejected')) OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)
  ),
  -- An employee cannot hold two live leave requests over the same days.
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(starts_on, ends_on, '[]') WITH &&
  ) WHERE (status IN ('pending', 'approved', 'taken'))
);

CREATE INDEX leave_requests_employee_idx ON hr.leave_requests (employee_id, starts_on DESC);
CREATE INDEX leave_requests_pending_idx ON hr.leave_requests (property_id, status)
  WHERE status = 'pending';
CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON hr.leave_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
