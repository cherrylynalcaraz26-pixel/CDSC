-- Sales channels (e.g. Shopee, Lazada, TikTok Shop) for the Dashboard's
-- "Stock by Channel" widget, and a channel tag on client_inventory so
-- existing per-client stock rows can optionally be attributed to one.
CREATE TABLE IF NOT EXISTS public.sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6b7280',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_channels_all ON public.sales_channels FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.sales_channels (name, color, sort_order) VALUES
  ('Shopee', '#ee4d2d', 1),
  ('Lazada', '#0f146d', 2),
  ('TikTok Shop', '#010101', 3)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.client_inventory
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.sales_channels(id) ON DELETE SET NULL;
