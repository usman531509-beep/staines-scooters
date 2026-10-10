-- Enable Supabase Realtime for hot POS tables so cashiers get live
-- stock, price and sales updates without polling. REPLICA IDENTITY FULL
-- ensures UPDATE/DELETE payloads carry the full old row.
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.sales REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;