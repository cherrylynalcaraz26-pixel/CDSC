-- 043 — Editable website content + customizable PDF document header
--
-- Settings → Website            edits the text of the public website. Stored as
--                               JSON overrides; any section left out keeps the
--                               built-in copy from src/lib/site-content.ts.
-- Settings → Document Header    the logo / company details (or an uploaded
--                               header image) printed at the top of every PO,
--                               Quotation and Sales Order PDF.
--
-- Both are read the same way as live_video_url: the public website reads
-- system_settings, staff edit it from Settings.

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS website_content jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS pdf_header      jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Accounting → Balance Check can re-post a Sales Invoice's journal entry
-- (Re-post button). post_csi_billing() was executable by PUBLIC (incl. anon);
-- restrict it to signed-in users.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'post_csi_billing') THEN
    REVOKE ALL ON FUNCTION post_csi_billing(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION post_csi_billing(text) FROM anon;
    GRANT EXECUTE ON FUNCTION post_csi_billing(text) TO authenticated;
  END IF;
END $$;
