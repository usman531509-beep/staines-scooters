CREATE TABLE public.email_reminder_settings (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  schedule_note text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  days_before int,
  repeat_every_days int,
  send_days text,
  offset_days int,
  offset_months int,
  stale_days int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.email_reminder_settings TO authenticated;
GRANT ALL ON public.email_reminder_settings TO service_role;

ALTER TABLE public.email_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view reminder settings"
ON public.email_reminder_settings FOR SELECT TO authenticated
USING (public.is_rental_staff(auth.uid()));

CREATE POLICY "Admins can change reminder settings"
ON public.email_reminder_settings FOR UPDATE TO authenticated
USING (public.is_rental_admin(auth.uid()))
WITH CHECK (public.is_rental_admin(auth.uid()));

CREATE TRIGGER trg_email_reminder_settings_updated
BEFORE UPDATE ON public.email_reminder_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.email_reminder_settings
  (key, label, description, schedule_note, sort_order, days_before, repeat_every_days, send_days, offset_days, offset_months, stale_days)
VALUES
  ('voucher_expiring', 'Voucher expiring', 'Reminds a customer their gift voucher is about to expire.', 'Daily check', 10, 7, NULL, NULL, NULL, NULL, NULL),
  ('reward_unlocked', 'Reward unlocked', 'Tells a customer they have completed a reward card (e.g. free engine oil).', 'Daily check', 20, NULL, NULL, NULL, NULL, NULL, NULL),
  ('rent_due', 'Rent due reminder', 'Reminds rental customers before rent is due and chases while unpaid.', 'Daily check', 30, 2, 3, NULL, NULL, NULL, NULL),
  ('arrears_plan', 'Repayment plan chaser', 'Reminds customers on a repayment arrangement of the amount due.', 'On selected weekdays', 40, NULL, NULL, '1,4', NULL, NULL, NULL),
  ('dawat_payment_due', 'Dawat payment due', 'Reminds Dawat members of their outstanding share.', 'On selected weekdays', 50, NULL, NULL, '1,4', NULL, NULL, NULL),
  ('service_engine_oil', 'Service reminder — Engine oil', 'Reminds a customer their engine oil change is due.', 'After purchase', 60, NULL, NULL, NULL, 6, NULL, 14),
  ('service_full_service', 'Service reminder — Full service', 'Reminds a customer their full service is due.', 'After purchase', 70, NULL, NULL, NULL, NULL, 6, 14),
  ('service_belt_kit', 'Service reminder — Belt kit', 'Reminds a customer their belt kit needs checking or replacing.', 'After purchase', 80, NULL, NULL, NULL, NULL, 6, 14),
  ('weekly_offers_digest', 'Weekly offers digest', 'Weekly round-up of live offers sent to customers.', 'Weekly', 90, NULL, NULL, NULL, NULL, NULL, NULL),
  ('castrol_progress', 'Castrol reward progress', 'Weekly nudge showing progress towards the free Castrol oil change.', 'Weekly', 100, NULL, NULL, NULL, NULL, NULL, NULL);