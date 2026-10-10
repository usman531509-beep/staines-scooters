CREATE TABLE public.service_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reminder_type text NOT NULL CHECK (reminder_type IN ('engine_oil','full_service','belt_kit')),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_email text,
  customer_name text,
  product_name text,
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  purchase_at timestamptz NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','queued','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  error_message text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_reminders_due_idx ON public.service_reminders (status, scheduled_for);
CREATE INDEX service_reminders_user_idx ON public.service_reminders (user_id, reminder_type, status);

GRANT SELECT ON public.service_reminders TO authenticated;
GRANT ALL ON public.service_reminders TO service_role;

ALTER TABLE public.service_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view service reminders"
ON public.service_reminders FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','admin','staff')
  )
);

CREATE TRIGGER service_reminders_updated_at
BEFORE UPDATE ON public.service_reminders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();