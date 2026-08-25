CREATE TABLE IF NOT EXISTS collection_csi_links (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  si_number text not null,
  created_at timestamptz not null default now(),
  unique(collection_id, si_number)
);
ALTER TABLE collection_csi_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage collection_csi_links" ON collection_csi_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Backfill existing single si_number links so the new join table reflects history.
INSERT INTO collection_csi_links (collection_id, si_number)
SELECT id, si_number FROM collections WHERE si_number IS NOT NULL
ON CONFLICT DO NOTHING;
