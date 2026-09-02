-- Registration & Compliance section (Company Profile settings) has no way to attach
-- an image of the actual registration document (SEC/DTI certificate, BIR COR, etc.) —
-- adds a Drive-hosted image URL column, mirroring how logo_url already works.
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS registration_doc_url text;
