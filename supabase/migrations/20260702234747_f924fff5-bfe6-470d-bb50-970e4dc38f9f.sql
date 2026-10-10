UPDATE public.vouchers v
SET status = 'active',
    used_at = NULL,
    used_sale_id = NULL
FROM public.loyalty_cards c
WHERE c.user_id = v.user_id
  AND c.card_number = 'HM-C36D7684'
  AND v.code = 'HMC-001001';