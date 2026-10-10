-- Creates (or resets) a local test account with owner/admin/staff roles.
-- Usage: psql -d stainess_scooter -v email=... -v password=... -v full_name=... -f seed-test-account.sql
-- The on_auth_user_created trigger provisions the profile, loyalty card and customer role.

INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, confirmed_at, raw_user_meta_data, raw_app_meta_data)
VALUES (
  lower(:'email'),
  extensions.crypt(:'password', extensions.gen_salt('bf')),
  now(), now(),
  jsonb_build_object('full_name', :'full_name'),
  '{"provider":"email","providers":["email"]}'::jsonb
)
ON CONFLICT (email) DO UPDATE
  SET encrypted_password = EXCLUDED.encrypted_password, updated_at = now();

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r.role::public.app_role
FROM auth.users u
CROSS JOIN (VALUES ('owner'), ('admin'), ('staff')) AS r(role)
WHERE u.email = lower(:'email')
ON CONFLICT DO NOTHING;

SELECT u.id, u.email, array_agg(ur.role ORDER BY ur.role) AS roles
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = lower(:'email')
GROUP BY u.id, u.email;
