
-- CONVERSATIONS (1:1 only)
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair_key text GENERATED ALWAYS AS (
    LEAST(user_a::text, user_b::text) || ':' || GREATEST(user_a::text, user_b::text)
  ) STORED UNIQUE,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a <> user_b)
);
CREATE INDEX conversations_user_a_idx ON public.conversations(user_a);
CREATE INDEX conversations_user_b_idx ON public.conversations(user_b);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read conversations" ON public.conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "participants insert conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "participants update conversations" ON public.conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);

-- CHAT MESSAGES
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_conv_idx ON public.chat_messages(conversation_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b))
  );
CREATE POLICY "sender inserts message" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
    )
  );
CREATE POLICY "participants update read state" ON public.chat_messages
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b))
  );

-- Bump conversation.last_message_at
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER chat_messages_bump AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

-- CALL SIGNALS (WebRTC signaling — offer/answer/ICE/hangup/ring)
CREATE TABLE public.call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ring','offer','answer','ice','hangup','decline')),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_signals_to_idx ON public.call_signals(to_user, created_at DESC);
CREATE INDEX call_signals_call_idx ON public.call_signals(call_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.call_signals TO authenticated;
GRANT ALL ON public.call_signals TO service_role;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "peers read signals" ON public.call_signals
  FOR SELECT TO authenticated USING (auth.uid() = to_user OR auth.uid() = from_user);
CREATE POLICY "sender inserts signal" ON public.call_signals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user);
CREATE POLICY "peers delete signals" ON public.call_signals
  FOR DELETE TO authenticated USING (auth.uid() = to_user OR auth.uid() = from_user);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;

-- Helper: look up user by short_code (returns id + display info)
CREATE OR REPLACE FUNCTION public.find_user_by_short_code(_code text)
RETURNS TABLE(id uuid, full_name text, short_code text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.short_code, p.avatar_url
  FROM public.profiles p
  WHERE p.short_code = _code
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.find_user_by_short_code(text) TO authenticated;

-- Helper: get or create 1:1 conversation between caller and target
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  a uuid; b uuid;
  cid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF me = _other THEN RAISE EXCEPTION 'cannot start conversation with yourself'; END IF;
  IF _other::text < me::text THEN a := _other; b := me; ELSE a := me; b := _other; END IF;
  SELECT id INTO cid FROM public.conversations WHERE user_a = a AND user_b = b;
  IF cid IS NULL THEN
    INSERT INTO public.conversations(user_a, user_b) VALUES (a, b) RETURNING id INTO cid;
  END IF;
  RETURN cid;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;

-- Helper: get profile summaries for a set of user ids
CREATE OR REPLACE FUNCTION public.get_profile_summaries(_ids uuid[])
RETURNS TABLE(id uuid, full_name text, short_code text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.short_code, p.avatar_url
  FROM public.profiles p WHERE p.id = ANY(_ids);
$$;
GRANT EXECUTE ON FUNCTION public.get_profile_summaries(uuid[]) TO authenticated;
