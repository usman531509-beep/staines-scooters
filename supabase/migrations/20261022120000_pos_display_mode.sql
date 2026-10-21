-- Till display shared by every account: 'all_products' (original view) or
-- 'categories' (category tiles first). Set from Settings → POS Settings.
alter table public.loyalty_settings
  add column if not exists pos_display_mode text not null default 'all_products'
  check (pos_display_mode in ('all_products', 'categories'));
