-- Line-item detail the till records on every sale; the previous project added these
-- outside the migration history.
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS cost_price_pence integer;
