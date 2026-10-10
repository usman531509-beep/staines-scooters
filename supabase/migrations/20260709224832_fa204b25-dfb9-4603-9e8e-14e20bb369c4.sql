
-- Add tracking columns to dawat_dinner_attendees
ALTER TABLE public.dawat_dinner_attendees
  ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure raffle queue can point to the dinner that consumed the turn
ALTER TABLE public.dawat_raffle_queue
  ADD COLUMN IF NOT EXISTS dinner_id uuid REFERENCES public.dawat_dinners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dawat_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dawat_dinners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dawat_dinner_attendees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dawat_raffle_queue TO authenticated;
GRANT ALL ON public.dawat_profiles TO service_role;
GRANT ALL ON public.dawat_dinners TO service_role;
GRANT ALL ON public.dawat_dinner_attendees TO service_role;
GRANT ALL ON public.dawat_raffle_queue TO service_role;

-- Ensure RLS is on
ALTER TABLE public.dawat_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dawat_dinners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dawat_dinner_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dawat_raffle_queue ENABLE ROW LEVEL SECURITY;

-- Reset policies to a known state
DROP POLICY IF EXISTS "dawat members read profiles" ON public.dawat_profiles;
DROP POLICY IF EXISTS "dawat admins manage profiles" ON public.dawat_profiles;
DROP POLICY IF EXISTS "dawat self update profile" ON public.dawat_profiles;

DROP POLICY IF EXISTS "dawat members read dinners" ON public.dawat_dinners;
DROP POLICY IF EXISTS "dawat admins manage dinners" ON public.dawat_dinners;

DROP POLICY IF EXISTS "dawat members read attendees" ON public.dawat_dinner_attendees;
DROP POLICY IF EXISTS "dawat admins manage attendees" ON public.dawat_dinner_attendees;

DROP POLICY IF EXISTS "dawat members read queue" ON public.dawat_raffle_queue;
DROP POLICY IF EXISTS "dawat admins manage queue" ON public.dawat_raffle_queue;

-- Profiles: any dawat member can read; admins manage
CREATE POLICY "dawat members read profiles" ON public.dawat_profiles
  FOR SELECT TO authenticated
  USING (public.is_dawat_member(auth.uid()));

CREATE POLICY "dawat admins manage profiles" ON public.dawat_profiles
  FOR ALL TO authenticated
  USING (public.has_dawat_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_dawat_role(auth.uid(), 'admin'));

-- Dinners: members read; admins manage
CREATE POLICY "dawat members read dinners" ON public.dawat_dinners
  FOR SELECT TO authenticated
  USING (public.is_dawat_member(auth.uid()));

CREATE POLICY "dawat admins manage dinners" ON public.dawat_dinners
  FOR ALL TO authenticated
  USING (public.has_dawat_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_dawat_role(auth.uid(), 'admin'));

-- Attendees: members read; admins manage
CREATE POLICY "dawat members read attendees" ON public.dawat_dinner_attendees
  FOR SELECT TO authenticated
  USING (public.is_dawat_member(auth.uid()));

CREATE POLICY "dawat admins manage attendees" ON public.dawat_dinner_attendees
  FOR ALL TO authenticated
  USING (public.has_dawat_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_dawat_role(auth.uid(), 'admin'));

-- Queue: members read; admins manage
CREATE POLICY "dawat members read queue" ON public.dawat_raffle_queue
  FOR SELECT TO authenticated
  USING (public.is_dawat_member(auth.uid()));

CREATE POLICY "dawat admins manage queue" ON public.dawat_raffle_queue
  FOR ALL TO authenticated
  USING (public.has_dawat_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_dawat_role(auth.uid(), 'admin'));

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_dawat_attendees_updated ON public.dawat_dinner_attendees;
CREATE TRIGGER trg_dawat_attendees_updated
  BEFORE UPDATE ON public.dawat_dinner_attendees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
