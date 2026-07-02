-- Core DB employee job types: Stage 1 additive DDL.
-- Safe to apply after IDEA NOV OS / Core DB approval.
-- Existing employees and positions are not bulk-updated by this file.

create table if not exists public.job_types (
  id uuid primary key default gen_random_uuid(),
  job_type_key text unique,
  job_type_name text not null unique,
  sort_order integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_types enable row level security;

grant select, insert, update on table public.job_types to service_role;

alter table public.employees
  add column if not exists job_type_id uuid references public.job_types(id);

create index if not exists idx_employees_job_type_id
  on public.employees (job_type_id);

insert into public.job_types (job_type_key, job_type_name, sort_order, is_active)
values
  ('hairstylist', '美容師', 10, true),
  ('reception', 'レセプション', 20, true),
  ('colorist', 'カラーリスト', 30, true),
  ('head_office', '本部スタッフ', 40, true),
  ('other', 'その他', 90, true)
on conflict (job_type_name) do update
set
  job_type_key = excluded.job_type_key,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

comment on table public.job_types is
  'Core DB shared job type master. Used for shift generation, labor cost, hiring, and education classification.';

comment on column public.employees.job_type_id is
  'References public.job_types(id). Null means unset; UI displays 未設定.';
