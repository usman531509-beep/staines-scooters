-- Bootstrap for a fresh database: the previous project's email infrastructure created
-- these functions outside the migration history, and the next migration alters them.
-- The app no longer sends email, so they are inert placeholders.
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
  RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;
CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
  RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb) LANGUAGE sql
  AS $$ SELECT NULL::bigint, NULL::integer, NULL::jsonb WHERE false $$;
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
  RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
  RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;
CREATE OR REPLACE FUNCTION public.email_queue_wake() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.email_queue_dispatch() RETURNS void LANGUAGE sql AS $$ SELECT $$;
