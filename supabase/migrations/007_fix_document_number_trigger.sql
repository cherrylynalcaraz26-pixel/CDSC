-- set_document_number() branched on TG_TABLE_NAME inside a single IF/ELSIF chain,
-- referencing NEW.rr_number in one branch and NEW.er_number in the other, while
-- being attached as a trigger to two tables with different row shapes
-- (receiving_reports, employee_requests). PL/pgSQL caches each expression's field
-- lookup against the row type it first resolves against in a backend session; once
-- primed by one table (e.g. employee_requests -> er_number), a later invocation on
-- the other table (receiving_reports) can fail with:
--   record "new" has no field "er_number"
-- Splitting into one function per table removes the polymorphic NEW reference and
-- the caching hazard entirely.

DROP TRIGGER IF EXISTS trg_rr_number ON receiving_reports;
DROP TRIGGER IF EXISTS trg_er_number ON employee_requests;
DROP FUNCTION IF EXISTS set_document_number();

CREATE OR REPLACE FUNCTION set_rr_number() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rr_number IS NULL OR NEW.rr_number = '' THEN
    NEW.rr_number := 'RR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('rr_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_er_number() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.er_number IS NULL OR NEW.er_number = '' THEN
    NEW.er_number := 'ER-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('er_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rr_number BEFORE INSERT ON receiving_reports
  FOR EACH ROW EXECUTE FUNCTION set_rr_number();
CREATE TRIGGER trg_er_number BEFORE INSERT ON employee_requests
  FOR EACH ROW EXECUTE FUNCTION set_er_number();
