-- ============ vehicles: road tax + insurance fields ============
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS tax_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS tax_due_date date,
  ADD COLUMN IF NOT EXISTS tax_cycle_key text,
  ADD COLUMN IF NOT EXISTS sorn_declared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fuel_type text,
  ADD COLUMN IF NOT EXISTS engine_capacity integer,
  ADD COLUMN IF NOT EXISTS year_of_manufacture integer,
  ADD COLUMN IF NOT EXISTS month_of_first_registration text,
  ADD COLUMN IF NOT EXISTS dvla_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS dvla_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS dvla_last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS dvla_error text,
  ADD COLUMN IF NOT EXISTS dvla_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS insurance_expiry_date date,
  ADD COLUMN IF NOT EXISTS insurance_cycle_key text,
  ADD COLUMN IF NOT EXISTS insurer text,
  ADD COLUMN IF NOT EXISTS insurance_policy_number text,
  ADD COLUMN IF NOT EXISTS insurance_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS insurance_updated_by uuid;

CREATE INDEX IF NOT EXISTS vehicles_tax_due_idx ON public.vehicles (tax_due_date) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS vehicles_tax_status_idx ON public.vehicles (tax_status) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS vehicles_dvla_checked_idx ON public.vehicles (dvla_last_checked_at) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS vehicles_insurance_expiry_idx ON public.vehicles (insurance_expiry_date) WHERE removed_at IS NULL;

-- ============ road tax settings ============
CREATE TABLE IF NOT EXISTS public.road_tax_settings (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  sync_enabled boolean NOT NULL DEFAULT true,
  pre_enabled boolean NOT NULL DEFAULT true,
  untaxed_enabled boolean NOT NULL DEFAULT true,
  monthly_enabled boolean NOT NULL DEFAULT true,
  pre_days integer[] NOT NULL DEFAULT '{30,14,7,2}',
  untaxed_count integer NOT NULL DEFAULT 3,
  untaxed_interval_days integer NOT NULL DEFAULT 3,
  monthly_interval_months integer NOT NULL DEFAULT 1,
  max_months_after_due integer NOT NULL DEFAULT 12,
  sync_interval_hours integer NOT NULL DEFAULT 24,
  sorn_excluded boolean NOT NULL DEFAULT true,
  sorn_info_enabled boolean NOT NULL DEFAULT false,
  not_found_email_enabled boolean NOT NULL DEFAULT true,
  not_found_repeat_prevented boolean NOT NULL DEFAULT true,
  not_found_share_with_mot boolean NOT NULL DEFAULT true,
  ownership_link_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  sender_display_name text NOT NULL DEFAULT 'Stainess Scooter',
  help_link_wording text NOT NULL DEFAULT 'Don''t own {{registration}} anymore? Let us know',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT road_tax_settings_singleton CHECK (id = 1)
);
GRANT SELECT, UPDATE ON public.road_tax_settings TO authenticated;
GRANT ALL ON public.road_tax_settings TO service_role;
ALTER TABLE public.road_tax_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view road tax settings" ON public.road_tax_settings FOR SELECT TO authenticated USING (public.hx_has_access(auth.uid()));
CREATE POLICY "Admins edit road tax settings" ON public.road_tax_settings FOR UPDATE TO authenticated USING (public.hx_is_admin(auth.uid())) WITH CHECK (public.hx_is_admin(auth.uid()));
INSERT INTO public.road_tax_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============ road tax templates ============
CREATE TABLE IF NOT EXISTS public.road_tax_templates (
  key text PRIMARY KEY,
  label text NOT NULL,
  subject text NOT NULL,
  heading text NOT NULL,
  intro text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  cta_text text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, UPDATE ON public.road_tax_templates TO authenticated;
GRANT ALL ON public.road_tax_templates TO service_role;
ALTER TABLE public.road_tax_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view road tax templates" ON public.road_tax_templates FOR SELECT TO authenticated USING (public.hx_has_access(auth.uid()));
CREATE POLICY "Admins edit road tax templates" ON public.road_tax_templates FOR UPDATE TO authenticated USING (public.hx_is_admin(auth.uid())) WITH CHECK (public.hx_is_admin(auth.uid()));

INSERT INTO public.road_tax_templates (key, label, subject, heading, intro, body, cta_text, sort_order) VALUES
 ('pre_30','1 month before Road Tax due','Road Tax for {{registration}} is due in about a month','Road Tax due soon','Dear {{customer_first_name}},','Your vehicle {{registration}} has Road Tax due on {{tax_due_date}} — approximately one month from now. You can tax your vehicle online at gov.uk, and we are always happy to help if you have any questions.','View my vehicle',1),
 ('pre_14','14 days before','Road Tax for {{registration}} is due in 14 days','Road Tax due in 14 days','Dear {{customer_first_name}},','Your Road Tax for {{registration}} is due on {{tax_due_date}}, which is 14 days away. Taxing your vehicle on time avoids a fine.','View my vehicle',2),
 ('pre_7','7 days before','Road Tax for {{registration}} is due in 7 days','Road Tax due in 7 days','Dear {{customer_first_name}},','Your Road Tax for {{registration}} is due on {{tax_due_date}} — just 7 days away.','View my vehicle',3),
 ('pre_2','2 days before','Road Tax for {{registration}} is due in 2 days','Road Tax due in 2 days','Dear {{customer_first_name}},','Your Road Tax for {{registration}} is due on {{tax_due_date}} — only 2 days away. Please tax your vehicle or declare it off the road (SORN) to stay legal.','View my vehicle',4),
 ('untaxed','Road Tax untaxed reminder','DVLA shows {{registration}} as untaxed','Your vehicle is showing as untaxed','Dear {{customer_first_name}},','DVLA currently shows {{registration}} as untaxed ({{days_overdue}} day(s) since the tax due date of {{tax_due_date}}). If you have already taxed it, please ignore this message — DVLA records can take a little while to update.','Tax my vehicle',5),
 ('untaxed_monthly','Monthly untaxed reminder','{{registration}} is still showing as untaxed','Still showing as untaxed','Dear {{customer_first_name}},','DVLA still shows {{registration}} as untaxed. If the vehicle is off the road you can declare it SORN, and if you no longer own it please let us know using the link below.','Tax my vehicle',6),
 ('sorn_info','SORN information notice','{{registration}} is recorded as off the road (SORN)','Recorded as SORN','Dear {{customer_first_name}},','DVLA records {{registration}} as SORN (off the road). We will not send Road Tax reminders while that is the case. When you are ready to use it again you will need to tax it first.','View my vehicle',7),
 ('not_found','Road Tax vehicle not found','Please check the registration on your account','We could not check your Road Tax','Dear {{customer_first_name}},','We were unable to obtain Road Tax information from DVLA for the registration {{registration}} saved on your account. Please check it in My Profile so we can keep you up to date with your MOT and Road Tax.','Update my vehicle registration',8)
ON CONFLICT (key) DO NOTHING;

-- ============ road tax reminders ============
CREATE TABLE IF NOT EXISTS public.road_tax_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  registration text NOT NULL,
  tax_due_date date NOT NULL,
  reminder_type text NOT NULL,
  stage text NOT NULL DEFAULT 'pre',
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  recipient_email text,
  customer_name text,
  days_offset integer,
  tax_status text,
  error_message text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS road_tax_reminders_due_idx ON public.road_tax_reminders (status, scheduled_for);
CREATE INDEX IF NOT EXISTS road_tax_reminders_vehicle_idx ON public.road_tax_reminders (vehicle_id);
CREATE INDEX IF NOT EXISTS road_tax_reminders_user_idx ON public.road_tax_reminders (user_id);
GRANT SELECT ON public.road_tax_reminders TO authenticated;
GRANT ALL ON public.road_tax_reminders TO service_role;
ALTER TABLE public.road_tax_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or staff can view road tax reminders" ON public.road_tax_reminders FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR public.hx_has_access(auth.uid()));
CREATE TRIGGER road_tax_reminders_updated_at BEFORE UPDATE ON public.road_tax_reminders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ road tax not-found notices ============
CREATE TABLE IF NOT EXISTS public.road_tax_not_found_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid,
  registration text NOT NULL,
  registration_normalized text NOT NULL,
  recipient_email text,
  status text NOT NULL DEFAULT 'sent',
  message_id text,
  error_message text,
  sent_at timestamptz,
  corrected_at timestamptz,
  resend_requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, registration_normalized)
);
GRANT SELECT ON public.road_tax_not_found_notices TO authenticated;
GRANT ALL ON public.road_tax_not_found_notices TO service_role;
ALTER TABLE public.road_tax_not_found_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read road tax not found notices" ON public.road_tax_not_found_notices FOR SELECT TO authenticated USING (public.is_rental_staff(auth.uid()));
CREATE TRIGGER road_tax_not_found_notices_updated_at BEFORE UPDATE ON public.road_tax_not_found_notices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ road tax sync runs ============
CREATE TABLE IF NOT EXISTS public.road_tax_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  checked integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  unchanged integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  taxed integer NOT NULL DEFAULT 0,
  untaxed integer NOT NULL DEFAULT 0,
  sorn integer NOT NULL DEFAULT 0,
  not_found integer NOT NULL DEFAULT 0,
  api_errors integer NOT NULL DEFAULT 0,
  trigger_source text,
  notes text
);
GRANT SELECT ON public.road_tax_sync_runs TO authenticated;
GRANT ALL ON public.road_tax_sync_runs TO service_role;
ALTER TABLE public.road_tax_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view road tax sync runs" ON public.road_tax_sync_runs FOR SELECT TO authenticated USING (public.hx_has_access(auth.uid()));

-- ============ road tax audit log ============
CREATE TABLE IF NOT EXISTS public.road_tax_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL,
  actor uuid,
  user_id uuid,
  vehicle_id uuid,
  registration text,
  details jsonb NOT NULL DEFAULT '{}'
);
GRANT SELECT ON public.road_tax_audit_log TO authenticated;
GRANT ALL ON public.road_tax_audit_log TO service_role;
ALTER TABLE public.road_tax_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view road tax audit" ON public.road_tax_audit_log FOR SELECT TO authenticated USING (public.hx_has_access(auth.uid()));

-- ============ insurance settings ============
CREATE TABLE IF NOT EXISTS public.insurance_settings (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  pre_enabled boolean NOT NULL DEFAULT true,
  expired_enabled boolean NOT NULL DEFAULT true,
  monthly_enabled boolean NOT NULL DEFAULT false,
  pre_days integer[] NOT NULL DEFAULT '{30,14,7,2}',
  expired_count integer NOT NULL DEFAULT 3,
  expired_interval_days integer NOT NULL DEFAULT 3,
  monthly_interval_months integer NOT NULL DEFAULT 1,
  max_months_after_expiry integer NOT NULL DEFAULT 6,
  ownership_link_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  customer_can_edit boolean NOT NULL DEFAULT true,
  sender_display_name text NOT NULL DEFAULT 'Stainess Scooter',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT insurance_settings_singleton CHECK (id = 1)
);
GRANT SELECT, UPDATE ON public.insurance_settings TO authenticated;
GRANT ALL ON public.insurance_settings TO service_role;
ALTER TABLE public.insurance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view insurance settings" ON public.insurance_settings FOR SELECT TO authenticated USING (public.hx_has_access(auth.uid()));
CREATE POLICY "Admins edit insurance settings" ON public.insurance_settings FOR UPDATE TO authenticated USING (public.hx_is_admin(auth.uid())) WITH CHECK (public.hx_is_admin(auth.uid()));
INSERT INTO public.insurance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============ insurance templates ============
CREATE TABLE IF NOT EXISTS public.insurance_templates (
  key text PRIMARY KEY,
  label text NOT NULL,
  subject text NOT NULL,
  heading text NOT NULL,
  intro text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  cta_text text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, UPDATE ON public.insurance_templates TO authenticated;
GRANT ALL ON public.insurance_templates TO service_role;
ALTER TABLE public.insurance_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view insurance templates" ON public.insurance_templates FOR SELECT TO authenticated USING (public.hx_has_access(auth.uid()));
CREATE POLICY "Admins edit insurance templates" ON public.insurance_templates FOR UPDATE TO authenticated USING (public.hx_is_admin(auth.uid())) WITH CHECK (public.hx_is_admin(auth.uid()));

INSERT INTO public.insurance_templates (key, label, subject, heading, intro, body, cta_text, sort_order) VALUES
 ('pre_30','1 month before insurance renewal','Insurance for {{registration}} renews in about a month','Insurance renewal due soon','Dear {{customer_first_name}},','Your insurance for {{registration}} is due to expire on {{insurance_expiry_date}} — approximately one month from now. It is a good time to compare renewal quotes.','View my vehicle',1),
 ('pre_14','14 days before','Insurance for {{registration}} expires in 14 days','Insurance expires in 14 days','Dear {{customer_first_name}},','Your insurance for {{registration}} expires on {{insurance_expiry_date}}, which is 14 days away.','View my vehicle',2),
 ('pre_7','7 days before','Insurance for {{registration}} expires in 7 days','Insurance expires in 7 days','Dear {{customer_first_name}},','Your insurance for {{registration}} expires on {{insurance_expiry_date}} — just 7 days away.','View my vehicle',3),
 ('pre_2','2 days before','Insurance for {{registration}} expires in 2 days','Insurance expires in 2 days','Dear {{customer_first_name}},','Your insurance for {{registration}} expires on {{insurance_expiry_date}} — only 2 days away. Riding without insurance is an offence, so please arrange cover in good time.','View my vehicle',4),
 ('expired','Insurance expired reminder','Insurance for {{registration}} has expired','Your insurance has expired','Dear {{customer_first_name}},','Our records show the insurance for {{registration}} expired on {{insurance_expiry_date}} ({{days_expired}} day(s) ago). If you have renewed, please update the date on your profile so we can keep your records correct.','Update my details',5),
 ('expired_monthly','Monthly insurance follow-up','Insurance for {{registration}} is still recorded as expired','Insurance still recorded as expired','Dear {{customer_first_name}},','Our records still show no current insurance for {{registration}}. If that is out of date, please update your details, and if you no longer own the vehicle let us know using the link below.','Update my details',6)
ON CONFLICT (key) DO NOTHING;

-- ============ insurance reminders ============
CREATE TABLE IF NOT EXISTS public.insurance_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  registration text NOT NULL,
  insurance_expiry_date date NOT NULL,
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
CREATE INDEX IF NOT EXISTS insurance_reminders_due_idx ON public.insurance_reminders (status, scheduled_for);
CREATE INDEX IF NOT EXISTS insurance_reminders_vehicle_idx ON public.insurance_reminders (vehicle_id);
GRANT SELECT ON public.insurance_reminders TO authenticated;
GRANT ALL ON public.insurance_reminders TO service_role;
ALTER TABLE public.insurance_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or staff can view insurance reminders" ON public.insurance_reminders FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR public.hx_has_access(auth.uid()));
CREATE TRIGGER insurance_reminders_updated_at BEFORE UPDATE ON public.insurance_reminders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
