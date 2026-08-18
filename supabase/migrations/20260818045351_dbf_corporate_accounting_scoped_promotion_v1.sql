-- Corporate Accounting Scoped Promotion Contract v1.
-- Pilot 2026-06 only. Additive, forward-only and fail-close.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.dbf_pl_detail_facts
  add column row_semantics text check (row_semantics is null or row_semantics = 'POSTABLE_DETAIL'),
  add column is_additive boolean;
alter table public.dbf_pl_aggregate_facts
  add column row_semantics text check (row_semantics is null or row_semantics = 'CONTROL_TOTAL'),
  add column is_additive boolean;
alter table public.dbf_bs_facts
  add column row_semantics text check (row_semantics is null or row_semantics in ('POSTABLE_DETAIL','CONTROL_TOTAL')),
  add column is_additive boolean;

create table dbf_ingest.corporate_accounting_approval_receipts (
  approval_receipt_id uuid primary key default gen_random_uuid(),
  scope_code text not null check (scope_code = 'CORPORATE_ACCOUNTING_ACTUAL_V1'),
  fiscal_month date not null check (fiscal_month = date '2026-06-01'),
  company_id uuid not null check (company_id = 'e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid),
  manifest_ref text not null check (manifest_ref ~ '^[0-9a-f]{64}$'),
  selected_row_digest text not null check (selected_row_digest ~ '^[0-9a-f]{64}$'),
  mapping_version text not null,
  approval_scope_digest text not null check (approval_scope_digest ~ '^[0-9a-f]{64}$'),
  mapping_digest text not null check (mapping_digest ~ '^[0-9a-f]{64}$'),
  row_semantics_digest text not null check (row_semantics_digest ~ '^[0-9a-f]{64}$'),
  control_total_digest text not null check (control_total_digest ~ '^[0-9a-f]{64}$'),
  canonical_baseline jsonb not null,
  approved_by_employee_id uuid not null,
  request_id uuid not null unique,
  owner_confirmation boolean not null check (owner_confirmation is true),
  approved_at timestamptz not null default statement_timestamp(),
  unique (scope_code, fiscal_month, company_id, approval_scope_digest)
);

create table dbf_ingest.corporate_accounting_promotion_receipts (
  promotion_receipt_id uuid primary key default gen_random_uuid(),
  scope_code text not null check (scope_code = 'CORPORATE_ACCOUNTING_ACTUAL_V1'),
  idempotency_key text not null unique check (idempotency_key ~ '^[0-9a-f]{64}$'),
  fiscal_month date not null check (fiscal_month = date '2026-06-01'),
  company_id uuid not null check (company_id = 'e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid),
  pl_batch_id uuid not null check (pl_batch_id = '13cb25de-0b76-475a-b718-5f588be447fd'::uuid),
  bs_batch_id uuid not null check (bs_batch_id = '0ffccfd2-1a39-404a-a41d-b16127ea9008'::uuid),
  manifest_ref text not null check (manifest_ref ~ '^[0-9a-f]{64}$'),
  selected_row_digest text not null check (selected_row_digest ~ '^[0-9a-f]{64}$'),
  mapping_version text not null,
  mapping_digest text not null check (mapping_digest ~ '^[0-9a-f]{64}$'),
  row_semantics_digest text not null check (row_semantics_digest ~ '^[0-9a-f]{64}$'),
  preview_digest text not null check (preview_digest ~ '^[0-9a-f]{64}$'),
  control_total_digest text not null check (control_total_digest ~ '^[0-9a-f]{64}$'),
  approval_scope_digest text not null check (approval_scope_digest ~ '^[0-9a-f]{64}$'),
  transaction_plan_digest text not null check (transaction_plan_digest ~ '^[0-9a-f]{64}$'),
  pl_detail_count integer not null check (pl_detail_count >= 0),
  pl_aggregate_count integer not null check (pl_aggregate_count >= 0),
  bs_count integer not null check (bs_count >= 0),
  promoted_by_employee_id uuid not null,
  promoted_at timestamptz not null default statement_timestamp()
);

create table dbf_ingest.corporate_accounting_promotion_audit (
  audit_id bigint generated always as identity primary key,
  promotion_receipt_id uuid not null references dbf_ingest.corporate_accounting_promotion_receipts(promotion_receipt_id) on delete restrict,
  event_type text not null check (event_type = 'CORPORATE_ACCOUNTING_PROMOTED'),
  actor_employee_id uuid not null,
  summary jsonb not null check (not (summary ?| array['amount','sourceRow','requestBody','token','session'])),
  occurred_at timestamptz not null default statement_timestamp()
);

create function dbf_ingest.guard_corporate_accounting_receipt_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  raise exception 'DBF_CORPORATE_ACCOUNTING_RECEIPT_APPEND_ONLY';
end $fn$;

create trigger guard_corporate_accounting_approval_receipt_mutation
before update or delete on dbf_ingest.corporate_accounting_approval_receipts
for each row execute function dbf_ingest.guard_corporate_accounting_receipt_mutation();
create trigger guard_corporate_accounting_promotion_receipt_mutation
before update or delete on dbf_ingest.corporate_accounting_promotion_receipts
for each row execute function dbf_ingest.guard_corporate_accounting_receipt_mutation();
create trigger guard_corporate_accounting_promotion_audit_mutation
before update or delete on dbf_ingest.corporate_accounting_promotion_audit
for each row execute function dbf_ingest.guard_corporate_accounting_receipt_mutation();

create function dbf_ingest.guard_corporate_accounting_fact_insert_scope()
returns trigger language plpgsql security invoker set search_path = pg_catalog as $fn$
begin
  if new.batch_id in ('13cb25de-0b76-475a-b718-5f588be447fd'::uuid,'0ffccfd2-1a39-404a-a41d-b16127ea9008'::uuid)
    and coalesce(current_setting('dbf.corporate_accounting_scope',true),'') <> 'CORPORATE_ACCOUNTING_ACTUAL_V1'
  then raise exception 'DBF_GENERIC_PROMOTION_CORPORATE_SCOPE_REJECTED'; end if;
  return new;
end $fn$;
create trigger guard_corporate_pl_detail_insert before insert on public.dbf_pl_detail_facts
for each row execute function dbf_ingest.guard_corporate_accounting_fact_insert_scope();
create trigger guard_corporate_pl_aggregate_insert before insert on public.dbf_pl_aggregate_facts
for each row execute function dbf_ingest.guard_corporate_accounting_fact_insert_scope();
create trigger guard_corporate_bs_insert before insert on public.dbf_bs_facts
for each row execute function dbf_ingest.guard_corporate_accounting_fact_insert_scope();

create function public.dbf_corporate_accounting_promotion_preflight_v1(p_manifest_ref text default null)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, dbf_ingest, accounting as $fn$
declare
  v_total integer; v_unreviewed integer; v_needs integer; v_approved integer; v_excluded integer;
  v_audit integer; v_audit_mismatch integer; v_semantics_missing integer; v_mapping_unapproved integer; v_duplicate integer;
  v_pl_source integer; v_bs_source integer; v_pl_detail integer; v_pl_control integer; v_bs_candidate integer;
  v_pl_aggregate_source integer; v_pl_store_detail_source integer; v_pl_scope_invalid integer;
  v_bs_null_store_source integer; v_bs_scope_invalid integer;
  v_derived integer; v_display integer; v_existing_approval integer; v_matching_approval integer; v_existing_promotion integer;
  v_baseline_pl_detail integer; v_baseline_pl_aggregate integer; v_baseline_bs integer;
  v_baseline_budget integer; v_baseline_store_metrics integer; v_canonical_baseline jsonb;
  v_mapping_version text; v_mapping_digest text; v_semantics_digest text; v_selected_digest text;
  v_control_total_digest text; v_approval_scope_digest text; v_selected_source_ambiguous integer;
  v_control_total_row_count integer; v_control_total_code_count integer;
  v_total_sales numeric; v_technical_sales numeric; v_product_sales numeric; v_ec_sales numeric; v_ordinary_profit numeric;
  v_assets numeric; v_liabilities numeric; v_equity numeric;
  v_base_blockers jsonb := '[]'::jsonb; v_blockers jsonb := '[]'::jsonb;
  v_approval_ready boolean; v_allowed boolean;
begin
  select count(*), count(*) filter(where decision='UNREVIEWED'), count(*) filter(where decision='NEEDS_REVIEW'),
    count(*) filter(where decision in ('APPROVE','EDIT_AND_APPROVE')), count(*) filter(where decision='EXCLUDE'),
    count(*) filter(where row_semantics is null or row_semantics='NEEDS_OWNER_REVIEW'), min(mapping_version)
  into v_total,v_unreviewed,v_needs,v_approved,v_excluded,v_semantics_missing,v_mapping_version
  from dbf_ingest.account_mapping_review_candidates
  where fiscal_month=date '2026-06-01' and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid;

  select count(latest.decision),count(*) filter(where latest.decision is distinct from c.decision)
  into v_audit,v_audit_mismatch
  from dbf_ingest.account_mapping_review_candidates c
  left join lateral (
    select a.decision
    from dbf_ingest.account_mapping_review_audit a
    where a.candidate_id=c.candidate_id and a.decision<>'INITIALIZE'
    order by a.occurred_at desc,a.audit_id desc
    limit 1
  ) latest on true
  where c.fiscal_month=date '2026-06-01'
    and c.company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid;

  select
    count(*) filter(where source_row_category='aggregate' and store_id is null),
    count(*) filter(where source_row_category='detail' and store_id is not null),
    count(*) filter(where source_row_category not in('aggregate','detail')
      or (source_row_category='aggregate' and store_id is not null)
      or (source_row_category='detail' and store_id is null)
      or company_id is distinct from 'e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
      or mapping_status<>'resolved' or validation_status not in('valid','warning')
      or coalesce(normalized_payload->>'confirmationStatus','')<>'confirmed'
      or coalesce(normalized_payload->>'taxBasis','')<>'TAX_EXCLUSIVE')
  into v_pl_aggregate_source,v_pl_store_detail_source,v_pl_scope_invalid
  from dbf_ingest.staging_rows
  where batch_id='13cb25de-0b76-475a-b718-5f588be447fd'::uuid;

  select
    count(*) filter(where store_id is null),
    count(*) filter(where store_id is not null
      or company_id is distinct from 'e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
      or mapping_status<>'resolved' or validation_status not in('valid','warning')
      or coalesce(normalized_payload->>'confirmationStatus','')<>'confirmed'
      or coalesce(normalized_payload->>'taxBasis','')<>'TAX_EXCLUSIVE')
  into v_bs_null_store_source,v_bs_scope_invalid
  from dbf_ingest.staging_rows
  where batch_id='0ffccfd2-1a39-404a-a41d-b16127ea9008'::uuid;

  select count(*) into v_mapping_unapproved
  from dbf_ingest.account_mapping_review_candidates c
  left join accounting.accounts a on a.account_version_id=c.canonical_account_version_id
    and a.status='active' and a.effective_period @> date '2026-06-01'
    and a.statement_type=c.statement_type and a.account_category=c.account_category and a.normal_balance=c.normal_balance
  left join accounting.account_statement_mappings m on m.statement_mapping_version_id=c.statement_mapping_version_id
    and m.status='active' and m.effective_period @> date '2026-06-01' and m.statement_type=c.statement_type
  where c.fiscal_month=date '2026-06-01' and c.company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
    and c.decision in ('APPROVE','EDIT_AND_APPROVE') and (a.account_version_id is null or m.statement_mapping_version_id is null);

  select count(*)-count(distinct (statement_type,canonical_account_id)) into v_duplicate
  from dbf_ingest.account_mapping_review_candidates
  where fiscal_month=date '2026-06-01' and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
    and decision in ('APPROVE','EDIT_AND_APPROVE');

  select coalesce(sum(selected_corporate_row_count) filter(where statement_type='pl'),0),
    coalesce(sum(selected_corporate_row_count) filter(where statement_type='bs'),0),
    count(*) filter(where statement_type='pl' and decision in ('APPROVE','EDIT_AND_APPROVE') and row_semantics='POSTABLE_DETAIL'),
    count(*) filter(where statement_type='pl' and decision in ('APPROVE','EDIT_AND_APPROVE') and row_semantics='CONTROL_TOTAL'),
    count(*) filter(where statement_type='bs' and decision in ('APPROVE','EDIT_AND_APPROVE') and row_semantics in ('POSTABLE_DETAIL','CONTROL_TOTAL')),
    count(*) filter(where row_semantics='DERIVED_SUBTOTAL'),count(*) filter(where row_semantics='DISPLAY_ONLY')
  into v_pl_source,v_bs_source,v_pl_detail,v_pl_control,v_bs_candidate,v_derived,v_display
  from dbf_ingest.account_mapping_review_candidates
  where fiscal_month=date '2026-06-01' and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid;

  select encode(extensions.digest(convert_to(coalesce(string_agg(concat_ws('|',
      statement_type,source_batch_id,source_account_code,decision,canonical_account_id,
      canonical_account_version_id,statement_mapping_version_id,mapping_version,mapping_digest
    ),E'\n' order by statement_type,source_batch_id,source_account_code,candidate_id),''),'UTF8'),'sha256'),'hex'),
    encode(extensions.digest(convert_to(coalesce(string_agg(concat_ws('|',
      candidate_id,row_semantics,is_postable,is_control_total
    ),E'\n' order by statement_type,source_batch_id,source_account_code,candidate_id),''),'UTF8'),'sha256'),'hex')
  into v_mapping_digest,v_semantics_digest
  from dbf_ingest.account_mapping_review_candidates
  where fiscal_month=date '2026-06-01' and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid;

  with selected_rows as (
    select c.statement_type,c.fiscal_month,c.company_id,c.source_batch_id,s.raw_row_id,r.payload_sha256,
      c.source_account_code,c.source_account_name,s.amount,
      coalesce(s.normalized_payload->>'classification','') as bs_classification,
      s.source_row_category,coalesce(s.normalized_payload->>'confirmationStatus','') as confirmation_status,
      coalesce(s.normalized_payload->>'taxBasis','') as tax_basis,
      c.candidate_id,c.decision,c.canonical_account_id,c.canonical_account_version_id,
      c.statement_mapping_version_id,c.row_semantics,c.is_postable,c.is_control_total
    from dbf_ingest.account_mapping_review_candidates c
    join dbf_ingest.staging_rows s on s.batch_id=c.source_batch_id
      and s.account_code=c.source_account_code and s.company_id=c.company_id and s.store_id is null
      and ((c.statement_type='pl' and s.batch_id='13cb25de-0b76-475a-b718-5f588be447fd'::uuid
          and s.source_row_category='aggregate')
        or (c.statement_type='bs' and s.batch_id='0ffccfd2-1a39-404a-a41d-b16127ea9008'::uuid))
    join dbf_ingest.raw_rows r on r.id=s.raw_row_id and r.batch_id=s.batch_id
    where c.fiscal_month=date '2026-06-01'
      and c.company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
      and c.source_batch_id in(
        '13cb25de-0b76-475a-b718-5f588be447fd'::uuid,
        '0ffccfd2-1a39-404a-a41d-b16127ea9008'::uuid
      )
      and c.decision in('APPROVE','EDIT_AND_APPROVE')
      and c.row_semantics in('POSTABLE_DETAIL','CONTROL_TOTAL')
  )
  select encode(extensions.digest(convert_to(coalesce(string_agg(concat_ws('|',
      statement_type,to_char(fiscal_month,'YYYY-MM-DD'),company_id,source_batch_id,
      raw_row_id,payload_sha256,source_account_code,source_account_name,amount::text,
      bs_classification,source_row_category,confirmation_status,tax_basis,candidate_id,decision,
      canonical_account_id,canonical_account_version_id,statement_mapping_version_id,
      row_semantics,is_postable,is_control_total
    ),E'\n' order by statement_type,source_batch_id,source_account_code,candidate_id,raw_row_id),''),'UTF8'),'sha256'),'hex')
  into v_selected_digest
  from selected_rows;

  select count(*) into v_selected_source_ambiguous
  from dbf_ingest.account_mapping_review_candidates c
  where c.fiscal_month=date '2026-06-01'
    and c.company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
    and c.decision in('APPROVE','EDIT_AND_APPROVE')
    and c.row_semantics in('POSTABLE_DETAIL','CONTROL_TOTAL')
    and 1<>(select count(*) from dbf_ingest.staging_rows s
      where s.batch_id=c.source_batch_id and s.account_code=c.source_account_code
        and s.company_id=c.company_id and s.store_id is null
        and ((c.statement_type='pl' and s.batch_id='13cb25de-0b76-475a-b718-5f588be447fd'::uuid
            and s.source_row_category='aggregate')
          or (c.statement_type='bs' and s.batch_id='0ffccfd2-1a39-404a-a41d-b16127ea9008'::uuid)));

  select count(*) into v_existing_approval
  from dbf_ingest.corporate_accounting_approval_receipts
  where scope_code='CORPORATE_ACCOUNTING_ACTUAL_V1' and fiscal_month=date '2026-06-01'
    and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid;
  select count(*) into v_existing_promotion from dbf_ingest.corporate_accounting_promotion_receipts;
  select
    (select count(*) from public.dbf_pl_detail_facts where fiscal_month=date '2026-06-01' and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid),
    (select count(*) from public.dbf_pl_aggregate_facts where fiscal_month=date '2026-06-01' and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid),
    (select count(*) from public.dbf_bs_facts where fiscal_month=date '2026-06-01' and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid),
    (select count(*) from public.dbf_budget_facts where fiscal_month=date '2026-06-01' and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid),
    (select count(*) from public.dbf_store_monthly_metric_facts where fiscal_month=date '2026-06-01' and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid)
  into v_baseline_pl_detail,v_baseline_pl_aggregate,v_baseline_bs,v_baseline_budget,v_baseline_store_metrics;
  v_canonical_baseline:=jsonb_build_object(
    'plDetail',v_baseline_pl_detail,'plAggregate',v_baseline_pl_aggregate,'bs',v_baseline_bs,
    'budget',v_baseline_budget,'storeMetrics',v_baseline_store_metrics
  );
  with control_rows as (
    select c.statement_type,c.proposed_account_code,s.amount,c.candidate_id,s.raw_row_id
    from dbf_ingest.account_mapping_review_candidates c
    join dbf_ingest.staging_rows s on s.batch_id=c.source_batch_id
      and s.account_code=c.source_account_code and s.company_id=c.company_id
    where c.fiscal_month=date '2026-06-01'
      and c.company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
      and c.decision in('APPROVE','EDIT_AND_APPROVE') and c.row_semantics='CONTROL_TOTAL'
      and ((c.statement_type='pl'
          and c.source_batch_id='13cb25de-0b76-475a-b718-5f588be447fd'::uuid
          and s.batch_id='13cb25de-0b76-475a-b718-5f588be447fd'::uuid
          and s.source_row_category='aggregate' and s.store_id is null
          and c.proposed_account_code in('TOTAL_SALES','TECHNICAL_SALES','PRODUCT_SALES','EC_SALES','ORDINARY_PROFIT'))
        or (c.statement_type='bs'
          and c.source_batch_id='0ffccfd2-1a39-404a-a41d-b16127ea9008'::uuid
          and s.batch_id='0ffccfd2-1a39-404a-a41d-b16127ea9008'::uuid
          and s.store_id is null
          and c.proposed_account_code in('TOTAL_ASSETS','TOTAL_LIABILITIES','TOTAL_EQUITY')))
  )
  select count(*),count(distinct proposed_account_code),
    max(amount) filter(where proposed_account_code='TOTAL_SALES'),
    max(amount) filter(where proposed_account_code='TECHNICAL_SALES'),
    max(amount) filter(where proposed_account_code='PRODUCT_SALES'),
    max(amount) filter(where proposed_account_code='EC_SALES'),
    max(amount) filter(where proposed_account_code='ORDINARY_PROFIT'),
    max(amount) filter(where proposed_account_code='TOTAL_ASSETS'),
    max(amount) filter(where proposed_account_code='TOTAL_LIABILITIES'),
    max(amount) filter(where proposed_account_code='TOTAL_EQUITY'),
    encode(extensions.digest(convert_to(coalesce(string_agg(concat_ws('|',
      statement_type,proposed_account_code,amount::text,candidate_id,raw_row_id
    ),E'\n' order by statement_type,proposed_account_code,candidate_id,raw_row_id),''),'UTF8'),'sha256'),'hex')
  into v_control_total_row_count,v_control_total_code_count,
    v_total_sales,v_technical_sales,v_product_sales,v_ec_sales,v_ordinary_profit,
    v_assets,v_liabilities,v_equity,v_control_total_digest
  from control_rows;

  if p_manifest_ref ~ '^[0-9a-f]{64}$' then
    v_approval_scope_digest:=encode(extensions.digest(convert_to(concat_ws('|',
      'CORPORATE_ACCOUNTING_ACTUAL_V1','2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062',
      p_manifest_ref,v_selected_digest,v_mapping_version,v_mapping_digest,v_semantics_digest,
      v_control_total_digest,v_baseline_pl_detail,v_baseline_pl_aggregate,v_baseline_bs,
      v_baseline_budget,v_baseline_store_metrics
    ),'UTF8'),'sha256'),'hex');
  end if;

  select count(*) into v_matching_approval
  from dbf_ingest.corporate_accounting_approval_receipts
  where scope_code='CORPORATE_ACCOUNTING_ACTUAL_V1' and fiscal_month=date '2026-06-01'
    and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
    and manifest_ref=p_manifest_ref and selected_row_digest=v_selected_digest
    and mapping_version=v_mapping_version and mapping_digest=v_mapping_digest
    and row_semantics_digest=v_semantics_digest and control_total_digest=v_control_total_digest
    and canonical_baseline=v_canonical_baseline and approval_scope_digest=v_approval_scope_digest;
  if v_total<>138 or v_unreviewed<>0 or v_needs<>0 or v_approved+v_excluded<>138 or v_audit<138 then v_base_blockers:=v_base_blockers||'"OWNER_REVIEW_INCOMPLETE"'::jsonb; end if;
  if v_audit_mismatch<>0 then v_base_blockers:=v_base_blockers||'"REVIEW_AUDIT_STATE_MISMATCH"'::jsonb; end if;
  if v_semantics_missing<>0 then v_base_blockers:=v_base_blockers||'"ROW_SEMANTICS_INCOMPLETE"'::jsonb; end if;
  if v_mapping_unapproved<>0 or v_approved=0 then v_base_blockers:=v_base_blockers||'"ACCOUNT_MAPPING_UNAPPROVED"'::jsonb; end if;
  if v_pl_source<>71 or v_bs_source<>67 then v_base_blockers:=v_base_blockers||'"SOURCE_SCOPE_COUNT_MISMATCH"'::jsonb; end if;
  if v_pl_aggregate_source<>71 or v_pl_store_detail_source<>781 or v_bs_null_store_source<>67
    or v_pl_scope_invalid<>0 or v_bs_scope_invalid<>0 then v_base_blockers:=v_base_blockers||'"SOURCE_ROW_SCOPE_INVALID"'::jsonb; end if;
  if v_selected_source_ambiguous<>0 then v_base_blockers:=v_base_blockers||'"SELECTED_SOURCE_AMBIGUOUS"'::jsonb; end if;
  if v_duplicate<>0 then v_base_blockers:=v_base_blockers||'"DUPLICATE_CANONICAL_ACCOUNT"'::jsonb; end if;
  if v_control_total_row_count<>8 or v_control_total_code_count<>8 then
    v_base_blockers:=v_base_blockers||'"CONTROL_TOTAL_SOURCE_AMBIGUOUS"'::jsonb;
  elsif (v_total_sales,v_technical_sales,v_product_sales,v_ec_sales,v_ordinary_profit,v_assets,v_liabilities,v_equity)
    is distinct from (88066258::numeric,72040100::numeric,14776957::numeric,1249201::numeric,5704265::numeric,570155249::numeric,213188431::numeric,356966818::numeric)
    or coalesce(v_assets-v_liabilities-v_equity,1)<>0 then v_base_blockers:=v_base_blockers||'"CONTROL_TOTAL_MISMATCH"'::jsonb; end if;
  if p_manifest_ref is null or p_manifest_ref !~ '^[0-9a-f]{64}$' then v_base_blockers:=v_base_blockers||'"MANIFEST_REFERENCE_REQUIRED"'::jsonb; end if;
  if v_existing_promotion<>0 then v_base_blockers:=v_base_blockers||'"ALREADY_PROMOTED"'::jsonb; end if;
  if v_baseline_pl_detail<>0 or v_baseline_pl_aggregate<>0 or v_baseline_bs<>0
    or v_baseline_budget<>0 or v_baseline_store_metrics<>0 then v_base_blockers:=v_base_blockers||'"CANONICAL_BASELINE_NOT_ZERO"'::jsonb; end if;
  v_approval_ready:=jsonb_array_length(v_base_blockers)=0;
  v_blockers:=v_base_blockers;
  if v_approval_ready and v_matching_approval=0 then
    if v_existing_approval=0 then
      v_blockers:=v_blockers||'"APPROVAL_RECEIPT_MISSING"'::jsonb;
    else
      v_blockers:=v_blockers||'"APPROVAL_RECEIPT_STALE"'::jsonb;
    end if;
  end if;
  v_allowed:=jsonb_array_length(v_blockers)=0;
  return jsonb_build_object(
    'scope','CORPORATE_ACCOUNTING_ACTUAL_V1','fiscalMonth','2026-06','companyId','e4059116-bdb3-4e13-9763-bbc77bdfe062',
    'review',jsonb_build_object('total',v_total,'reviewed',v_total-v_unreviewed,'unreviewed',v_unreviewed,'needsReview',v_needs,'approved',v_approved,'excluded',v_excluded,'auditCount',v_audit,'auditMismatchCount',v_audit_mismatch),
    'manifestRef',p_manifest_ref,'mappingVersion',v_mapping_version,'mappingDigest',v_mapping_digest,
    'rowSemanticsDigest',v_semantics_digest,'selectedRowDigest',v_selected_digest,
    'controlTotalDigest',v_control_total_digest,'approvalScopeDigest',v_approval_scope_digest,
    'sourceRows',jsonb_build_object('pl',v_pl_source,'plAggregate',v_pl_aggregate_source,'plStoreDetail',v_pl_store_detail_source,'bs',v_bs_source,'bsNullStore',v_bs_null_store_source),
    'canonicalCandidates',jsonb_build_object('plDetail',case when v_allowed then v_pl_detail else 0 end,'plAggregate',case when v_allowed then v_pl_control else 0 end,'bs',case when v_allowed then v_bs_candidate else 0 end,'budget',0,'storeMetrics',0),
    'excludedSubtotalCount',v_derived,'excludedDisplayOnlyCount',v_display,'duplicateGrainCount',greatest(v_duplicate,0),
    'controlTotals',jsonb_build_object('status',case when v_allowed then 'READY_FOR_EXACT_RECONCILIATION' else 'BLOCKED' end,
      'pl',jsonb_build_object('totalSales',v_total_sales,'technicalSales',v_technical_sales,
        'productSales',v_product_sales,'ecSales',v_ec_sales,'ordinaryProfit',v_ordinary_profit),
      'bs',jsonb_build_object('assets',v_assets,'liabilities',v_liabilities,'equity',v_equity,
        'difference',v_assets-v_liabilities-v_equity)),
    'canonicalBaseline',v_canonical_baseline,'approvalReady',v_approval_ready,
    'existingApprovalReceipt',v_existing_approval,'matchingApprovalReceipt',v_matching_approval,
    'existingPromotionReceipt',v_existing_promotion,
    'idempotencyStatus',case when v_existing_promotion=0 then 'UNUSED' else 'USED' end,
    'promotionAllowed',v_allowed,'blockingReasons',v_blockers);
end $fn$;

create function public.dbf_corporate_accounting_approve_v1(
  p_actor_employee_id uuid,p_request_id uuid,p_manifest_ref text,p_owner_confirmation boolean
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, dbf_ingest, accounting as $fn$
declare
  v_preflight jsonb;
  v_existing dbf_ingest.corporate_accounting_approval_receipts%rowtype;
  v_receipt_id uuid;
begin
  if p_actor_employee_id is null or p_request_id is null then raise exception 'DBF_ACTOR_REQUIRED'; end if;
  if p_owner_confirmation is not true then raise exception 'DBF_OWNER_CONFIRMATION_REQUIRED'; end if;
  if p_manifest_ref !~ '^[0-9a-f]{64}$' then raise exception 'DBF_MANIFEST_REFERENCE_REJECTED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('CORPORATE_ACCOUNTING_ACTUAL_V1|2026-06|e4059116-bdb3-4e13-9763-bbc77bdfe062',0));
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));

  v_preflight:=public.dbf_corporate_accounting_promotion_preflight_v1(p_manifest_ref);
  select * into v_existing
  from dbf_ingest.corporate_accounting_approval_receipts
  where request_id=p_request_id;
  if found then
    if v_existing.scope_code='CORPORATE_ACCOUNTING_ACTUAL_V1'
      and v_existing.fiscal_month=date '2026-06-01'
      and v_existing.company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
      and v_existing.manifest_ref=p_manifest_ref
      and v_existing.selected_row_digest=v_preflight->>'selectedRowDigest'
      and v_existing.mapping_version=v_preflight->>'mappingVersion'
      and v_existing.mapping_digest=v_preflight->>'mappingDigest'
      and v_existing.row_semantics_digest=v_preflight->>'rowSemanticsDigest'
      and v_existing.control_total_digest=v_preflight->>'controlTotalDigest'
      and v_existing.canonical_baseline=v_preflight->'canonicalBaseline'
      and v_existing.approval_scope_digest=v_preflight->>'approvalScopeDigest'
      and v_existing.approved_by_employee_id=p_actor_employee_id then
      return jsonb_build_object('receiptId',v_existing.approval_receipt_id,'status','approved','idempotent',true,
        'approvalScopeDigest',v_existing.approval_scope_digest,'approvedAt',v_existing.approved_at);
    end if;
    raise exception 'DBF_APPROVAL_REQUEST_REUSED';
  end if;

  if coalesce((v_preflight->>'approvalReady')::boolean,false) is not true then
    if v_preflight->'blockingReasons' ? 'REVIEW_AUDIT_STATE_MISMATCH' then raise exception 'REVIEW_AUDIT_STATE_MISMATCH'; end if;
    if v_preflight->'blockingReasons' ? 'CANONICAL_BASELINE_NOT_ZERO' then raise exception 'CANONICAL_BASELINE_NOT_ZERO'; end if;
    if v_preflight->'blockingReasons' ? 'CONTROL_TOTAL_SOURCE_AMBIGUOUS' then raise exception 'CONTROL_TOTAL_SOURCE_AMBIGUOUS'; end if;
    raise exception 'DBF_APPROVAL_PREFLIGHT_REJECTED';
  end if;

  insert into dbf_ingest.corporate_accounting_approval_receipts(
    scope_code,fiscal_month,company_id,manifest_ref,selected_row_digest,mapping_version,
    approval_scope_digest,mapping_digest,row_semantics_digest,control_total_digest,canonical_baseline,
    approved_by_employee_id,request_id,owner_confirmation
  ) values(
    'CORPORATE_ACCOUNTING_ACTUAL_V1',date '2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid,
    p_manifest_ref,v_preflight->>'selectedRowDigest',v_preflight->>'mappingVersion',
    v_preflight->>'approvalScopeDigest',v_preflight->>'mappingDigest',v_preflight->>'rowSemanticsDigest',
    v_preflight->>'controlTotalDigest',v_preflight->'canonicalBaseline',p_actor_employee_id,p_request_id,true
  ) returning approval_receipt_id into v_receipt_id;

  return jsonb_build_object('receiptId',v_receipt_id,'status','approved','idempotent',false,
    'approvalScopeDigest',v_preflight->>'approvalScopeDigest','approvedAt',statement_timestamp());
end $fn$;

create function public.dbf_import_promote_corporate_accounting_v1(
  p_actor_employee_id uuid,p_promotion_scope_id text,p_idempotency_key text,p_manifest_ref text,p_fiscal_month date,p_company_id uuid,
  p_pl_batch_id uuid,p_bs_batch_id uuid,p_source_file_ids jsonb,p_source_file_digests jsonb,p_selected_row_digest text,
  p_mapping_version text,p_mapping_digest text,p_row_semantics_digest text,p_preview_digest text,p_control_total_digest text,
  p_approval_scope_digest text,p_transaction_plan_digest text,p_expected_pl_candidate_count integer,
  p_expected_bs_candidate_count integer,p_expected_canonical_baseline jsonb,p_expected_post_state jsonb
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, dbf_ingest, accounting as $fn$
declare v_preflight jsonb; v_receipt uuid; v_pl_detail integer; v_pl_aggregate integer; v_bs integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('CORPORATE_ACCOUNTING_ACTUAL_V1|2026-06|e4059116-bdb3-4e13-9763-bbc77bdfe062',0));
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key,0));
  if p_actor_employee_id is null or p_promotion_scope_id<>'CORPORATE_ACCOUNTING_ACTUAL_V1'
    or p_fiscal_month<>date '2026-06-01' or p_company_id<>'e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
    or p_pl_batch_id<>'13cb25de-0b76-475a-b718-5f588be447fd'::uuid
    or p_bs_batch_id<>'0ffccfd2-1a39-404a-a41d-b16127ea9008'::uuid then raise exception 'DBF_CORPORATE_SCOPE_REJECTED'; end if;
  if p_idempotency_key !~ '^[0-9a-f]{64}$' or p_manifest_ref !~ '^[0-9a-f]{64}$'
    or p_selected_row_digest !~ '^[0-9a-f]{64}$'
    or p_mapping_digest !~ '^[0-9a-f]{64}$' or p_row_semantics_digest !~ '^[0-9a-f]{64}$'
    or p_preview_digest !~ '^[0-9a-f]{64}$' or p_control_total_digest !~ '^[0-9a-f]{64}$'
    or p_approval_scope_digest !~ '^[0-9a-f]{64}$' or p_transaction_plan_digest !~ '^[0-9a-f]{64}$' then raise exception 'DBF_DIGEST_REJECTED'; end if;
  if exists(select 1 from dbf_ingest.corporate_accounting_promotion_receipts where idempotency_key=p_idempotency_key) then raise exception 'DBF_IDEMPOTENCY_REPLAY'; end if;
  if p_source_file_ids <> '["4b113b1b-db39-4fbf-908f-67f83f712dce","c27acc17-fdd0-4113-90c2-73b646913f99"]'::jsonb
    or p_source_file_digests <> '["997e89c54b12334d3aa477a78aff9487d46042822a5ff9ab0cd9fe0f86f073d1","f18c9464a9a070ff641140178b19532dbd8dd319e739eb2e2bcef325adfda54c"]'::jsonb then raise exception 'DBF_SOURCE_DIGEST_REJECTED'; end if;
  if (select count(*) from dbf_ingest.source_files where (id,sha256) in (
      ('4b113b1b-db39-4fbf-908f-67f83f712dce'::uuid,'997e89c54b12334d3aa477a78aff9487d46042822a5ff9ab0cd9fe0f86f073d1'),
      ('c27acc17-fdd0-4113-90c2-73b646913f99'::uuid,'f18c9464a9a070ff641140178b19532dbd8dd319e739eb2e2bcef325adfda54c')))<>2
    or not exists(select 1 from dbf_ingest.import_batches where id=p_pl_batch_id and source_file_id='c27acc17-fdd0-4113-90c2-73b646913f99'::uuid and fact_kind='pl' and fiscal_month=date '2026-06-01')
    or not exists(select 1 from dbf_ingest.import_batches where id=p_bs_batch_id and source_file_id='c27acc17-fdd0-4113-90c2-73b646913f99'::uuid and fact_kind='bs' and fiscal_month=date '2026-06-01') then raise exception 'DBF_SOURCE_DB_EVIDENCE_REJECTED'; end if;
  v_preflight:=public.dbf_corporate_accounting_promotion_preflight_v1(p_manifest_ref);
  if v_preflight->'blockingReasons' ? 'CONTROL_TOTAL_SOURCE_AMBIGUOUS' then
    raise exception 'CONTROL_TOTAL_SOURCE_AMBIGUOUS';
  end if;
  if exists(select 1 from dbf_ingest.staging_rows where batch_id=p_pl_batch_id
      and (source_row_category not in('aggregate','detail')
        or (source_row_category='aggregate' and store_id is not null)
        or (source_row_category='detail' and store_id is null)
        or company_id is distinct from p_company_id or mapping_status<>'resolved'
        or validation_status not in('valid','warning') or coalesce(normalized_payload->>'confirmationStatus','')<>'confirmed'
        or coalesce(normalized_payload->>'taxBasis','')<>'TAX_EXCLUSIVE'))
    or exists(select 1 from dbf_ingest.staging_rows where batch_id=p_bs_batch_id
      and (store_id is not null or company_id is distinct from p_company_id or mapping_status<>'resolved'
        or validation_status not in('valid','warning') or coalesce(normalized_payload->>'confirmationStatus','')<>'confirmed'
        or coalesce(normalized_payload->>'taxBasis','')<>'TAX_EXCLUSIVE'))
    or (select count(*) from dbf_ingest.staging_rows where batch_id=p_pl_batch_id and source_row_category='aggregate' and store_id is null)<>71
    or (select count(*) from dbf_ingest.staging_rows where batch_id=p_pl_batch_id and source_row_category='detail' and store_id is not null)<>781
    or (select count(*) from dbf_ingest.staging_rows where batch_id=p_bs_batch_id and store_id is null)<>67
    then raise exception 'DBF_SCOPE_LEAKAGE_REJECTED'; end if;
  if coalesce((v_preflight->'canonicalBaseline'->>'plDetail')::integer,0)<>0
    or coalesce((v_preflight->'canonicalBaseline'->>'plAggregate')::integer,0)<>0
    or coalesce((v_preflight->'canonicalBaseline'->>'bs')::integer,0)<>0
    or coalesce((v_preflight->'canonicalBaseline'->>'budget')::integer,0)<>0
    or coalesce((v_preflight->'canonicalBaseline'->>'storeMetrics')::integer,0)<>0
    then raise exception 'CANONICAL_BASELINE_NOT_ZERO'; end if;
  if p_expected_canonical_baseline is distinct from v_preflight->'canonicalBaseline' then raise exception 'DBF_CANONICAL_BASELINE_REJECTED'; end if;
  if v_preflight->'blockingReasons' ? 'REVIEW_AUDIT_STATE_MISMATCH' then raise exception 'REVIEW_AUDIT_STATE_MISMATCH'; end if;
  if v_preflight->'blockingReasons' ? 'APPROVAL_RECEIPT_STALE' then raise exception 'APPROVAL_SCOPE_STALE'; end if;
  if coalesce((v_preflight->>'promotionAllowed')::boolean,false) is not true then raise exception 'DBF_PREFLIGHT_REJECTED'; end if;
  if v_preflight->>'selectedRowDigest'<>p_selected_row_digest or v_preflight->>'mappingVersion'<>p_mapping_version
    or v_preflight->>'mappingDigest'<>p_mapping_digest or v_preflight->>'rowSemanticsDigest'<>p_row_semantics_digest
    or v_preflight->>'controlTotalDigest'<>p_control_total_digest
    or v_preflight->>'approvalScopeDigest'<>p_approval_scope_digest then raise exception 'DBF_STALE_MANIFEST_REJECTED'; end if;
  if not exists(select 1 from dbf_ingest.corporate_accounting_approval_receipts where approval_scope_digest=p_approval_scope_digest
    and scope_code=p_promotion_scope_id and fiscal_month=p_fiscal_month and company_id=p_company_id
    and manifest_ref=p_manifest_ref and selected_row_digest=p_selected_row_digest and mapping_version=p_mapping_version
    and mapping_digest=p_mapping_digest and row_semantics_digest=p_row_semantics_digest
    and control_total_digest=p_control_total_digest and canonical_baseline=p_expected_canonical_baseline)
    then raise exception 'DBF_APPROVAL_SCOPE_REJECTED'; end if;
  perform set_config('dbf.corporate_accounting_scope','CORPORATE_ACCOUNTING_ACTUAL_V1',true);

  insert into public.dbf_pl_detail_facts(fiscal_month,company_id,store_id,account_code,account_name,amount,source_type,source_file_id,batch_id,imported_by_employee_id,version,status,row_semantics,is_additive)
  select p_fiscal_month,c.company_id,null,c.proposed_account_code,c.proposed_account_name,s.amount,b.source_type,b.source_file_id,b.id,p_actor_employee_id,1,'confirmed','POSTABLE_DETAIL',true
  from dbf_ingest.account_mapping_review_candidates c
  join dbf_ingest.staging_rows s on s.batch_id=c.source_batch_id and s.account_code=c.source_account_code and s.company_id=c.company_id
  join dbf_ingest.import_batches b on b.id=s.batch_id
  where c.fiscal_month=p_fiscal_month and c.company_id=p_company_id and c.source_batch_id=p_pl_batch_id
    and s.batch_id=p_pl_batch_id and s.source_row_category='aggregate' and s.store_id is null
    and b.id=p_pl_batch_id and c.statement_type='pl' and c.decision in('APPROVE','EDIT_AND_APPROVE')
    and c.row_semantics='POSTABLE_DETAIL';
  get diagnostics v_pl_detail=row_count;
  insert into public.dbf_pl_aggregate_facts(fiscal_month,company_id,aggregate_scope,account_code,account_name,amount,source_type,source_file_id,batch_id,imported_by_employee_id,version,status,row_semantics,is_additive)
  select p_fiscal_month,c.company_id,'company_total',c.proposed_account_code,c.proposed_account_name,s.amount,b.source_type,b.source_file_id,b.id,p_actor_employee_id,1,'confirmed','CONTROL_TOTAL',false
  from dbf_ingest.account_mapping_review_candidates c
  join dbf_ingest.staging_rows s on s.batch_id=c.source_batch_id and s.account_code=c.source_account_code and s.company_id=c.company_id
  join dbf_ingest.import_batches b on b.id=s.batch_id
  where c.fiscal_month=p_fiscal_month and c.company_id=p_company_id and c.source_batch_id=p_pl_batch_id
    and s.batch_id=p_pl_batch_id and s.source_row_category='aggregate' and s.store_id is null
    and b.id=p_pl_batch_id and c.statement_type='pl' and c.decision in('APPROVE','EDIT_AND_APPROVE')
    and c.row_semantics='CONTROL_TOTAL';
  get diagnostics v_pl_aggregate=row_count;
  insert into public.dbf_bs_facts(fiscal_month,company_id,account_code,account_name,amount,classification,source_file_id,batch_id,imported_by_employee_id,version,status,row_semantics,is_additive)
  select p_fiscal_month,c.company_id,c.proposed_account_code,c.proposed_account_name,s.amount,s.normalized_payload->>'classification',b.source_file_id,b.id,p_actor_employee_id,1,'confirmed',c.row_semantics,c.row_semantics='POSTABLE_DETAIL'
  from dbf_ingest.account_mapping_review_candidates c
  join dbf_ingest.staging_rows s on s.batch_id=c.source_batch_id and s.account_code=c.source_account_code and s.company_id=c.company_id
  join dbf_ingest.import_batches b on b.id=s.batch_id
  where c.fiscal_month=p_fiscal_month and c.company_id=p_company_id and c.source_batch_id=p_bs_batch_id
    and s.batch_id=p_bs_batch_id and s.store_id is null and b.id=p_bs_batch_id
    and c.statement_type='bs' and c.decision in('APPROVE','EDIT_AND_APPROVE')
    and c.row_semantics in('POSTABLE_DETAIL','CONTROL_TOTAL');
  get diagnostics v_bs=row_count;
  if v_pl_detail+v_pl_aggregate<>p_expected_pl_candidate_count or v_bs<>p_expected_bs_candidate_count
    or p_expected_post_state<>jsonb_build_object('plDetail',v_pl_detail,'plAggregate',v_pl_aggregate,'bs',v_bs,'budget',0,'storeMetrics',0) then raise exception 'DBF_POST_STATE_REJECTED'; end if;
  insert into dbf_ingest.corporate_accounting_promotion_receipts(scope_code,idempotency_key,fiscal_month,company_id,pl_batch_id,bs_batch_id,manifest_ref,selected_row_digest,mapping_version,mapping_digest,row_semantics_digest,preview_digest,control_total_digest,approval_scope_digest,transaction_plan_digest,pl_detail_count,pl_aggregate_count,bs_count,promoted_by_employee_id)
  values(p_promotion_scope_id,p_idempotency_key,p_fiscal_month,p_company_id,p_pl_batch_id,p_bs_batch_id,p_manifest_ref,p_selected_row_digest,p_mapping_version,p_mapping_digest,p_row_semantics_digest,p_preview_digest,p_control_total_digest,p_approval_scope_digest,p_transaction_plan_digest,v_pl_detail,v_pl_aggregate,v_bs,p_actor_employee_id) returning promotion_receipt_id into v_receipt;
  insert into dbf_ingest.corporate_accounting_promotion_audit(promotion_receipt_id,event_type,actor_employee_id,summary)
  values(v_receipt,'CORPORATE_ACCOUNTING_PROMOTED',p_actor_employee_id,jsonb_build_object('scope',p_promotion_scope_id,'plDetail',v_pl_detail,'plAggregate',v_pl_aggregate,'bs',v_bs));
  return jsonb_build_object('receiptId',v_receipt,'status','promoted','plDetail',v_pl_detail,'plAggregate',v_pl_aggregate,'bs',v_bs);
end $fn$;

alter table dbf_ingest.corporate_accounting_approval_receipts enable row level security;
alter table dbf_ingest.corporate_accounting_approval_receipts force row level security;
alter table dbf_ingest.corporate_accounting_promotion_receipts enable row level security;
alter table dbf_ingest.corporate_accounting_promotion_receipts force row level security;
alter table dbf_ingest.corporate_accounting_promotion_audit enable row level security;
alter table dbf_ingest.corporate_accounting_promotion_audit force row level security;

revoke all on dbf_ingest.corporate_accounting_approval_receipts from public,anon,authenticated,service_role;
revoke all on dbf_ingest.corporate_accounting_promotion_receipts from public,anon,authenticated,service_role;
revoke all on dbf_ingest.corporate_accounting_promotion_audit from public,anon,authenticated,service_role;
revoke all on sequence dbf_ingest.corporate_accounting_promotion_audit_audit_id_seq from public,anon,authenticated,service_role;
revoke all on function dbf_ingest.guard_corporate_accounting_receipt_mutation() from public,anon,authenticated,service_role;
revoke all on function dbf_ingest.guard_corporate_accounting_fact_insert_scope() from public,anon,authenticated,service_role;
revoke all on function public.dbf_corporate_accounting_promotion_preflight_v1(text) from public,anon,authenticated;
revoke all on function public.dbf_corporate_accounting_approve_v1(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.dbf_import_promote_corporate_accounting_v1(uuid,text,text,text,date,uuid,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,integer,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.dbf_corporate_accounting_promotion_preflight_v1(text) to service_role;
grant execute on function public.dbf_corporate_accounting_approve_v1(uuid,uuid,text,boolean) to service_role;
grant execute on function public.dbf_import_promote_corporate_accounting_v1(uuid,text,text,text,date,uuid,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,integer,integer,jsonb,jsonb) to service_role;

commit;
