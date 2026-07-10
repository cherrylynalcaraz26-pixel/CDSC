-- Live video URL shown via the "Live Video" button on the Admin and Client dashboards.
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS live_video_url TEXT NOT NULL DEFAULT '';
