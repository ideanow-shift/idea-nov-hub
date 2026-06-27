create table if not exists public.portal_apps (
  id uuid primary key default gen_random_uuid(),
  app_id text not null unique,
  app_name text not null,
  description text not null default '',
  url text not null default '',
  category text not null default 'internal',
  icon text not null default 'default',
  color text,
  required_level integer not null default 1,
  allowed_tags text[] not null default '{}'::text[],
  target_department text[] not null default '{}'::text[],
  target_position text[] not null default '{}'::text[],
  is_active boolean not null default true,
  is_featured boolean not null default false,
  priority integer not null default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portal_apps_active_priority
  on public.portal_apps (is_active, priority, app_name);

create index if not exists idx_portal_apps_category_priority
  on public.portal_apps (category, priority, app_name);

alter table public.portal_apps enable row level security;

grant select, insert, update, delete on table public.portal_apps to service_role;
