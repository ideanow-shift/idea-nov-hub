create table if not exists public.master_change_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  changed_by_email text,
  change_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_master_change_logs_table_record
  on public.master_change_logs (table_name, record_id);

create index if not exists idx_master_change_logs_created_at
  on public.master_change_logs (created_at desc);
