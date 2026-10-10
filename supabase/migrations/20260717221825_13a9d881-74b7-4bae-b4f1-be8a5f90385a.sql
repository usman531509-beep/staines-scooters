-- Extend conversations for groups + world room
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'dm';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_by uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conversations_kind_chk') THEN
    ALTER TABLE public.conversations ADD CONSTRAINT conversations_kind_chk CHECK (kind IN ('dm','group','world'));
  END IF;
END $$;
ALTER TABLE public.conversations ALTER COLUMN user_a DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user_b DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT ALL ON public.conversation_members TO service_role;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS conversation_members_user_idx ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS conversation_members_conv_idx ON public.conversation_members(conversation_id);

INSERT INTO public.conversation_members (conversation_id, user_id, role)
SELECT id, user_a, 'admin' FROM public.conversations WHERE user_a IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.conversation_members (conversation_id, user_id, role)
SELECT id, user_b, 'admin' FROM public.conversations WHERE user_b IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.world_room_bans (
  user_id uuid PRIMARY KEY,
  banned_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.world_room_bans TO authenticated;
GRANT ALL ON public.world_room_bans TO service_role;
ALTER TABLE public.world_room_bans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachment_mime text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.chat_messages ALTER COLUMN body DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chat_messages_kind_chk') THEN
    ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_kind_chk CHECK (kind IN ('text','image','voice'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members WHERE conversation_id = _conv AND user_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.conversations WHERE id = _conv AND kind = 'world'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_admin(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv AND user_id = _user AND role = 'admin'
  );
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='conversations' LOOP
    EXECUTE format('DROP POLICY %I ON public.conversations', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='chat_messages' LOOP
    EXECUTE format('DROP POLICY %I ON public.chat_messages', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "read conversations I belong to" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));
CREATE POLICY "create DM or group" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (kind IN ('dm','group') AND (created_by IS NULL OR created_by = auth.uid()));
CREATE POLICY "conversation admin can update" ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_admin(id, auth.uid()) OR private.has_any_staff_role(auth.uid()))
  WITH CHECK (true);
CREATE POLICY "admin/creator can delete" ON public.conversations FOR DELETE TO authenticated
  USING (public.is_conversation_admin(id, auth.uid()) OR private.has_any_staff_role(auth.uid()));

CREATE POLICY "members read messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "members send messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.kind='world'
        AND EXISTS (SELECT 1 FROM public.world_room_bans b WHERE b.user_id = auth.uid())
    )
  );
CREATE POLICY "sender or admin update message" ON public.chat_messages FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.is_conversation_admin(conversation_id, auth.uid())
    OR private.has_any_staff_role(auth.uid())
  ) WITH CHECK (true);
CREATE POLICY "sender or admin delete message" ON public.chat_messages FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.is_conversation_admin(conversation_id, auth.uid())
    OR private.has_any_staff_role(auth.uid())
  );

CREATE POLICY "read members of my conversations" ON public.conversation_members FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "self or admin join" ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_conversation_admin(conversation_id, auth.uid()));
CREATE POLICY "self leave or admin remove" ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_admin(conversation_id, auth.uid()));
CREATE POLICY "admin update role" ON public.conversation_members FOR UPDATE TO authenticated
  USING (public.is_conversation_admin(conversation_id, auth.uid())) WITH CHECK (true);

CREATE POLICY "authenticated read bans" ON public.world_room_bans FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manages bans" ON public.world_room_bans FOR ALL TO authenticated
  USING (private.has_any_staff_role(auth.uid()))
  WITH CHECK (private.has_any_staff_role(auth.uid()));

INSERT INTO public.conversations (kind, title)
SELECT 'world', 'World Chat'
WHERE NOT EXISTS (SELECT 1 FROM public.conversations WHERE kind = 'world');

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Storage policies (bucket created via tool). Path: <conversation_id>/...
DROP POLICY IF EXISTS "chat-media members read" ON storage.objects;
DROP POLICY IF EXISTS "chat-media members write" ON storage.objects;
DROP POLICY IF EXISTS "chat-media sender delete" ON storage.objects;
CREATE POLICY "chat-media members read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND public.is_conversation_member((split_part(name, '/', 1))::uuid, auth.uid())
);
CREATE POLICY "chat-media members write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND public.is_conversation_member((split_part(name, '/', 1))::uuid, auth.uid())
);
CREATE POLICY "chat-media sender delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (owner = auth.uid() OR private.has_any_staff_role(auth.uid()))
);