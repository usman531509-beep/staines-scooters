
CREATE TABLE public.push_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  image_url TEXT,
  audience TEXT NOT NULL DEFAULT 'all',
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  delivery_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_notifications TO authenticated;
GRANT ALL ON public.push_notifications TO service_role;
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in reads sent notifications"
  ON public.push_notifications FOR SELECT TO authenticated
  USING (status = 'sent' AND deleted_at IS NULL);
CREATE POLICY "Admins manage push notifications"
  ON public.push_notifications FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'owner'::app_role));
CREATE TRIGGER trg_push_notifications_updated
  BEFORE UPDATE ON public.push_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_push_notifications_sent_at ON public.push_notifications (sent_at DESC) WHERE status = 'sent' AND deleted_at IS NULL;

CREATE TABLE public.push_notification_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.push_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_notification_reads TO authenticated;
GRANT ALL ON public.push_notification_reads TO service_role;
ALTER TABLE public.push_notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own read state"
  ON public.push_notification_reads FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all read state"
  ON public.push_notification_reads FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'owner'::app_role));
CREATE TRIGGER trg_push_reads_updated
  BEFORE UPDATE ON public.push_notification_reads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_push_reads_user ON public.push_notification_reads (user_id);

CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  endpoint TEXT,
  p256dh TEXT,
  auth_key TEXT,
  native_token TEXT,
  device_label TEXT,
  user_agent TEXT,
  disabled_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint),
  UNIQUE (user_id, native_token)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'owner'::app_role));
CREATE TRIGGER trg_push_subs_updated
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_push_subs_user ON public.push_subscriptions (user_id) WHERE disabled_at IS NULL;
