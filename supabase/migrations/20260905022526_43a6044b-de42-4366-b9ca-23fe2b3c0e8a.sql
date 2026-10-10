create table if not exists public.mot_not_found_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  registration text not null,
  registration_normalized text not null,
  recipient_email text,
  status text not null default 'sent',
  message_id text,
  error_message text,
  sent_at timestamptz,
  corrected_at timestamptz,
  resend_requested_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, registration_normalized)
);

grant select on public.mot_not_found_notices to authenticated;
grant all on public.mot_not_found_notices to service_role;
alter table public.mot_not_found_notices enable row level security;
create policy "staff read mot not found notices" on public.mot_not_found_notices
  for select to authenticated using (public.is_rental_staff(auth.uid()));

create trigger mot_not_found_notices_updated_at before update on public.mot_not_found_notices
  for each row execute function public.set_updated_at();

create table if not exists public.mot_ownership_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  registration text not null,
  mot_expiry_date date,
  action text not null default 'not_owned',
  expires_at timestamptz not null default (now() + interval '180 days'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mot_ownership_tokens_vehicle_idx on public.mot_ownership_tokens (vehicle_id);

grant select on public.mot_ownership_tokens to authenticated;
grant all on public.mot_ownership_tokens to service_role;
alter table public.mot_ownership_tokens enable row level security;
create policy "staff read mot ownership tokens" on public.mot_ownership_tokens
  for select to authenticated using (public.is_rental_staff(auth.uid()));

alter table public.mot_settings
  add column if not exists not_found_email_enabled boolean not null default true,
  add column if not exists not_found_repeat_prevented boolean not null default true,
  add column if not exists ownership_link_enabled boolean not null default true,
  add column if not exists ownership_confirm_heading text not null default 'Do you still own this vehicle?',
  add column if not exists ownership_removed_message text not null default 'You will no longer receive MOT reminders for {{registration}}. If you have another vehicle, please add its registration to your account so we can automatically keep you informed about its MOT expiry date.',
  add column if not exists ownership_add_prompt_enabled boolean not null default true,
  add column if not exists sender_display_name text not null default 'Stainess Scooter';

insert into public.mot_templates (key, label, subject, heading, intro, body, cta_text, enabled, sort_order)
values (
  'not_found',
  'Vehicle registration not found',
  'Please check your vehicle registration',
  'We could not find your vehicle',
  'We were unable to find MOT information for the vehicle registration currently saved on your Stainess Scooter account.',
  'Please log in to your account and check that your registration number has been entered correctly.

Once the correct registration is saved, our system can automatically monitor your MOT expiry date and send you useful reminders before it expires.',
  'Update my vehicle registration',
  true,
  70
)
on conflict (key) do nothing;