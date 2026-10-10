ALTER TABLE public.finance_settings ADD COLUMN interest_rebate_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.finance_agreements ADD COLUMN company_signature_data text;
ALTER TABLE public.finance_agreements ADD COLUMN company_signed_name text;
CREATE TABLE public.finance_conversation_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 agreement_id uuid NOT NULL REFERENCES public.finance_agreements(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
 channel text NOT NULL DEFAULT 'note' CHECK (channel IN ('note','phone','in_person','email','message')),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.finance_conversation_notes TO authenticated;
GRANT ALL ON public.finance_conversation_notes TO service_role;
ALTER TABLE public.finance_conversation_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance staff read conversation notes" ON public.finance_conversation_notes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin','staff')));
CREATE INDEX finance_conversation_notes_agreement_idx ON public.finance_conversation_notes(agreement_id, created_at DESC);
CREATE TABLE public.admin_signatures (
 user_id uuid PRIMARY KEY,
 signed_name text NOT NULL CHECK (length(trim(signed_name)) BETWEEN 3 AND 120),
 signature_data text NOT NULL CHECK (signature_data LIKE 'data:image/png;base64,%' AND length(signature_data) <= 400000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_signatures TO authenticated;
GRANT ALL ON public.admin_signatures TO service_role;
ALTER TABLE public.admin_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read own signature" ON public.admin_signatures FOR SELECT TO authenticated USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('owner','admin')));