-- Phase 8 candidate. DO NOT EXECUTE without the approved staging runbook.
-- Additive only: no store UUID, seed, or existing data mutation appears here.

begin;

create extension if not exists btree_gist;

create table if not exists public.store_operation_history (
  history_id uuid primary key default gen_random_uuid(),
  store_uuid uuid not null references public.stores(id) on delete restrict,
  operating_entity_uuid uuid references public.corporations(id) on delete restrict,
  operation_type text not null check (
    operation_type in (
      'open', 'close', 'transfer', 'rename', 'legal_entity_change',
      'fc_conversion', 'status_correction'
    )
  ),
  effective_from date not null,
  effective_to date,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create index if not exists store_operation_history_store_effective_idx
  on public.store_operation_history (store_uuid, effective_from desc);

alter table public.store_operation_history
  drop constraint if exists store_operation_history_no_overlapping_periods;

alter table public.store_operation_history
  add constraint store_operation_history_no_overlapping_periods
  exclude using gist (
    store_uuid with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  );

create or replace function public.set_store_operation_history_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_store_operation_history_updated_at
  on public.store_operation_history;
create trigger trg_store_operation_history_updated_at
before update on public.store_operation_history
for each row execute function public.set_store_operation_history_updated_at();

alter table public.store_operation_history enable row level security;
revoke all on public.store_operation_history from anon, authenticated;
grant select, insert, update on public.store_operation_history to service_role;

commit;
