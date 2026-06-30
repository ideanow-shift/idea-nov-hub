create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'info',
  title text not null,
  body text not null default '',
  is_active boolean not null default true,
  priority integer not null default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_announcements_active_priority
  on public.announcements (is_active, priority, title);

alter table public.announcements enable row level security;

grant select, insert, update, delete on table public.announcements to service_role;
