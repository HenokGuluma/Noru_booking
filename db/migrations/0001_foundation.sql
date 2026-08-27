-- =============================================================================
-- 0001  Foundation: schemas, tenancy, identity, access control, audit
-- =============================================================================
-- Conventions used throughout (see docs/data-model.md):
--   * Primary keys are UUIDv7-ish (time-ordered) generated in the application,
--     so inserts stay index-friendly and IDs are safe to expose.
--   * Money is `bigint` santim. Never `float`, never `money`.
--   * Timestamps are `timestamptz`, always stored UTC. Calendar dates that mean
--     "a day in Addis" are `date`, computed at +03:00.
--   * Every mutable business table carries created_at/updated_at/created_by.
--   * Soft deletion is deliberate and rare: `archived_at`, not `is_deleted`.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS org;      -- properties, departments, positions
CREATE SCHEMA IF NOT EXISTS hr;       -- people, contracts, leave, discipline
CREATE SCHEMA IF NOT EXISTS ops;      -- rosters, shifts, attendance
CREATE SCHEMA IF NOT EXISTS payroll;  -- rule sets, runs, payslips
CREATE SCHEMA IF NOT EXISTS iam;      -- users, roles, sessions
CREATE SCHEMA IF NOT EXISTS audit;    -- append-only history

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- exclusion constraints on ranges
CREATE EXTENSION IF NOT EXISTS "citext";      -- case-insensitive email

-- --- shared helpers ----------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

COMMENT ON FUNCTION set_updated_at IS
  'Attach as a BEFORE UPDATE trigger so updated_at cannot be forgotten or faked.';

-- --- org.properties ----------------------------------------------------------
-- Noru Booking operates several hotels. Every row in this system belongs to
-- exactly one property, and property_id is the tenancy boundary enforced by
-- row-level security. A group-level HR manager gets access through a grant,
-- not through a nullable property_id.

CREATE TABLE org.properties (
  id                uuid PRIMARY KEY,
  code              text NOT NULL UNIQUE,       -- 'NB-ADD-01'
  name              text NOT NULL,
  name_am           text,
  city              text NOT NULL,
  region            text NOT NULL,              -- Addis Ababa, Oromia, Amhara, ...
  sub_city          text,                       -- Bole, Kirkos … Addis-specific
  woreda            text,
  street_address    text,
  tin               text NOT NULL,              -- employer TIN, Ministry of Revenues
  business_licence  text,
  poessa_employer_no text,                      -- pension scheme registration
  phone             text,
  email             citext,
  room_count        integer CHECK (room_count > 0),
  star_rating       smallint CHECK (star_rating BETWEEN 1 AND 5),
  timezone          text NOT NULL DEFAULT 'Africa/Addis_Ababa',
  default_locale    text NOT NULL DEFAULT 'en-ET' CHECK (default_locale IN ('en-ET','am-ET')),
  -- Weekly rest day the property defaults to when a contract does not name one.
  default_rest_weekday smallint NOT NULL DEFAULT 0 CHECK (default_rest_weekday BETWEEN 0 AND 6),
  opened_on         date,
  archived_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT properties_tin_format CHECK (tin ~ '^[0-9]{10}$')
);

CREATE TRIGGER properties_updated_at BEFORE UPDATE ON org.properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN org.properties.tin IS
  'Ten-digit Taxpayer Identification Number. Required on every PAYE declaration.';

-- --- org.departments ---------------------------------------------------------
-- Hotel departments nest: Food & Beverage contains Kitchen, Restaurant, Banquet.
-- Modelled as an adjacency list; depth is small and bounded, so a recursive CTE
-- beats the complexity of a materialised path or nested set here.

CREATE TABLE org.departments (
  id             uuid PRIMARY KEY,
  property_id    uuid NOT NULL REFERENCES org.properties(id) ON DELETE RESTRICT,
  parent_id      uuid REFERENCES org.departments(id) ON DELETE RESTRICT,
  code           text NOT NULL,               -- 'FO', 'HK', 'FB', 'KIT', 'ENG'
  name           text NOT NULL,
  name_am        text,
  cost_centre    text,
  -- Set once the department has a head; nullable because a department can be
  -- vacant, and a NOT NULL here would create a chicken-and-egg on first insert.
  head_employee_id uuid,
  is_operational boolean NOT NULL DEFAULT true,  -- false for admin/back office
  archived_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, code),
  CONSTRAINT departments_no_self_parent CHECK (id <> parent_id)
);

CREATE INDEX departments_property_idx ON org.departments (property_id) WHERE archived_at IS NULL;
CREATE INDEX departments_parent_idx ON org.departments (parent_id);
CREATE TRIGGER departments_updated_at BEFORE UPDATE ON org.departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- org.positions -----------------------------------------------------------
-- A position is a job template (Front Desk Agent), not a person. Salary bands
-- live here; an individual's actual salary lives on their contract.

CREATE TABLE org.positions (
  id                    uuid PRIMARY KEY,
  property_id           uuid NOT NULL REFERENCES org.properties(id) ON DELETE RESTRICT,
  department_id         uuid NOT NULL REFERENCES org.departments(id) ON DELETE RESTRICT,
  code                  text NOT NULL,
  title                 text NOT NULL,
  title_am              text,
  grade                 smallint NOT NULL CHECK (grade BETWEEN 1 AND 12),
  salary_band_min_santim bigint NOT NULL CHECK (salary_band_min_santim >= 0),
  salary_band_max_santim bigint NOT NULL CHECK (salary_band_max_santim >= 0),
  -- Tipped roles share the service charge pool; this drives payroll allowances.
  shares_service_charge boolean NOT NULL DEFAULT false,
  -- Roles that legally require a current certificate (food handler, lifeguard,
  -- first aid). The roster refuses to assign staff whose certificate has lapsed.
  required_certifications text[] NOT NULL DEFAULT '{}',
  headcount_budget      integer CHECK (headcount_budget >= 0),
  archived_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, code),
  CONSTRAINT positions_band_ordered CHECK (salary_band_max_santim >= salary_band_min_santim)
);

CREATE INDEX positions_department_idx ON org.positions (department_id) WHERE archived_at IS NULL;
CREATE TRIGGER positions_updated_at BEFORE UPDATE ON org.positions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- iam ---------------------------------------------------------------------
-- Users are separate from employees on purpose. Most employees never sign in
-- (a room attendant clocks in at a terminal), and a few users are not employees
-- (the group auditor, an implementation consultant).

CREATE TABLE iam.users (
  id                 uuid PRIMARY KEY,
  email              citext NOT NULL UNIQUE,
  password_hash      text,                    -- null when SSO-only
  display_name       text NOT NULL,
  preferred_locale   text NOT NULL DEFAULT 'en-ET' CHECK (preferred_locale IN ('en-ET','am-ET')),
  -- Which calendar the interface leads with. Ethiopian by default: this is a
  -- product for Ethiopian HR officers, and Gregorian is the secondary reading.
  preferred_calendar text NOT NULL DEFAULT 'ethiopian'
                     CHECK (preferred_calendar IN ('ethiopian','gregorian')),
  employee_id        uuid,                    -- FK added in 0002, after hr.employees
  mfa_secret         text,
  mfa_enabled_at     timestamptz,
  last_login_at      timestamptz,
  failed_login_count smallint NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  disabled_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON iam.users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE iam.roles (
  id          uuid PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  name_am     text,
  description text,
  -- System roles cannot be edited or deleted through the API.
  is_system   boolean NOT NULL DEFAULT false
);

CREATE TABLE iam.permissions (
  code        text PRIMARY KEY,        -- 'employee.read', 'payroll.approve'
  description text NOT NULL
);

CREATE TABLE iam.role_permissions (
  role_id         uuid NOT NULL REFERENCES iam.roles(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES iam.permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

-- A user's role is scoped to a property. The same person can be Department Head
-- at one hotel and read-only at another; a null property_id means group-wide.
CREATE TABLE iam.user_roles (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES iam.roles(id) ON DELETE RESTRICT,
  property_id uuid REFERENCES org.properties(id) ON DELETE CASCADE,
  -- Department Heads see only their own department's people.
  department_id uuid REFERENCES org.departments(id) ON DELETE CASCADE,
  granted_by  uuid REFERENCES iam.users(id),
  granted_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz
);

-- A grant is unique per (user, role, scope). Postgres treats NULLs as distinct
-- in unique indexes, so the scope columns are coalesced to a sentinel to stop
-- the same group-wide grant being issued twice.
CREATE UNIQUE INDEX user_roles_unique_grant_idx ON iam.user_roles (
  user_id,
  role_id,
  COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE INDEX user_roles_property_idx ON iam.user_roles (property_id);

CREATE TABLE iam.sessions (
  id               uuid PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE,   -- SHA-256; the raw token never lands here
  user_agent       text,
  ip_address       inet,
  issued_at        timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  revoked_at       timestamptz,
  -- Set when this session was rotated; a replayed old token means theft, and
  -- the auth service revokes the whole family when it sees one.
  replaced_by      uuid REFERENCES iam.sessions(id)
);

CREATE INDEX sessions_user_active_idx ON iam.sessions (user_id)
  WHERE revoked_at IS NULL;

-- --- audit -------------------------------------------------------------------
-- Append-only. No UPDATE or DELETE grant is ever issued on this table; the
-- Ethiopian labour inspectorate and the group auditor both need a record that
-- cannot be quietly tidied up.

CREATE TABLE audit.events (
  id           bigserial PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES iam.users(id),
  actor_label  text NOT NULL,           -- denormalised: users can be deleted, history cannot
  property_id  uuid REFERENCES org.properties(id),
  action       text NOT NULL,           -- 'employee.terminated', 'payroll.approved'
  entity_type  text NOT NULL,
  entity_id    uuid,
  -- Only the changed fields, never the whole row: keeps the table small and
  -- avoids duplicating national ID numbers across thousands of audit rows.
  changes      jsonb,
  reason       text,                    -- required for a defined set of actions
  ip_address   inet,
  request_id   text
);

CREATE INDEX audit_events_entity_idx ON audit.events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_events_actor_idx ON audit.events (actor_user_id, occurred_at DESC);
CREATE INDEX audit_events_property_idx ON audit.events (property_id, occurred_at DESC);

REVOKE UPDATE, DELETE ON audit.events FROM PUBLIC;

COMMENT ON TABLE audit.events IS
  'Append-only audit trail. Retention is 7 years; partition by year before it grows past ~50M rows.';
