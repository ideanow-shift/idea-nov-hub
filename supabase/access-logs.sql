create table if not exists public.access_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  employee_id uuid references public.employees(id) on delete set null,
  email text,
  employee_name text,
  action text not null,
  app_id text,
  app_name text,
  result text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_logs_occurred_at
  on public.access_logs (occurred_at desc);

create index if not exists idx_access_logs_email_occurred_at
  on public.access_logs (email, occurred_at desc);

create index if not exists idx_access_logs_action_occurred_at
  on public.access_logs (action, occurred_at desc);

create index if not exists idx_access_logs_app_id_occurred_at
  on public.access_logs (app_id, occurred_at desc);

alter table public.access_logs enable row level security;
