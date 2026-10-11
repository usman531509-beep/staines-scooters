-- New card terminals get this shop's POS id instead of the copied project's.
ALTER TABLE public.card_terminals ALTER COLUMN ecr_id SET DEFAULT 'SS-POS-01';
