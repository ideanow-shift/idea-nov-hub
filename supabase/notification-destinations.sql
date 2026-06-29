create schema if not exists os;

create table if not exists os.notification_destinations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  target_type text not null,
  target_id uuid,
  channel_id text not null,
  channel_name text not null default '',
  purpose text not null default 'general',
  is_active boolean not null default true,
  created_by_employee_id uuid references public.employees(id) on delete set null,
  updated_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_destinations_provider_check
    check (provider in ('line_works')),
  constraint notification_destinations_target_type_check
    check (target_type in ('store', 'department', 'corporation', 'role', 'module', 'global')),
  constraint notification_destinations_global_target_check
    check ((target_type = 'global' and target_id is null) or (target_type <> 'global' and target_id is not null))
);

create unique index if not exists uq_notification_destinations_target_purpose
  on os.notification_destinations (provider, target_type, target_id, purpose);

create index if not exists idx_notification_destinations_target
  on os.notification_destinations (target_type, target_id, provider, purpose);

create index if not exists idx_notification_destinations_active
  on os.notification_destinations (provider, purpose, is_active);

alter table os.notification_destinations enable row level security;

grant select, insert, update, delete on table os.notification_destinations to service_role;
