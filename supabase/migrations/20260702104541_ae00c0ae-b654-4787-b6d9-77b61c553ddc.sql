
ALTER TABLE public.products ALTER COLUMN vat_rate SET DEFAULT 0;
UPDATE public.products SET vat_rate = 0;

UPDATE public.offers
SET name = 'Castrol Buy 3 Get 1 Free',
    description = 'Buy 3 Engine Oils and get the 4th free',
    rules = '{"target":3}'::jsonb,
    product_id = (SELECT id FROM public.products WHERE sku = 'OIL-1040' LIMIT 1),
    voucher_reward_name = COALESCE(voucher_reward_name, 'Free Engine Oil'),
    offer_type = 'buy_x_get_1',
    active = true
WHERE name ILIKE '%Castrol%Buy%Get%';

UPDATE public.offer_progress
SET target = 3
WHERE offer_id IN (SELECT id FROM public.offers WHERE name = 'Castrol Buy 3 Get 1 Free');
