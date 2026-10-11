-- The card machine integration was removed from the app; drop its tables.
DROP TABLE IF EXISTS public.card_terminal_transactions;
DROP TABLE IF EXISTS public.card_terminals;
