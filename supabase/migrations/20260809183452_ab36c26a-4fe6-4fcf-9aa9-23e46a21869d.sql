CREATE TABLE public.card_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Shop counter terminal',
  provider text NOT NULL DEFAULT 'takepayments',
  protocol text NOT NULL DEFAULT 'http',
  host text,
  port integer NOT NULL DEFAULT 8080,
  path text NOT NULL DEFAULT '/',
  serial_number text,
  ecr_id text NOT NULL DEFAULT 'HMC-POS-01',
  integration_key text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  currency text NOT NULL DEFAULT 'GBP',
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.card_terminal_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid REFERENCES public.card_terminals(id) ON DELETE SET NULL,
  sale_id uuid,
  amount_pence integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reference text NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  auth_code text,
  card_scheme text,
  card_last4 text,
  message text,
  raw jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX card_terminal_tx_reference_idx ON public.card_terminal_transactions (reference);
CREATE INDEX card_terminal_tx_created_idx ON public.card_terminal_transactions (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_terminals TO authenticated;
GRANT ALL ON public.card_terminals TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.card_terminal_transactions TO authenticated;
GRANT ALL ON public.card_terminal_transactions TO service_role;

ALTER TABLE public.card_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_terminal_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view terminals" ON public.card_terminals
  FOR SELECT TO authenticated USING (public.hx_has_access(auth.uid()));
CREATE POLICY "Admins can insert terminals" ON public.card_terminals
  FOR INSERT TO authenticated WITH CHECK (public.hx_is_admin(auth.uid()));
CREATE POLICY "Admins can update terminals" ON public.card_terminals
  FOR UPDATE TO authenticated USING (public.hx_is_admin(auth.uid())) WITH CHECK (public.hx_is_admin(auth.uid()));
CREATE POLICY "Admins can delete terminals" ON public.card_terminals
  FOR DELETE TO authenticated USING (public.hx_is_admin(auth.uid()));

CREATE POLICY "Staff can view terminal transactions" ON public.card_terminal_transactions
  FOR SELECT TO authenticated USING (public.hx_has_access(auth.uid()));
CREATE POLICY "Staff can create terminal transactions" ON public.card_terminal_transactions
  FOR INSERT TO authenticated WITH CHECK (public.hx_has_access(auth.uid()));
CREATE POLICY "Staff can update terminal transactions" ON public.card_terminal_transactions
  FOR UPDATE TO authenticated USING (public.hx_has_access(auth.uid())) WITH CHECK (public.hx_has_access(auth.uid()));

CREATE TRIGGER card_terminals_updated_at BEFORE UPDATE ON public.card_terminals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.card_terminals (name, provider, host, port, path, ecr_id, notes)
VALUES ('Shop counter terminal', 'takepayments', NULL, 8080, '/ecr', 'HMC-POS-01', 'Stainess Scooter main counter card machine');