-- One non-reversal journal entry per source document (the UNIQUE in 001 does not guard this
-- because NULL reverses_entry_id values are never equal to each other in PostgreSQL).
CREATE UNIQUE INDEX journal_entries_one_per_source
  ON journal_entries (source_type, source_id)
  WHERE source_id IS NOT NULL AND reverses_entry_id IS NULL;

-- Posted transactions are final: only status workflow fields may change before posting.
CREATE FUNCTION transactions_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'Only draft or rejected transactions can be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'posted' THEN RAISE EXCEPTION 'Posted transactions cannot be changed; create a reversal'; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER transactions_guard BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_guard();
