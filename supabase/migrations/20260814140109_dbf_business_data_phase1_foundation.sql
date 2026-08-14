-- DBF Business Facts MVP / Phase 1 foundation.
-- Additive, forward-only, Staging-first migration.
--
-- Canonical company/store UUIDs are verified by the import runtime against the
-- NOV HUB canonical master API and recorded in dbf_ingest.entity_mappings.
-- The Staging core identity tables may legitimately be empty while SOCE master
-- population is incomplete, so Phase 1 facts intentionally do not depend on
-- local core.* identity foreign keys. This avoids creating a DBF-owned master.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regnamespace('dbf_ingest') is not null
     or to_regclass('public.dbf_pl_detail_facts') is not null
     or to_regclass('public.dbf_pl_aggregate_facts') is not null
     or to_regclass('public.dbf_bs_facts') is not null
     or to_regclass('public.dbf_store_monthly_metric_facts') is not null
     or to_regclass('public.dbf_budget_facts') is not null
     or to_regclass('dbf_ingest.source_files') is not null
     or to_regclass('dbf_ingest.import_batches') is not null
     or to_regclass('dbf_ingest.raw_rows') is not null
     or to_regclass('dbf_ingest.entity_mappings') is not null
     or to_regclass('dbf_ingest.staging_rows') is not null
     or to_regclass('dbf_ingest.validation_issues') is not null
     or to_regclass('dbf_ingest.import_events') is not null
     or to_regclass('dbf_ingest.metric_definitions') is not null then
    raise exception 'DBF Phase 1 foundation object already exists; refusing partial or duplicate apply';
  end if;
end
$$;

create schema dbf_ingest;
revoke all on schema dbf_ingest from public, anon, authenticated;

create table dbf_ingest.source_files (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  original_file_name text not null check (btrim(original_file_name) <> ''),
  media_type text not null check (btrim(media_type) <> ''),
  source_system text not null check (btrim(source_system) <> ''),
  received_at timestamptz not null default statement_timestamp(),
  received_by_employee_id uuid not null,
  received_via text not null default 'nov_hub_secure_session'
    check (received_via = 'nov_hub_secure_session'),
  unique (source_system, sha256, byte_size)
);

comment on column dbf_ingest.source_files.received_by_employee_id is
  'Canonical NOV HUB employee UUID from the verified secure-session envelope; no local employee population is required.';

create table dbf_ingest.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references dbf_ingest.source_files(id) on delete restrict,
  fact_kind text not null check (fact_kind in ('pl','bs','store_operating_result','budget')),
  fiscal_month date not null check (fiscal_month = date_trunc('month', fiscal_month)::date),
  source_type text not null check (btrim(source_type) <> ''),
  status text not null default 'received' check (status in (
    'received','parsed','mapping_required','validated_with_warnings','validation_failed',
    'owner_review','approved','promoted','rejected','superseded','rolled_back'
  )),
  revision integer not null default 1 check (revision > 0),
  correction_of_batch_id uuid references dbf_ingest.import_batches(id) on delete restrict,
  correction_reason text,
  created_by_employee_id uuid not null,
  approved_by_employee_id uuid,
  approved_at timestamptz,
  promoted_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check ((revision = 1 and correction_of_batch_id is null)
    or (revision > 1 and correction_of_batch_id is not null)),
  check (correction_of_batch_id is null or correction_reason is not null),
  check ((status in ('approved','promoted') and approved_by_employee_id is not null and approved_at is not null)
    or status not in ('approved','promoted')),
  unique (source_file_id, fact_kind, fiscal_month, source_type)
);

create unique index dbf_import_batches_correction_once_idx
  on dbf_ingest.import_batches (correction_of_batch_id)
  where correction_of_batch_id is not null;

create table dbf_ingest.raw_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references dbf_ingest.import_batches(id) on delete restrict,
  source_row_number integer not null check (source_row_number > 0),
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default statement_timestamp(),
  unique (batch_id, source_row_number)
);

create table dbf_ingest.entity_mappings (
  id uuid primary key default gen_random_uuid(),
  source_system text not null check (btrim(source_system) <> ''),
  entity_type text not null check (entity_type in ('company','store','employee','organization')),
  source_key text not null check (btrim(source_key) <> ''),
  source_label text,
  company_id uuid,
  store_id uuid,
  employee_id uuid,
  organization_id uuid,
  canonical_source text not null default 'nov_hub_master_api'
    check (canonical_source = 'nov_hub_master_api'),
  canonical_evidence_sha256 text check (canonical_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'quarantined' check (status in ('active','quarantined','retired')),
  confirmed_by_employee_id uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (
    (status = 'quarantined'
      and num_nonnulls(company_id, store_id, employee_id, organization_id) = 0
      and confirmed_by_employee_id is null
      and confirmed_at is null)
    or
    (status in ('active','retired')
      and num_nonnulls(company_id, store_id, employee_id, organization_id) = 1
      and confirmed_by_employee_id is not null
      and confirmed_at is not null
      and canonical_evidence_sha256 is not null)
  ),
  check (
    status = 'quarantined'
    or (entity_type = 'company' and company_id is not null)
    or (entity_type = 'store' and store_id is not null)
    or (entity_type = 'employee' and employee_id is not null)
    or (entity_type = 'organization' and organization_id is not null)
  ),
  check (company_id is null or company_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  check (store_id is null or store_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  check (employee_id is null or employee_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  check (organization_id is null or organization_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  unique (source_system, entity_type, source_key)
);

create table dbf_ingest.staging_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references dbf_ingest.import_batches(id) on delete restrict,
  raw_row_id bigint not null references dbf_ingest.raw_rows(id) on delete restrict,
  company_mapping_id uuid references dbf_ingest.entity_mappings(id) on delete restrict,
  store_mapping_id uuid references dbf_ingest.entity_mappings(id) on delete restrict,
  company_id uuid,
  store_id uuid,
  employee_id uuid,
  organization_id uuid,
  account_code text,
  account_name text,
  metric_code text,
  amount numeric(20,2),
  quantity numeric(20,4),
  rate numeric(18,8),
  source_row_category text not null check (source_row_category in ('detail','aggregate')),
  mapping_status text not null default 'unresolved'
    check (mapping_status in ('unresolved','resolved','quarantined')),
  validation_status text not null default 'pending'
    check (validation_status in ('pending','valid','warning','error','quarantined')),
  normalized_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  check (company_id is null or company_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  check (store_id is null or store_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  check ((mapping_status = 'resolved' and company_mapping_id is not null and company_id is not null)
    or mapping_status <> 'resolved'),
  unique (batch_id, raw_row_id)
);

create table dbf_ingest.validation_issues (
  id bigint generated always as identity primary key,
  batch_id uuid not null references dbf_ingest.import_batches(id) on delete restrict,
  staging_row_id bigint references dbf_ingest.staging_rows(id) on delete restrict,
  severity text not null check (severity in ('error','warning')),
  rule_code text not null check (btrim(rule_code) <> ''),
  field_name text,
  sanitized_message text not null check (btrim(sanitized_message) <> ''),
  created_at timestamptz not null default statement_timestamp()
);

create table dbf_ingest.import_events (
  id bigint generated always as identity primary key,
  batch_id uuid not null references dbf_ingest.import_batches(id) on delete restrict,
  event_type text not null check (btrim(event_type) <> ''),
  from_status text,
  to_status text,
  actor_employee_id uuid not null,
  reason_code text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp()
);

create table dbf_ingest.metric_definitions (
  metric_code text not null,
  definition_version text not null check (btrim(definition_version) <> ''),
  value_kind text not null check (value_kind in ('amount','quantity','rate')),
  display_name text not null check (btrim(display_name) <> ''),
  description text not null check (btrim(description) <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  primary key (metric_code, definition_version),
  check (metric_code in (
    'TOTAL_SALES','TECHNICAL_SALES','RETAIL_SALES','MID_SALES','EC_ALLOCATED_SALES',
    'TOTAL_CUSTOMERS','NEW_CUSTOMERS','EXISTING_CUSTOMERS','TOTAL_UNIT_PRICE',
    'TECHNICAL_UNIT_PRICE','TOTAL_REPEAT_RATE','NEW_REPEAT_RATE','SECOND_REPEAT_RATE',
    'THIRD_REPEAT_RATE','FIXED_REPEAT_RATE','TOTAL_PRODUCTIVITY','TECHNICAL_PRODUCTIVITY',
    'RETAIL_PURCHASE_RATE','OPERATING_PROFIT'
  ))
);

create index dbf_import_batches_month_kind_status_idx
  on dbf_ingest.import_batches (fiscal_month, fact_kind, status);
create index dbf_staging_rows_batch_validation_idx
  on dbf_ingest.staging_rows (batch_id, validation_status);
create index dbf_staging_rows_batch_mapping_idx
  on dbf_ingest.staging_rows (batch_id, mapping_status);
create index dbf_validation_issues_batch_severity_idx
  on dbf_ingest.validation_issues (batch_id, severity);
create index dbf_import_events_batch_created_idx
  on dbf_ingest.import_events (batch_id, created_at);

create table public.dbf_pl_detail_facts (
  id uuid primary key default gen_random_uuid(),
  fiscal_month date not null check (fiscal_month = date_trunc('month', fiscal_month)::date),
  company_id uuid not null check (company_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  store_id uuid check (store_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  account_code text not null check (btrim(account_code) <> ''),
  account_name text not null check (btrim(account_name) <> ''),
  amount numeric(20,2) not null,
  source_type text not null check (btrim(source_type) <> ''),
  source_file_id uuid not null references dbf_ingest.source_files(id) on delete restrict,
  batch_id uuid not null references dbf_ingest.import_batches(id) on delete restrict,
  imported_at timestamptz not null default statement_timestamp(),
  imported_by_employee_id uuid not null,
  version integer not null check (version > 0),
  status text not null check (status in ('provisional','confirmed')),
  is_active boolean not null default true,
  superseded_at timestamptz,
  correction_of_fact_id uuid references public.dbf_pl_detail_facts(id) on delete restrict,
  correction_reason text,
  check ((version = 1 and correction_of_fact_id is null)
    or (version > 1 and correction_of_fact_id is not null)),
  check (correction_of_fact_id is null or correction_reason is not null),
  check ((is_active and superseded_at is null) or (not is_active and superseded_at is not null))
);

create table public.dbf_pl_aggregate_facts (
  id uuid primary key default gen_random_uuid(),
  fiscal_month date not null check (fiscal_month = date_trunc('month', fiscal_month)::date),
  company_id uuid not null check (company_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  aggregate_scope text not null check (aggregate_scope in ('head_office','company_total')),
  account_code text not null check (btrim(account_code) <> ''),
  account_name text not null check (btrim(account_name) <> ''),
  amount numeric(20,2) not null,
  source_type text not null check (btrim(source_type) <> ''),
  source_file_id uuid not null references dbf_ingest.source_files(id) on delete restrict,
  batch_id uuid not null references dbf_ingest.import_batches(id) on delete restrict,
  imported_at timestamptz not null default statement_timestamp(),
  imported_by_employee_id uuid not null,
  version integer not null check (version > 0),
  status text not null check (status in ('provisional','confirmed')),
  is_active boolean not null default true,
  superseded_at timestamptz,
  correction_of_fact_id uuid references public.dbf_pl_aggregate_facts(id) on delete restrict,
  correction_reason text,
  check ((version = 1 and correction_of_fact_id is null)
    or (version > 1 and correction_of_fact_id is not null)),
  check (correction_of_fact_id is null or correction_reason is not null),
  check ((is_active and superseded_at is null) or (not is_active and superseded_at is not null))
);

create table public.dbf_bs_facts (
  id uuid primary key default gen_random_uuid(),
  fiscal_month date not null check (fiscal_month = date_trunc('month', fiscal_month)::date),
  company_id uuid not null check (company_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  account_code text not null check (btrim(account_code) <> ''),
  account_name text not null check (btrim(account_name) <> ''),
  amount numeric(20,2) not null,
  classification text not null check (classification in ('asset','liability','equity')),
  source_file_id uuid not null references dbf_ingest.source_files(id) on delete restrict,
  batch_id uuid not null references dbf_ingest.import_batches(id) on delete restrict,
  imported_at timestamptz not null default statement_timestamp(),
  imported_by_employee_id uuid not null,
  version integer not null check (version > 0),
  status text not null check (status in ('provisional','confirmed')),
  is_active boolean not null default true,
  superseded_at timestamptz,
  correction_of_fact_id uuid references public.dbf_bs_facts(id) on delete restrict,
  correction_reason text,
  check ((version = 1 and correction_of_fact_id is null)
    or (version > 1 and correction_of_fact_id is not null)),
  check (correction_of_fact_id is null or correction_reason is not null),
  check ((is_active and superseded_at is null) or (not is_active and superseded_at is not null))
);

create table public.dbf_store_monthly_metric_facts (
  id uuid primary key default gen_random_uuid(),
  fiscal_month date not null check (fiscal_month = date_trunc('month', fiscal_month)::date),
  company_id uuid not null check (company_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  store_id uuid not null check (store_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  metric_code text not null,
  amount numeric(20,2),
  quantity numeric(20,4),
  rate numeric(18,8),
  definition_version text not null,
  source_type text not null check (btrim(source_type) <> ''),
  source_file_id uuid not null references dbf_ingest.source_files(id) on delete restrict,
  batch_id uuid not null references dbf_ingest.import_batches(id) on delete restrict,
  imported_at timestamptz not null default statement_timestamp(),
  imported_by_employee_id uuid not null,
  version integer not null check (version > 0),
  status text not null check (status in ('provisional','confirmed')),
  is_active boolean not null default true,
  superseded_at timestamptz,
  correction_of_fact_id uuid references public.dbf_store_monthly_metric_facts(id) on delete restrict,
  correction_reason text,
  foreign key (metric_code, definition_version)
    references dbf_ingest.metric_definitions(metric_code, definition_version) on delete restrict,
  check (num_nonnulls(amount, quantity, rate) = 1),
  check ((version = 1 and correction_of_fact_id is null)
    or (version > 1 and correction_of_fact_id is not null)),
  check (correction_of_fact_id is null or correction_reason is not null),
  check ((is_active and superseded_at is null) or (not is_active and superseded_at is not null))
);

create table public.dbf_budget_facts (
  id uuid primary key default gen_random_uuid(),
  fiscal_month date not null check (fiscal_month = date_trunc('month', fiscal_month)::date),
  company_id uuid not null check (company_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  store_id uuid check (store_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  organization_id uuid check (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  scenario_code text not null check (btrim(scenario_code) <> ''),
  account_code text,
  metric_code text,
  amount numeric(20,2) not null,
  source_file_id uuid not null references dbf_ingest.source_files(id) on delete restrict,
  batch_id uuid not null references dbf_ingest.import_batches(id) on delete restrict,
  imported_at timestamptz not null default statement_timestamp(),
  imported_by_employee_id uuid not null,
  version integer not null check (version > 0),
  status text not null check (status in ('provisional','confirmed')),
  is_active boolean not null default true,
  superseded_at timestamptz,
  correction_of_fact_id uuid references public.dbf_budget_facts(id) on delete restrict,
  correction_reason text,
  check (num_nonnulls(account_code, metric_code) = 1),
  check (account_code is null or btrim(account_code) <> ''),
  check (metric_code is null or btrim(metric_code) <> ''),
  check ((version = 1 and correction_of_fact_id is null)
    or (version > 1 and correction_of_fact_id is not null)),
  check (correction_of_fact_id is null or correction_reason is not null),
  check ((is_active and superseded_at is null) or (not is_active and superseded_at is not null))
);

create unique index dbf_pl_detail_active_grain
  on public.dbf_pl_detail_facts (
    fiscal_month, company_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), account_code
  ) where is_active;
create unique index dbf_pl_detail_version_grain
  on public.dbf_pl_detail_facts (
    fiscal_month, company_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), account_code, version
  );
create unique index dbf_pl_detail_correction_once
  on public.dbf_pl_detail_facts (correction_of_fact_id) where correction_of_fact_id is not null;

create unique index dbf_pl_aggregate_active_grain
  on public.dbf_pl_aggregate_facts (fiscal_month, company_id, aggregate_scope, account_code)
  where is_active;
create unique index dbf_pl_aggregate_version_grain
  on public.dbf_pl_aggregate_facts (fiscal_month, company_id, aggregate_scope, account_code, version);
create unique index dbf_pl_aggregate_correction_once
  on public.dbf_pl_aggregate_facts (correction_of_fact_id) where correction_of_fact_id is not null;

create unique index dbf_bs_active_grain
  on public.dbf_bs_facts (fiscal_month, company_id, account_code) where is_active;
create unique index dbf_bs_version_grain
  on public.dbf_bs_facts (fiscal_month, company_id, account_code, version);
create unique index dbf_bs_correction_once
  on public.dbf_bs_facts (correction_of_fact_id) where correction_of_fact_id is not null;

create unique index dbf_store_metric_active_grain
  on public.dbf_store_monthly_metric_facts (fiscal_month, company_id, store_id, metric_code)
  where is_active;
create unique index dbf_store_metric_version_grain
  on public.dbf_store_monthly_metric_facts (fiscal_month, company_id, store_id, metric_code, version);
create unique index dbf_store_metric_correction_once
  on public.dbf_store_monthly_metric_facts (correction_of_fact_id) where correction_of_fact_id is not null;

create unique index dbf_budget_active_grain
  on public.dbf_budget_facts (
    fiscal_month, company_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    scenario_code, coalesce(account_code, ''), coalesce(metric_code, '')
  ) where is_active;
create unique index dbf_budget_version_grain
  on public.dbf_budget_facts (
    fiscal_month, company_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    scenario_code, coalesce(account_code, ''), coalesce(metric_code, ''), version
  );
create unique index dbf_budget_correction_once
  on public.dbf_budget_facts (correction_of_fact_id) where correction_of_fact_id is not null;

create index dbf_pl_detail_batch_idx on public.dbf_pl_detail_facts (batch_id);
create index dbf_pl_detail_source_idx on public.dbf_pl_detail_facts (source_file_id);
create index dbf_pl_aggregate_batch_idx on public.dbf_pl_aggregate_facts (batch_id);
create index dbf_pl_aggregate_source_idx on public.dbf_pl_aggregate_facts (source_file_id);
create index dbf_bs_batch_idx on public.dbf_bs_facts (batch_id);
create index dbf_bs_source_idx on public.dbf_bs_facts (source_file_id);
create index dbf_store_metric_batch_idx on public.dbf_store_monthly_metric_facts (batch_id);
create index dbf_store_metric_source_idx on public.dbf_store_monthly_metric_facts (source_file_id);
create index dbf_budget_batch_idx on public.dbf_budget_facts (batch_id);
create index dbf_budget_source_idx on public.dbf_budget_facts (source_file_id);

alter table public.dbf_pl_detail_facts enable row level security;
alter table public.dbf_pl_detail_facts force row level security;
alter table public.dbf_pl_aggregate_facts enable row level security;
alter table public.dbf_pl_aggregate_facts force row level security;
alter table public.dbf_bs_facts enable row level security;
alter table public.dbf_bs_facts force row level security;
alter table public.dbf_store_monthly_metric_facts enable row level security;
alter table public.dbf_store_monthly_metric_facts force row level security;
alter table public.dbf_budget_facts enable row level security;
alter table public.dbf_budget_facts force row level security;
alter table dbf_ingest.source_files enable row level security;
alter table dbf_ingest.source_files force row level security;
alter table dbf_ingest.import_batches enable row level security;
alter table dbf_ingest.import_batches force row level security;
alter table dbf_ingest.raw_rows enable row level security;
alter table dbf_ingest.raw_rows force row level security;
alter table dbf_ingest.entity_mappings enable row level security;
alter table dbf_ingest.entity_mappings force row level security;
alter table dbf_ingest.staging_rows enable row level security;
alter table dbf_ingest.staging_rows force row level security;
alter table dbf_ingest.validation_issues enable row level security;
alter table dbf_ingest.validation_issues force row level security;
alter table dbf_ingest.import_events enable row level security;
alter table dbf_ingest.import_events force row level security;
alter table dbf_ingest.metric_definitions enable row level security;
alter table dbf_ingest.metric_definitions force row level security;

revoke all on schema dbf_ingest from public, anon, authenticated;
revoke all on all tables in schema dbf_ingest from public, anon, authenticated;
revoke all on all sequences in schema dbf_ingest from public, anon, authenticated;
revoke all on public.dbf_pl_detail_facts, public.dbf_pl_aggregate_facts,
  public.dbf_bs_facts, public.dbf_store_monthly_metric_facts, public.dbf_budget_facts
  from public, anon, authenticated;

grant usage on schema dbf_ingest to service_role;
grant select, insert on dbf_ingest.source_files to service_role;
grant select, insert, update on dbf_ingest.import_batches to service_role;
grant select, insert on dbf_ingest.raw_rows to service_role;
grant select, insert, update on dbf_ingest.entity_mappings to service_role;
grant select, insert, update on dbf_ingest.staging_rows to service_role;
grant select, insert on dbf_ingest.validation_issues to service_role;
grant select, insert on dbf_ingest.import_events to service_role;
grant select, insert, update on dbf_ingest.metric_definitions to service_role;
grant usage, select on all sequences in schema dbf_ingest to service_role;
grant select, insert, update on public.dbf_pl_detail_facts,
  public.dbf_pl_aggregate_facts, public.dbf_bs_facts,
  public.dbf_store_monthly_metric_facts, public.dbf_budget_facts
  to service_role;

comment on schema dbf_ingest is
  'Private DBF ingestion boundary. Browser roles have no schema or table privileges.';
comment on table public.dbf_pl_detail_facts is
  'Canonical monthly P/L detail facts; corporate and head-office aggregate rows are stored separately.';
comment on table public.dbf_pl_aggregate_facts is
  'Canonical monthly P/L aggregate facts for head-office or company totals only.';
comment on table public.dbf_bs_facts is
  'Canonical corporation-level monthly balance-sheet facts.';
comment on table public.dbf_store_monthly_metric_facts is
  'Canonical store monthly operating metrics with definition-version binding.';
comment on table public.dbf_budget_facts is
  'Canonical management budgets, separate from expense-approval workflow budgets.';

-- No browser policies, public grants, promotion RPC, legacy backfill, or data
-- population are included. Promotion and correction transactions are Phase C.

commit;
