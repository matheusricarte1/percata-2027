-- Admin user management audit trail

create table if not exists public.admin_user_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_email text not null,
  actor_role text not null,
  target_profile_id uuid null references public.profiles(id) on delete set null,
  target_email text not null,
  action text not null check (
    action in (
      'update_role',
      'update_profile',
      'send_access_reminder',
      'reset_onboarding',
      'invite_user'
    )
  ),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_user_audit_logs_created_at
  on public.admin_user_audit_logs (created_at desc);

create index if not exists idx_admin_user_audit_logs_target_email
  on public.admin_user_audit_logs (target_email);

create index if not exists idx_admin_user_audit_logs_actor_user_id
  on public.admin_user_audit_logs (actor_user_id);

alter table public.admin_user_audit_logs enable row level security;

drop policy if exists admin_user_audit_logs_select_policy on public.admin_user_audit_logs;

create policy admin_user_audit_logs_select_policy
on public.admin_user_audit_logs
for select
using (app_is_admin());

