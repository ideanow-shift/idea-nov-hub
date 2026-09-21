-- STAGING ONLY: project zgkoofphhivesclehrom. No Production use.
begin;

alter table dbf_ingest.metric_definitions
  drop constraint if exists metric_definitions_metric_code_check;
alter table dbf_ingest.metric_definitions
  add constraint metric_definitions_metric_code_check check (metric_code in (
    'TOTAL_SALES','TECHNICAL_SALES','RETAIL_SALES','MID_SALES','EC_ALLOCATED_SALES',
    'TOTAL_CUSTOMERS','NEW_CUSTOMERS','EXISTING_CUSTOMERS','TOTAL_UNIT_PRICE',
    'TECHNICAL_UNIT_PRICE','TOTAL_REPEAT_RATE','NEW_REPEAT_RATE','SECOND_REPEAT_RATE',
    'THIRD_REPEAT_RATE','FIXED_REPEAT_RATE','TOTAL_PRODUCTIVITY','TECHNICAL_PRODUCTIVITY',
    'RETAIL_PURCHASE_RATE','RETAIL_PURCHASE_CUSTOMER_VISITS','OPERATING_PROFIT'
  ));
insert into dbf_ingest.metric_definitions
  (metric_code, definition_version, value_kind, display_name, description, is_active)
values ('RETAIL_PURCHASE_CUSTOMER_VISITS','POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1',
  'quantity','店販購買客数',
  'POS monthly report retail-row customer-count quantity. Zero is measured; NULL is missing.',true)
on conflict (metric_code, definition_version) do nothing;

create table if not exists dbf_ingest.company_repeat_rate_staging_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references dbf_ingest.store_repeat_rate_import_batches(id) on delete restrict,
  source_file_id uuid not null references dbf_ingest.store_repeat_rate_source_files(id) on delete restrict,
  row_ordinal integer not null check (row_ordinal > 0),
  scope_type text not null check (scope_type = 'COMPANY_TOTAL'),
  source_company_no text not null check (btrim(source_company_no) <> ''),
  company_id uuid references core.corporation_identities(corporation_id) on delete restrict,
  visit_month date not null check (visit_month = date_trunc('month',visit_month)::date),
  calculation_month date not null,
  horizon_months smallint not null check (horizon_months = 4),
  customer_segment text not null check (customer_segment in ('TOTAL','NEW','RETURNING','SEMI_FIXED','FIXED')),
  definition_version text not null check (definition_version = 'POS_REPEAT_COHORT_4M_CUMULATIVE_V1'),
  denominator_visit_count integer not null check (denominator_visit_count >= 0),
  numerator_cumulative_repeat_count integer not null,
  pos_display_rate numeric(18,12) not null,
  exact_rate numeric(18,12),
  mapping_status text not null check (mapping_status in ('unresolved','resolved','quarantined')),
  validation_status text not null check (validation_status in ('pending','valid','warning','error','quarantined')),
  issue_code text,
  raw_payload_sha256 text not null check (raw_payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default statement_timestamp(),
  check (calculation_month = (visit_month + interval '4 months')::date),
  check (numerator_cumulative_repeat_count between 0 and denominator_visit_count),
  check ((mapping_status='resolved' and company_id is not null)
    or (mapping_status<>'resolved' and company_id is null)),
  check ((denominator_visit_count=0 and numerator_cumulative_repeat_count=0
      and exact_rate is null and pos_display_rate=0)
    or (denominator_visit_count>0 and exact_rate between 0 and 1
      and abs(exact_rate-numerator_cumulative_repeat_count::numeric/denominator_visit_count::numeric)<=0.000000000001
      and pos_display_rate=trunc(exact_rate,3))),
  unique (batch_id,row_ordinal),
  unique (batch_id,source_company_no,visit_month,customer_segment,definition_version)
);

create table if not exists public.dbf_company_monthly_repeat_rate_facts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.corporation_identities(corporation_id) on delete restrict,
  source_company_no text not null check (btrim(source_company_no) <> ''),
  visit_month date not null check (visit_month=date_trunc('month',visit_month)::date),
  calculation_month date not null,
  horizon_months smallint not null check (horizon_months=4),
  customer_segment text not null check (customer_segment in ('TOTAL','NEW','RETURNING','SEMI_FIXED','FIXED')),
  definition_version text not null check (definition_version='POS_REPEAT_COHORT_4M_CUMULATIVE_V1'),
  denominator_visit_count integer not null check (denominator_visit_count>=0),
  numerator_cumulative_repeat_count integer not null,
  pos_display_rate numeric(18,12) not null,
  exact_rate numeric(18,12),
  source_file_id uuid not null references dbf_ingest.store_repeat_rate_source_files(id) on delete restrict,
  batch_id uuid not null references dbf_ingest.store_repeat_rate_import_batches(id) on delete restrict,
  imported_by_employee_id uuid not null,
  imported_at timestamptz not null default statement_timestamp(),
  version integer not null check (version>0),
  status text not null check (status in ('provisional','confirmed')),
  is_active boolean not null default true,
  superseded_at timestamptz,
  correction_of_fact_id uuid references public.dbf_company_monthly_repeat_rate_facts(id) on delete restrict,
  correction_reason text,
  check (calculation_month=(visit_month+interval '4 months')::date),
  check (numerator_cumulative_repeat_count between 0 and denominator_visit_count),
  check ((version=1 and correction_of_fact_id is null)
    or (version>1 and correction_of_fact_id is not null and btrim(correction_reason)<>'')),
  check ((is_active and superseded_at is null) or (not is_active and superseded_at is not null)),
  check ((denominator_visit_count=0 and numerator_cumulative_repeat_count=0
      and exact_rate is null and pos_display_rate=0)
    or (denominator_visit_count>0 and exact_rate between 0 and 1
      and abs(exact_rate-numerator_cumulative_repeat_count::numeric/denominator_visit_count::numeric)<=0.000000000001
      and pos_display_rate=trunc(exact_rate,3)))
);
create unique index if not exists dbf_company_repeat_active_grain_idx
  on public.dbf_company_monthly_repeat_rate_facts
  (company_id,visit_month,customer_segment,definition_version) where is_active;
create unique index if not exists dbf_company_repeat_version_grain_idx
  on public.dbf_company_monthly_repeat_rate_facts
  (company_id,visit_month,customer_segment,definition_version,version);
create unique index if not exists dbf_company_repeat_correction_once_idx
  on public.dbf_company_monthly_repeat_rate_facts(correction_of_fact_id)
  where correction_of_fact_id is not null;

create table if not exists public.dbf_company_monthly_retail_purchase_facts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.corporation_identities(corporation_id) on delete restrict,
  source_company_no text not null check (btrim(source_company_no) <> ''),
  fiscal_month date not null check (fiscal_month=date_trunc('month',fiscal_month)::date),
  metric_code text not null check (metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS'),
  definition_version text not null check (definition_version='POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1'),
  quantity numeric(20,4) not null check (quantity>=0),
  total_customer_visits_for_validation numeric(20,4)
    check (total_customer_visits_for_validation is null or total_customer_visits_for_validation>=quantity),
  retail_purchase_rate_exact_candidate numeric(18,12),
  source_file_id uuid not null references dbf_ingest.source_files(id) on delete restrict,
  batch_id uuid not null references dbf_ingest.import_batches(id) on delete restrict,
  imported_by_employee_id uuid not null,
  imported_at timestamptz not null default statement_timestamp(),
  version integer not null check (version>0),
  status text not null check (status in ('provisional','confirmed')),
  is_active boolean not null default true,
  superseded_at timestamptz,
  correction_of_fact_id uuid references public.dbf_company_monthly_retail_purchase_facts(id) on delete restrict,
  correction_reason text,
  check ((((total_customer_visits_for_validation is null) or total_customer_visits_for_validation=0)
      and retail_purchase_rate_exact_candidate is null)
    or (total_customer_visits_for_validation>0 and retail_purchase_rate_exact_candidate between 0 and 1
      and abs(retail_purchase_rate_exact_candidate-quantity/total_customer_visits_for_validation)<=0.000000000001)),
  check ((version=1 and correction_of_fact_id is null)
    or (version>1 and correction_of_fact_id is not null and btrim(correction_reason)<>'')),
  check ((is_active and superseded_at is null) or (not is_active and superseded_at is not null))
);
create unique index if not exists dbf_company_retail_purchase_active_grain_idx
  on public.dbf_company_monthly_retail_purchase_facts
  (company_id,fiscal_month,metric_code,definition_version) where is_active;
create unique index if not exists dbf_company_retail_purchase_version_grain_idx
  on public.dbf_company_monthly_retail_purchase_facts
  (company_id,fiscal_month,metric_code,definition_version,version);
create unique index if not exists dbf_company_retail_purchase_correction_once_idx
  on public.dbf_company_monthly_retail_purchase_facts(correction_of_fact_id)
  where correction_of_fact_id is not null;

alter table dbf_ingest.company_repeat_rate_staging_rows enable row level security;
alter table dbf_ingest.company_repeat_rate_staging_rows force row level security;
alter table public.dbf_company_monthly_repeat_rate_facts enable row level security;
alter table public.dbf_company_monthly_repeat_rate_facts force row level security;
alter table public.dbf_company_monthly_retail_purchase_facts enable row level security;
alter table public.dbf_company_monthly_retail_purchase_facts force row level security;
revoke all on dbf_ingest.company_repeat_rate_staging_rows from public,anon,authenticated,service_role;
revoke all on public.dbf_company_monthly_repeat_rate_facts from public,anon,authenticated,service_role;
revoke all on public.dbf_company_monthly_retail_purchase_facts from public,anon,authenticated,service_role;
revoke all on sequence dbf_ingest.company_repeat_rate_staging_rows_id_seq from public,anon,authenticated,service_role;
comment on table public.dbf_company_monthly_repeat_rate_facts is
  'Company total repeat facts keyed by segment. RETURNING/SEMI_FIXED are not remapped and STORE rows are separate.';
comment on table public.dbf_company_monthly_retail_purchase_facts is
  'Company total retail purchase customer quantities. Never add these rows to SALON totals.';
commit;
