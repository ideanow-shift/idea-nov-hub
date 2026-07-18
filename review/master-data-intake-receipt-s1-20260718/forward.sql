begin;

create table public.master_data_intake_receipts (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  client_request_id uuid not null,
  file_digest text not null,
  preview_digest text not null,
  status text not null default 'pending',
  result_summary jsonb not null default '{}'::jsonb,
  actor_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint master_data_intake_receipts_target_check
    check (target in ('employees', 'stores', 'corporations')),
  constraint master_data_intake_receipts_file_digest_check
    check (file_digest ~ '^[0-9a-f]{64}$'),
  constraint master_data_intake_receipts_preview_digest_check
    check (preview_digest ~ '^[0-9a-f]{64}$'),
  constraint master_data_intake_receipts_status_check
    check (status in ('pending', 'succeeded')),
  constraint master_data_intake_receipts_result_summary_check
    check (jsonb_typeof(result_summary) = 'object'),
  constraint master_data_intake_receipts_completion_check
    check (
      (status = 'pending' and completed_at is null)
      or (status = 'succeeded' and completed_at is not null)
    ),
  constraint master_data_intake_receipts_client_request_key
    unique (client_request_id),
  constraint master_data_intake_receipts_target_file_key
    unique (target, file_digest)
);

alter table public.master_data_intake_receipts enable row level security;

revoke all on table public.master_data_intake_receipts from public, anon, authenticated;

commit;
