CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv AND user_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conv
      AND (
        kind = 'world'
        OR (kind = 'dm' AND (user_a = _user OR user_b = _user))
      )
  );
$$;