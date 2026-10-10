ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pos_sort_order integer;
CREATE INDEX IF NOT EXISTS products_pos_sort_order_idx ON public.products (pos_sort_order);