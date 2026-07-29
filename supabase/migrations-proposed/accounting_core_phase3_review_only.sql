-- REVIEW ONLY. DO NOT APPLY TO PRODUCTION.
-- Accounting Core Phase 3 PostgreSQL/Supabase design candidate.
begin;

create schema if not exists accounting;
revoke all on schema accounting from public, anon, authenticated;

create type accounting.mapping_status as enum ('unmapped','proposed','approved','rejected','inactive');
create type accounting.version_status as enum (
  'imported','validated','accounting_approved','management_approved',
  'accounting_rejected','management_rejected','published','superseded'
);
create type accounting.version_type as enum ('draft','revision','final','rollback_restore');
create type accounting.validation_severity as enum ('info','warning','error','blocking');

create table accounting.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  status text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create table accounting.import_files (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references accounting.import_batches(id),
  source_system text not null,
  file_hash text not null,
  original_file_name text not null,
  storage_object_key text,
  detected_period date,
  publish_block_reason text,
  created_at timestamptz not null default now(),
  unique(source_system,file_hash)
);
create table accounting.entity_mappings (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_entity_name text not null,
  fiscal_year integer,
  valid_from date,
  valid_to date,
  scope_type text not null,
  -- IDs reference existing Core masters; do not duplicate them here.
  legal_entity_id uuid references public.corporations(id),
  store_id uuid references public.stores(id),
  department_id uuid references public.departments(id),
  franchise_company_id uuid,
  status accounting.mapping_status not null,
  proposed_core_uuid uuid,
  approved_by uuid,
  approved_at timestamptz,
  unique nulls not distinct(source_system,source_entity_name,fiscal_year,valid_from),
  check(num_nonnulls(legal_entity_id,store_id,department_id,franchise_company_id) <= 1),
  check(status <> 'approved' or approved_by is not null)
);
create table accounting.account_mappings (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  statement_type text not null check(statement_type in ('bs','pl')),
  section text, source_account_name text not null, parent_context text,
  source_sheet_type text not null, occurrence_context text not null,
  effective_from date, effective_to date,
  normalized_account text, status accounting.mapping_status not null,
  approved_by uuid, approved_at timestamptz,
  unique nulls not distinct (
    source_system,statement_type,section,source_account_name,
    parent_context,source_sheet_type,occurrence_context
  ),
  check(status <> 'approved' or (normalized_account is not null and approved_by is not null))
);
create table accounting.versions (
  id uuid primary key default gen_random_uuid(),
  version_number integer not null check(version_number > 0),
  version_label text not null unique,
  fiscal_year integer not null check(fiscal_year between 2000 and 2200),
  fiscal_month integer not null check(fiscal_month between 1 and 12),
  version_type accounting.version_type not null,
  scope_type text not null,
  scope_id uuid not null,
  prior_version_id uuid references accounting.versions(id),
  supersedes_version_id uuid references accounting.versions(id),
  restore_source_version_id uuid references accounting.versions(id),
  import_file_id uuid not null references accounting.import_files(id),
  status accounting.version_status not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(scope_type,scope_id,fiscal_year,fiscal_month,version_number)
);
create table accounting.raw_values (
  id uuid primary key default gen_random_uuid(),
  import_file_id uuid not null references accounting.import_files(id),
  source_sheet text not null, source_sheet_type text not null,
  source_row integer not null, source_column integer not null,
  source_cell_reference text not null, source_column_label text not null,
  fiscal_year integer not null, detected_period date, source_value_state text not null,
  statement_type text not null, source_entity_name text not null,
  scope_type text not null, source_account_name text not null,
  amount_net numeric, formula text,
  unique(import_file_id,source_sheet,source_row,source_column)
);
create table accounting.facts (
  id uuid primary key default gen_random_uuid(),
  raw_value_id uuid not null references accounting.raw_values(id),
  version_id uuid not null references accounting.versions(id),
  source_file_id uuid not null references accounting.import_files(id),
  normalized_account text not null, entity_id uuid not null,
  scope_type text not null, scope_id uuid not null, period date not null,
  amount_net numeric not null, amount_tax numeric, amount_gross numeric,
  tax_basis text not null check(tax_basis in ('tax_exclusive','tax_inclusive')),
  status text not null,
  unique(version_id,entity_id,period,normalized_account,raw_value_id)
);
create index facts_consumer_lookup on accounting.facts(scope_type,scope_id,period,version_id);
create table accounting.validation_results (
  id uuid primary key default gen_random_uuid(),
  import_file_id uuid not null references accounting.import_files(id),
  version_id uuid references accounting.versions(id),
  code text not null, severity accounting.validation_severity not null,
  source_sheet text, raw_value_id uuid references accounting.raw_values(id),
  masked_message text not null, created_at timestamptz not null default now()
);
create index validation_blocking on accounting.validation_results(version_id)
  where severity='blocking';
create table accounting.approvals (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references accounting.versions(id),
  approval_stage text not null check(approval_stage in ('accounting','management')),
  decision text not null check(decision in ('approved','rejected')),
  reason text not null check(length(btrim(reason)) > 0),
  actor_id uuid not null, created_at timestamptz not null default now()
);
create table accounting.publications (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references accounting.versions(id),
  scope_type text not null, scope_id uuid not null,
  fiscal_year integer not null, fiscal_month integer not null,
  status text not null check(status in ('published','superseded','rolled_back')),
  supersedes_publication_id uuid references accounting.publications(id),
  created_by uuid not null, created_at timestamptz not null default now()
);
create unique index one_active_accounting_publication
  on accounting.publications(scope_type,scope_id,fiscal_year,fiscal_month)
  where status='published';
create table accounting.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null, action text not null, target_type text not null,
  target_id uuid not null, result text not null, reason text not null,
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create or replace function accounting.reject_mutation() returns trigger
language plpgsql set search_path = pg_catalog, accounting as $$
begin raise exception 'append-only or immutable accounting record'; end $$;
create trigger immutable_published_facts before update or delete on accounting.facts
for each row when (old.status='published') execute function accounting.reject_mutation();
create trigger append_only_approvals before update or delete on accounting.approvals
for each row execute function accounting.reject_mutation();
create trigger append_only_audit before update or delete on accounting.audit_logs
for each row execute function accounting.reject_mutation();

create or replace function accounting.capture_status_change() returns trigger
language plpgsql security definer
set search_path = pg_catalog, accounting as $$
begin
  if old.status is distinct from new.status then
    insert into accounting.audit_logs(
      actor_id,action,target_type,target_id,result,reason,metadata
    ) values(
      auth.uid(),'status_changed',tg_table_name,new.id,'success','database status transition',
      jsonb_build_object('from',old.status,'to',new.status)
    );
  end if;
  return new;
end $$;
revoke all on function accounting.capture_status_change() from public,anon,authenticated;
create trigger audit_version_status after update of status on accounting.versions
for each row execute function accounting.capture_status_change();
create trigger audit_publication_status after update of status on accounting.publications
for each row execute function accounting.capture_status_change();

create view accounting.consumer_facts with (security_invoker=true) as
select f.*,p.created_at last_published_at
from accounting.facts f
join accounting.versions v on v.id=f.version_id and v.status='published'
join accounting.publications p on p.version_id=v.id and p.status='published'
where f.status='published';

alter table accounting.import_batches enable row level security;
alter table accounting.import_files enable row level security;
alter table accounting.entity_mappings enable row level security;
alter table accounting.account_mappings enable row level security;
alter table accounting.versions enable row level security;
alter table accounting.raw_values enable row level security;
alter table accounting.facts enable row level security;
alter table accounting.validation_results enable row level security;
alter table accounting.approvals enable row level security;
alter table accounting.publications enable row level security;
alter table accounting.audit_logs enable row level security;

-- Deliberately zero policies: enabled RLS plus no policy is default deny.
-- No direct authenticated policies. Backend functions must derive
-- actor/scope from auth.uid() and server-owned grants, never request JSON.
revoke all on all tables in schema accounting from public, anon, authenticated;
revoke all on all functions in schema accounting from public, anon, authenticated;
grant usage on schema accounting to service_role;
grant select,insert,update on all tables in schema accounting to service_role;
revoke delete on all tables in schema accounting from service_role;

-- Production publish/rollback should be SECURITY DEFINER functions owned by a
-- dedicated NOLOGIN role, with fixed search_path, explicit qualified names,
-- transaction-scoped advisory lock per scope/period, server-resolved actor,
-- validation/mapping/approval rechecks, and an audit row in the same transaction.

rollback; -- Keeps this file review-only even if accidentally executed as a script.
