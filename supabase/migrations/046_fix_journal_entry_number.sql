-- 046 — Fix duplicate journal entry numbers
--
-- generate_entry_number() numbered new entries as COUNT(*) + 1. Once any
-- journal entry is deleted (e.g. editing a CSI deletes and re-posts its sales
-- invoice entry) the count drops below the highest number in use, so the next
-- entry gets a number that already exists and the insert fails with a unique
-- violation ("That record already exists"), blocking the CSI save.
--
-- Number from the highest existing JE-###### instead, under a transaction
-- advisory lock so two saves at the same moment cannot take the same number.

CREATE OR REPLACE FUNCTION public.generate_entry_number() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE v_next int;
BEGIN
  IF NEW.entry_number IS NULL OR btrim(NEW.entry_number) = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('journal_entries.entry_number'));
    SELECT COALESCE(MAX(substring(entry_number FROM 4)::int), 0) + 1 INTO v_next
      FROM journal_entries WHERE entry_number ~ '^JE-\d+$';
    NEW.entry_number := 'JE-' || lpad(v_next::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
