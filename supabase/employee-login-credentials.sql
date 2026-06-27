create table if not exists public.employee_login_credentials (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete cascade,
  login_email text not null,
  pin_hash text,
  pin_updated_at timestamptz,
  must_change_pin boolean not null default false,
  login_enabled boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_employee_login_credentials_login_email
  on public.employee_login_credentials (lower(login_email));

create index if not exists idx_employee_login_credentials_employee_id
  on public.employee_login_credentials (employee_id);

alter table public.employee_login_credentials enable row level security;

grant select, insert, update on public.employee_login_credentials to service_role;

comment on table public.employee_login_credentials is
  'NOV HUB / IDEA LINK共通ログイン資格情報。PINは平文保存せず、backend側pepper付きhashのみ保存する。';

comment on column public.employee_login_credentials.pin_hash is
  'PIN hash。フロント、ログ、HUB Context、スプレッドシートへ出力しない。';
