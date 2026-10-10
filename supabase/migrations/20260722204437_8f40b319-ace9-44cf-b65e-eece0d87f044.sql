DROP FUNCTION IF EXISTS public.get_or_create_conversation(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_conversation_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_conversation_admin(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.bump_conversation_last_message() CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.conversation_members CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.call_signals CASCADE;
DROP TABLE IF EXISTS public.world_room_bans CASCADE;