-- NOV Navigator department inquiries / LINE WORKS routing
-- Phase1: NOV Navigator records department inquiries in Supabase.
-- Phase2: a backend worker or Edge Function sends queued inquiries to LINE WORKS groups.

create table if not exists public.concierge_department_routes (
  id text primary key,
  department_name text not null,
  owner text,
  line_works_channel_id text,
  line_works_channel_name text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concierge_department_routes_id_not_blank check (length(trim(id)) > 0),
  constraint concierge_department_routes_name_not_blank check (length(trim(department_name)) > 0)
);

comment on table public.concierge_department_routes is
  'NOV Navigator department routing master. LINE WORKS channel IDs are server-side routing data, not frontend secrets.';

create table if not exists public.concierge_department_inquiries (
  id uuid primary key default gen_random_uuid(),
  route_id text not null references public.concierge_department_routes(id),
  store_id uuid references public.stores(id),
  employee_id uuid references public.employees(id),
  phase1_login_id text,
  question_log_id uuid references public.concierge_question_logs(id),
  subject text not null,
  body text not null,
  status text not null default 'queued',
  line_works_channel_id text,
  line_works_sent_at timestamptz,
  line_works_error text,
  created_at timestamptz not null default now(),
  constraint concierge_department_inquiries_status_check
    check (status in ('queued', 'sent', 'failed', 'cancelled')),
  constraint concierge_department_inquiries_subject_not_blank check (length(trim(subject)) > 0),
  constraint concierge_department_inquiries_body_not_blank check (length(trim(body)) > 0)
);

comment on table public.concierge_department_inquiries is
  'NOV Navigator inquiry queue for backoffice departments. Sending to LINE WORKS must be done by backend/service_role only.';

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
  (id, department_name, owner, line_works_channel_id, line_works_channel_name, sort_order)
values
  ('hr', '総務人事', '総務人事', null, null, 10),
  ('accounting', '経理', '経理', null, null, 20),
  ('education', '教育部', '教育部', null, null, 30),
  ('sales', '営業部', '営業部', null, null, 40),
  ('fc', 'FC担当', 'FC担当', null, null, 50)
on conflict (id) do update set
  department_name = excluded.department_name,
  owner = excluded.owner,
  sort_order = excluded.sort_order,
  updated_at = now();
