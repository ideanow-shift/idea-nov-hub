-- NOV Navigator department inquiries / Notification Engine routing
-- Phase1: NOV Navigator records department inquiries in Supabase.
-- Phase2: HUB backend / Edge Function resolves route_id via os.notification_destinations
-- and sends notifications through the OS Notification Engine.
-- Note: concierge_department_routes.department_name is a route label for Phase1,
-- not the source of truth for public.departments.

create table if not exists public.concierge_department_routes (
  id text primary key,
  department_name text not null,
  owner text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concierge_department_routes_id_not_blank check (length(trim(id)) > 0),
  constraint concierge_department_routes_name_not_blank check (length(trim(department_name)) > 0)
);

comment on table public.concierge_department_routes is
  'NOV Navigator inquiry route labels. Department source of truth is public.departments; notification destinations are resolved by OS Notification Engine, not stored here.';

create table if not exists public.concierge_department_inquiries (
  id uuid primary key default gen_random_uuid(),
  route_id text not null references public.concierge_department_routes(id),
  store_id uuid references public.stores(id),
  employee_id uuid references public.employees(id),
  phase1_login_id text,
  question_log_id uuid references public.concierge_question_logs(id),
  subject text not null,
  inquiry_text text not null,
  status text not null default 'queued',
  notification_id uuid,
  notification_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concierge_department_inquiries_status_check
    check (status in ('queued', 'notified', 'failed', 'resolved', 'cancelled')),
  constraint concierge_department_inquiries_subject_not_blank check (length(trim(subject)) > 0),
  constraint concierge_department_inquiries_text_not_blank check (length(trim(inquiry_text)) > 0)
);

comment on table public.concierge_department_inquiries is
  'NOV Navigator inquiry queue for backoffice departments. Notification delivery must be done by backend/service_role only.';

-- If an older draft of this DDL was already applied, normalize it to the
-- Notification Engine design approved by CORE.
alter table public.concierge_department_routes
  drop column if exists line_works_channel_id,
  drop column if exists line_works_channel_name;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'concierge_department_inquiries'
      and column_name = 'body'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'concierge_department_inquiries'
      and column_name = 'inquiry_text'
  ) then
    alter table public.concierge_department_inquiries rename column body to inquiry_text;
  end if;
end $$;

alter table public.concierge_department_inquiries
  add column if not exists inquiry_text text,
  add column if not exists notification_id uuid,
  add column if not exists notification_error text,
  add column if not exists updated_at timestamptz not null default now(),
  drop column if exists line_works_channel_id,
  drop column if exists line_works_sent_at,
  drop column if exists line_works_error;

alter table public.concierge_department_inquiries
  drop constraint if exists concierge_department_inquiries_status_check,
  drop constraint if exists concierge_department_inquiries_body_not_blank,
  drop constraint if exists concierge_department_inquiries_text_not_blank;

alter table public.concierge_department_inquiries
  add constraint concierge_department_inquiries_status_check
    check (status in ('queued', 'notified', 'failed', 'resolved', 'cancelled')),
  add constraint concierge_department_inquiries_text_not_blank
    check (length(trim(inquiry_text)) > 0);

create index if not exists concierge_department_inquiries_created_at_idx
  on public.concierge_department_inquiries (created_at desc);

create index if not exists concierge_department_inquiries_status_idx
  on public.concierge_department_inquiries (status, created_at desc);

create index if not exists concierge_department_inquiries_route_idx
  on public.concierge_department_inquiries (route_id, created_at desc);

alter table public.concierge_department_routes enable row level security;
alter table public.concierge_department_inquiries enable row level security;

grant select, insert, update on public.concierge_department_routes to service_role;
grant select, insert, update on public.concierge_department_inquiries to service_role;

insert into public.concierge_department_routes
  (id, department_name, owner, sort_order)
values
  ('hr', '総務人事', '総務人事', 10),
  ('accounting', '経理', '経理', 20),
  ('education', '教育部', '教育部', 30),
  ('sales', '営業部', '営業部', 40),
  ('fc', 'FC担当', 'FC担当', 50),
  ('system', 'システム', 'システム担当', 60)
on conflict (id) do update set
  department_name = excluded.department_name,
  owner = excluded.owner,
  sort_order = excluded.sort_order,
  updated_at = now();
