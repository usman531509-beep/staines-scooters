ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS html text,
  ADD COLUMN IF NOT EXISTS body_text text,
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS email_send_log_user_idx ON public.email_send_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_send_log_recipient_idx ON public.email_send_log (lower(recipient_email), created_at DESC);

GRANT SELECT ON public.email_send_log TO authenticated;

DROP POLICY IF EXISTS "Recipients can read their own emails" ON public.email_send_log;
CREATE POLICY "Recipients can read their own emails"
  ON public.email_send_log FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR lower(recipient_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    OR public.hx_has_access(auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  user_id uuid,
  subject text,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  batch_id uuid,
  status text NOT NULL DEFAULT 'queued',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_outbox_pending_idx ON public.email_outbox (status, scheduled_for);

GRANT SELECT ON public.email_outbox TO authenticated;
GRANT ALL ON public.email_outbox TO service_role;

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read outbox" ON public.email_outbox;
CREATE POLICY "Staff can read outbox"
  ON public.email_outbox FOR SELECT TO authenticated
  USING (public.hx_has_access(auth.uid()));

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('drain-email-outbox');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- The 'drain-email-outbox' job (every 10 minutes, POST <app-url>/api/public/cron/outbox
-- with header x-cron-secret: <CRON_SECRET>) is scheduled per environment once the
-- deployed app URL is known, so no URL or key is hardcoded in migrations.