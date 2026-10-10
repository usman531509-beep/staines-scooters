-- 1. Extend vehicles with MOT/DVSA fields
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS registration_normalized text,
  ADD COLUMN IF NOT EXISTS mot_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS mot_expiry_date date,
  ADD COLUMN IF NOT EXISTS mot_test_due_date date,
  ADD COLUMN IF NOT EXISTS mot_last_test_date date,
  ADD COLUMN IF NOT EXISTS mot_last_result text,
  ADD COLUMN IF NOT EXISTS dvsa_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS dvsa_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS dvsa_last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS dvsa_error text,
  ADD COLUMN IF NOT EXISTS dvsa_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mot_cycle_key text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'profile',
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

CREATE INDEX IF NOT EXISTS vehicles_reg_norm_idx ON public.vehicles (registration_normalized);
CREATE INDEX IF NOT EXISTS vehicles_mot_expiry_idx ON public.vehicles (mot_expiry_date);
CREATE INDEX IF NOT EXISTS vehicles_user_idx ON public.vehicles (user_id);
CREATE INDEX IF NOT EXISTS vehicles_sync_idx ON public.vehicles (dvsa_last_checked_at);
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_user_reg_uniq
  ON public.vehicles (user_id, registration_normalized)
  WHERE registration_normalized IS NOT NULL AND removed_at IS NULL;

-- normalise on write
CREATE OR REPLACE FUNCTION public.vehicle_normalize_reg()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.registration_normalized := nullif(upper(regexp_replace(coalesce(NEW.registration,''), '[^A-Za-z0-9]', '', 'g')), '');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vehicle_normalize_reg ON public.vehicles;
CREATE TRIGGER trg_vehicle_normalize_reg BEFORE INSERT OR UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.vehicle_normalize_reg();

UPDATE public.vehicles SET registration = registration WHERE registration_normalized IS NULL;

-- 2. Reminder ledger
CREATE TABLE IF NOT EXISTS public.mot_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  registration text NOT NULL,
  mot_expiry_date date NOT NULL,
  reminder_type text NOT NULL,
  stage text NOT NULL DEFAULT 'pre',
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  recipient_email text,
  customer_name text,
  days_offset integer,
  error_message text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mot_reminders_due_idx ON public.mot_reminders (status, scheduled_for);
CREATE INDEX IF NOT EXISTS mot_reminders_vehicle_idx ON public.mot_reminders (vehicle_id);
CREATE INDEX IF NOT EXISTS mot_reminders_user_idx ON public.mot_reminders (user_id);
GRANT SELECT ON public.mot_reminders TO authenticated;
GRANT ALL ON public.mot_reminders TO service_role;
ALTER TABLE public.mot_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or staff can view MOT reminders" ON public.mot_reminders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.hx_has_access(auth.uid()));

-- 3. Settings (single row)
CREATE TABLE IF NOT EXISTS public.mot_settings (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  pre_enabled boolean NOT NULL DEFAULT true,
  expired_enabled boolean NOT NULL DEFAULT true,
  monthly_enabled boolean NOT NULL DEFAULT true,
  pre_days integer[] NOT NULL DEFAULT '{30,14,7,2}',
  expired_count integer NOT NULL DEFAULT 3,
  expired_interval_days integer NOT NULL DEFAULT 3,
  monthly_interval_months integer NOT NULL DEFAULT 1,
  max_months_after_expiry integer NOT NULL DEFAULT 12,
  sync_interval_hours integer NOT NULL DEFAULT 24,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT mot_settings_single CHECK (id = 1)
);
INSERT INTO public.mot_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.mot_settings TO authenticated;
GRANT UPDATE ON public.mot_settings TO authenticated;
GRANT ALL ON public.mot_settings TO service_role;
ALTER TABLE public.mot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view MOT settings" ON public.mot_settings FOR SELECT TO authenticated
  USING (public.hx_has_access(auth.uid()));
CREATE POLICY "Admins edit MOT settings" ON public.mot_settings FOR UPDATE TO authenticated
  USING (public.hx_is_admin(auth.uid())) WITH CHECK (public.hx_is_admin(auth.uid()));

-- 4. Editable templates
CREATE TABLE IF NOT EXISTS public.mot_templates (
  key text PRIMARY KEY,
  label text NOT NULL,
  subject text NOT NULL,
  heading text NOT NULL,
  intro text NOT NULL,
  body text NOT NULL,
  cta_text text NOT NULL DEFAULT 'Book your MOT',
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, UPDATE ON public.mot_templates TO authenticated;
GRANT ALL ON public.mot_templates TO service_role;
ALTER TABLE public.mot_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view MOT templates" ON public.mot_templates FOR SELECT TO authenticated
  USING (public.hx_has_access(auth.uid()));
CREATE POLICY "Admins edit MOT templates" ON public.mot_templates FOR UPDATE TO authenticated
  USING (public.hx_is_admin(auth.uid())) WITH CHECK (public.hx_is_admin(auth.uid()));

INSERT INTO public.mot_templates (key, label, subject, heading, intro, body, cta_text, sort_order) VALUES
 ('pre_30','1 month before expiry','Your MOT expires on {{mot_expiry_date}} — {{registration}}','MOT due in about one month',
  'Your vehicle''s MOT is due to expire in approximately one month.',
  'The MOT for {{registration}} ({{vehicle_make}} {{vehicle_model}}) expires on {{mot_expiry_date}} — that is {{days_remaining}} days away. Booking early gives you the widest choice of appointment times.','Book your MOT',10),
 ('pre_14','2 weeks before expiry','Your MOT expires in {{days_remaining}} days — {{registration}}','MOT due in 14 days',
  'Your MOT is due to expire in 14 days.',
  'The MOT for {{registration}} ({{vehicle_make}} {{vehicle_model}}) expires on {{mot_expiry_date}}. Please contact us to arrange your MOT test.','Book your MOT',20),
 ('pre_7','1 week before expiry','Your MOT expires in {{days_remaining}} days — {{registration}}','MOT due in 7 days',
  'Your MOT is due to expire in 7 days.',
  'The MOT for {{registration}} ({{vehicle_make}} {{vehicle_model}}) expires on {{mot_expiry_date}}. It is illegal to ride without a valid MOT once it has expired.','Book your MOT',30),
 ('pre_2','2 days before expiry','Your MOT expires in {{days_remaining}} days — {{registration}}','MOT expires in 2 days',
  'Your MOT expires in 2 days.',
  'The MOT for {{registration}} ({{vehicle_make}} {{vehicle_model}}) expires on {{mot_expiry_date}}. Please get in touch as soon as possible so we can fit you in before then.','Book your MOT now',40),
 ('expired','MOT expired reminder','MOT expired — {{registration}}','MOT has expired',
  'Our records currently show that the MOT for your vehicle has expired.',
  'DVSA records show that the MOT for {{registration}} ({{vehicle_make}} {{vehicle_model}}) expired on {{mot_expiry_date}}, {{days_expired}} days ago. We would be happy to arrange a test for you at your convenience.','Arrange your MOT',50),
 ('expired_monthly','Monthly expired follow-up','MOT still showing as expired — {{registration}}','MOT still showing as expired',
  'Our records currently show that the MOT for your vehicle has expired.',
  'DVSA records still show no valid MOT for {{registration}} ({{vehicle_make}} {{vehicle_model}}), which expired on {{mot_expiry_date}}. If your vehicle has since been tested elsewhere, please ignore this message — our records update automatically.','Arrange your MOT',60)
ON CONFLICT (key) DO NOTHING;

-- 5. Sync runs
CREATE TABLE IF NOT EXISTS public.mot_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  checked integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  unchanged integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  not_found integer NOT NULL DEFAULT 0,
  api_errors integer NOT NULL DEFAULT 0,
  trigger_source text NOT NULL DEFAULT 'cron',
  notes text
);
CREATE INDEX IF NOT EXISTS mot_sync_runs_started_idx ON public.mot_sync_runs (started_at DESC);
GRANT SELECT ON public.mot_sync_runs TO authenticated;
GRANT ALL ON public.mot_sync_runs TO service_role;
ALTER TABLE public.mot_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view MOT sync runs" ON public.mot_sync_runs FOR SELECT TO authenticated
  USING (public.hx_has_access(auth.uid()));

-- 6. Audit log
CREATE TABLE IF NOT EXISTS public.mot_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL,
  actor uuid,
  user_id uuid,
  vehicle_id uuid,
  registration text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS mot_audit_created_idx ON public.mot_audit_log (created_at DESC);
GRANT SELECT ON public.mot_audit_log TO authenticated;
GRANT ALL ON public.mot_audit_log TO service_role;
ALTER TABLE public.mot_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view MOT audit" ON public.mot_audit_log FOR SELECT TO authenticated
  USING (public.hx_has_access(auth.uid()));

-- 7. Keep vehicles in sync with the registration held on the customer profile
CREATE OR REPLACE FUNCTION public.sync_profile_vehicle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  norm text;
  v_id uuid;
BEGIN
  norm := nullif(upper(regexp_replace(coalesce(NEW.bike_reg,''), '[^A-Za-z0-9]', '', 'g')), '');

  IF norm IS NULL THEN
    -- registration removed: retire vehicles that came from the profile and stop pending reminders
    UPDATE public.vehicles SET removed_at = now()
      WHERE user_id = NEW.id AND source = 'profile' AND removed_at IS NULL;
    UPDATE public.mot_reminders r SET status = 'cancelled',
        error_message = 'Registration removed from customer account', updated_at = now()
      WHERE r.user_id = NEW.id AND r.status IN ('scheduled','queued')
        AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = r.vehicle_id AND v.removed_at IS NOT NULL);
    RETURN NEW;
  END IF;

  SELECT id INTO v_id FROM public.vehicles
    WHERE user_id = NEW.id AND registration_normalized = norm LIMIT 1;

  IF v_id IS NULL THEN
    -- retire any other profile-sourced vehicle (registration changed)
    UPDATE public.vehicles SET removed_at = now()
      WHERE user_id = NEW.id AND source = 'profile' AND removed_at IS NULL
        AND registration_normalized <> norm;
    UPDATE public.mot_reminders r SET status = 'cancelled',
        error_message = 'Registration changed on customer account', updated_at = now()
      WHERE r.user_id = NEW.id AND r.status IN ('scheduled','queued')
        AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = r.vehicle_id AND v.removed_at IS NOT NULL);

    INSERT INTO public.vehicles (user_id, registration, make, model, source, dvsa_sync_status, mot_status)
      VALUES (NEW.id, NEW.bike_reg, NEW.bike_make, NEW.bike_model, 'profile', 'pending', 'unknown');
  ELSE
    UPDATE public.vehicles
      SET registration = NEW.bike_reg,
          removed_at = NULL,
          make = COALESCE(make, NEW.bike_make),
          model = COALESCE(model, NEW.bike_model)
      WHERE id = v_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_sync_vehicle ON public.profiles;
CREATE TRIGGER trg_profiles_sync_vehicle AFTER INSERT OR UPDATE OF bike_reg ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_vehicle();

DROP TRIGGER IF EXISTS trg_mot_reminders_updated ON public.mot_reminders;
CREATE TRIGGER trg_mot_reminders_updated BEFORE UPDATE ON public.mot_reminders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Backfill vehicles from existing customer registrations
INSERT INTO public.vehicles (user_id, registration, make, model, source, dvsa_sync_status, mot_status)
SELECT p.id, p.bike_reg, p.bike_make, p.bike_model, 'profile', 'pending', 'unknown'
FROM public.profiles p
WHERE p.deleted_at IS NULL
  AND nullif(upper(regexp_replace(coalesce(p.bike_reg,''), '[^A-Za-z0-9]', '', 'g')), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.user_id = p.id
      AND v.registration_normalized = upper(regexp_replace(p.bike_reg, '[^A-Za-z0-9]', '', 'g'))
  );