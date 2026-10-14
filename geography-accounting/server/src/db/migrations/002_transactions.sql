-- Phase 1: income/expense transactions with approval workflow (UNVERIFIED: not yet run against PostgreSQL)
-- Phase 1 posts on a cash-settled basis: income = Dr cash/bank, Cr revenue; expense = Dr expense, Cr cash/bank.
-- Receivables/payables and accrual recognition arrive in Phase 2.

CREATE SEQUENCE transaction_reference_seq;

CREATE TABLE transactions (
  id               BIGSERIAL PRIMARY KEY,
  reference        TEXT NOT NULL UNIQUE DEFAULT ('TX-' || lpad(nextval('transaction_reference_seq')::text, 6, '0')),
  kind             TEXT NOT NULL CHECK (kind IN ('income','expense')),
  tx_date          DATE NOT NULL,
  description      TEXT NOT NULL,
  category_account_id BIGINT NOT NULL REFERENCES accounts(id),   -- revenue or expense account
  cash_account_id  BIGINT NOT NULL REFERENCES accounts(id),      -- must be a cash/bank account
  amount           BIGINT NOT NULL CHECK (amount > 0),
  currency         CHAR(3) NOT NULL DEFAULT 'EGP',
  payment_method   TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bank_transfer','cheque','card','other')),
  document_no      TEXT,                                          -- invoice or receipt number
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','posted','rejected')),
  created_by       BIGINT NOT NULL REFERENCES users(id),
  approved_by      BIGINT REFERENCES users(id),
  rejected_reason  TEXT,
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  is_demo          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (approved_by IS NULL OR approved_by <> created_by)         -- separation of duties at the DB level
);
CREATE INDEX transactions_date_idx ON transactions(tx_date);
CREATE INDEX transactions_status_idx ON transactions(status);
-- Duplicate-posting guard: same account, date, amount and document number cannot be entered twice.
CREATE UNIQUE INDEX transactions_dup_guard ON transactions(cash_account_id, tx_date, amount, document_no)
  WHERE document_no IS NOT NULL AND status <> 'rejected';
