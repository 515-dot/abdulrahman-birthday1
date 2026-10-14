-- Geography Real Estate accounting — Phase 1 core schema (UNVERIFIED: not yet run against PostgreSQL)
-- Money columns are BIGINT minor units (piastres). No floating point anywhere.

CREATE TABLE company_settings (
  id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  legal_name            TEXT,              -- left blank until supplied
  tax_registration_no   TEXT,
  commercial_reg_no     TEXT,
  address               TEXT,
  functional_currency   CHAR(3) NOT NULL DEFAULT 'EGP',
  accounting_method     TEXT NOT NULL DEFAULT 'accrual' CHECK (accounting_method IN ('accrual','cash')),
  fiscal_year_start_month SMALLINT NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  default_language      TEXT NOT NULL DEFAULT 'ar' CHECK (default_language IN ('ar','en'))
);
INSERT INTO company_settings DEFAULT VALUES;

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('super_admin','finance_manager','accountant','cashier','sales_manager','broker','auditor')),
  approval_limit BIGINT,                   -- NULL = unlimited (finance manager / admin only)
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  parent_id   BIGINT REFERENCES accounts(id),
  is_cash_or_bank BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE accounting_periods (
  id          BIGSERIAL PRIMARY KEY,
  starts_on   DATE NOT NULL,
  ends_on     DATE NOT NULL CHECK (ends_on >= starts_on),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  UNIQUE (starts_on, ends_on)
);

CREATE SEQUENCE journal_reference_seq;

CREATE TABLE journal_entries (
  id              BIGSERIAL PRIMARY KEY,
  reference       TEXT NOT NULL UNIQUE DEFAULT ('JE-' || lpad(nextval('journal_reference_seq')::text, 6, '0')),
  entry_date      DATE NOT NULL,
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  source_type     TEXT NOT NULL DEFAULT 'manual',        -- manual | transaction | opening_balance | ...
  source_id       BIGINT,
  reverses_entry_id BIGINT REFERENCES journal_entries(id),
  created_by      BIGINT NOT NULL REFERENCES users(id),
  posted_by       BIGINT REFERENCES users(id),
  posted_at       TIMESTAMPTZ,
  is_demo         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- one posted entry per source document prevents duplicate posting of the same receipt/payment
  UNIQUE (source_type, source_id, reverses_entry_id)
);

CREATE TABLE journal_lines (
  id          BIGSERIAL PRIMARY KEY,
  entry_id    BIGINT NOT NULL REFERENCES journal_entries(id),
  account_id  BIGINT NOT NULL REFERENCES accounts(id),
  debit       BIGINT NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit      BIGINT NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo        TEXT,
  CHECK ((debit > 0) <> (credit > 0))
);
CREATE INDEX journal_lines_entry_idx ON journal_lines(entry_id);
CREATE INDEX journal_lines_account_idx ON journal_lines(account_id);

-- Immutability: posted/reversed entries and their lines cannot be edited or deleted.
CREATE FUNCTION journal_entries_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'Posted journal entries cannot be deleted; create a reversal'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'draft' THEN RETURN NEW; END IF;
  IF OLD.status = 'posted' AND NEW.status = 'reversed'
     AND NEW.entry_date = OLD.entry_date AND NEW.description = OLD.description THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Posted journal entries are immutable';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER journal_entries_guard BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION journal_entries_guard();

CREATE FUNCTION journal_lines_guard() RETURNS trigger AS $$
DECLARE st TEXT; eid BIGINT;
BEGIN
  eid := COALESCE(NEW.entry_id, OLD.entry_id);
  SELECT status INTO st FROM journal_entries WHERE id = eid;
  IF st <> 'draft' THEN RAISE EXCEPTION 'Lines of a posted entry cannot be changed'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;
CREATE TRIGGER journal_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION journal_lines_guard();

-- Balance check at posting time: debits must equal credits.
CREATE FUNCTION journal_post_balance_check() RETURNS trigger AS $$
DECLARE d BIGINT; c BIGINT; n INT;
BEGIN
  IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0), COUNT(*) INTO d, c, n FROM journal_lines WHERE entry_id = NEW.id;
    IF n < 2 OR d <> c THEN RAISE EXCEPTION 'Entry % is not balanced or has fewer than two lines', NEW.reference; END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER journal_post_balance_check BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION journal_post_balance_check();

CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     BIGINT REFERENCES users(id),
  action      TEXT NOT NULL,                 -- created | updated | approved | posted | reversed | exported | login ...
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  details     JSONB NOT NULL DEFAULT '{}'
);
CREATE FUNCTION audit_log_readonly() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER audit_log_readonly BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_readonly();
