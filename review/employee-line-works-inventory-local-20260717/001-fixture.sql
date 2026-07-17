create schema os;

create table public.employees (
  id uuid primary key
);

create table os.notification_destinations (
  id uuid primary key,
  provider text not null,
  target_type text not null,
  target_id uuid,
  channel_id text not null,
  channel_name text not null default '',
  purpose text not null default 'general',
  is_active boolean not null default true,
  created_by_employee_id uuid references public.employees(id),
  updated_by_employee_id uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_destinations_target_type_check
    check (target_type in ('employee', 'store', 'department', 'corporation', 'role', 'module', 'global'))
);

create unique index uq_notification_destinations_target_purpose
  on os.notification_destinations (provider, target_type, target_id, purpose);

alter table os.notification_destinations enable row level security;
grant select, insert, update, delete on os.notification_destinations to service_role;

create function os.get_employee_line_works_destination(p_employee_id uuid, p_purpose text)
returns table(configured boolean)
language sql security definer set search_path = pg_catalog, public, os
as $$ select false $$;

create function os.upsert_employee_line_works_destination(
  p_employee_id uuid,
  p_line_works_user_id text,
  p_channel_name text,
  p_purpose text,
  p_actor_employee_id uuid
) returns void
language sql security definer set search_path = pg_catalog, public, os
as $$ select $$;

create function os.disable_employee_line_works_destination(
  p_employee_id uuid,
  p_purpose text,
  p_reason_code text,
  p_actor_employee_id uuid
) returns integer
language sql security definer set search_path = pg_catalog, public, os
as $$ select 0 $$;

revoke all on function os.get_employee_line_works_destination(uuid, text) from public, anon, authenticated;
revoke all on function os.upsert_employee_line_works_destination(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function os.disable_employee_line_works_destination(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function os.get_employee_line_works_destination(uuid, text) to service_role;
grant execute on function os.upsert_employee_line_works_destination(uuid, text, text, text, uuid) to service_role;
grant execute on function os.disable_employee_line_works_destination(uuid, text, text, uuid) to service_role;
