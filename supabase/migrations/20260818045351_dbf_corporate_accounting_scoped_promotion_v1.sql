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
  approval_scope_digest text not null check (approval_scope_digest ~ '^[0-9a-f]{64}$'),
  mapping_digest text not null check (mapping_digest ~ '^[0-9a-f]{64}$'),
  row_semantics_digest text not null check (row_semantics_digest ~ '^[0-9a-f]{64}$'),
  approved_by_employee_id uuid not null,
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

create function public.dbf_corporate_accounting_promotion_preflight_v1()
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, dbf_ingest, accounting, extensions as $fn$
declare
  v_total integer; v_unreviewed integer; v_needs integer; v_approved integer; v_excluded integer;
  v_audit integer; v_semantics_missing integer; v_mapping_unapproved integer; v_duplicate integer;
  v_pl_source integer; v_bs_source integer; v_pl_detail integer; v_pl_control integer; v_bs_candidate integer;
  v_derived integer; v_display integer; v_existing_approval integer; v_existing_promotion integer;
  v_mapping_version text; v_mapping_digest text; v_semantics_digest text; v_selected_digest text;
  v_total_sales numeric; v_technical_sales numeric; v_product_sales numeric; v_ec_sales numeric; v_ordinary_profit numeric;
  v_assets numeric; v_liabilities numeric; v_equity numeric;
  v_blockers jsonb := '[]'::jsonb; v_allowed boolean;
begin
  select count(*), count(*) filter(where decision='UNREVIEWED'), count(*) filter(where decision='NEEDS_REVIEW'),
    count(*) filter(where decision in ('APPROVE','EDIT_AND_APPROVE')), count(*) filter(where decision='EXCLUDE'),
    count(*) filter(where row_semantics is null or row_semantics='NEEDS_OWNER_REVIEW'), min(mapping_version)
  into v_total,v_unreviewed,v_needs,v_approved,v_excluded,v_semantics_missing,v_mapping_version
  from dbf_ingest.account_mapping_review_candidates
  where fiscal_month=date '2026-06-01' and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid;

  select count(*) into v_audit from (
    select distinct on (a.candidate_id) a.candidate_id,a.decision
    from dbf_ingest.account_mapping_review_audit a join dbf_ingest.account_mapping_review_candidates c using(candidate_id)
    where a.decision <> 'INITIALIZE' and c.fiscal_month=date '2026-06-01'
      and c.company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
    order by a.candidate_id,a.occurred_at desc,a.audit_id desc
  ) q;

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

  select encode(extensions.digest(convert_to(coalesce(string_agg(concat_ws('|',candidate_id,decision,canonical_account_id,row_semantics),E'\n' order by statement_type,source_account_code),''),'UTF8'),'sha256'),'hex'),
    encode(extensions.digest(convert_to(coalesce(string_agg(concat_ws('|',candidate_id,row_semantics,is_postable,is_control_total),E'\n' order by statement_type,source_account_code),''),'UTF8'),'sha256'),'hex'),
    encode(extensions.digest(convert_to(coalesce(string_agg(concat_ws('|',source_batch_id,source_account_code,canonical_account_id,row_semantics),E'\n' order by statement_type,source_account_code),''),'UTF8'),'sha256'),'hex')
  into v_mapping_digest,v_semantics_digest,v_selected_digest
  from dbf_ingest.account_mapping_review_candidates
  where fiscal_month=date '2026-06-01' and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid;

  select count(*) into v_existing_approval from dbf_ingest.corporate_accounting_approval_receipts;
  select count(*) into v_existing_promotion from dbf_ingest.corporate_accounting_promotion_receipts;
  select
    max(s.amount) filter(where c.proposed_account_code='TOTAL_SALES'),
    max(s.amount) filter(where c.proposed_account_code='TECHNICAL_SALES'),
    max(s.amount) filter(where c.proposed_account_code='PRODUCT_SALES'),
    max(s.amount) filter(where c.proposed_account_code='EC_SALES'),
    max(s.amount) filter(where c.proposed_account_code='ORDINARY_PROFIT'),
    max(s.amount) filter(where c.proposed_account_code='TOTAL_ASSETS'),
    max(s.amount) filter(where c.proposed_account_code='TOTAL_LIABILITIES'),
    max(s.amount) filter(where c.proposed_account_code='TOTAL_EQUITY')
  into v_total_sales,v_technical_sales,v_product_sales,v_ec_sales,v_ordinary_profit,v_assets,v_liabilities,v_equity
  from dbf_ingest.account_mapping_review_candidates c
  join dbf_ingest.staging_rows s on s.batch_id=c.source_batch_id and s.account_code=c.source_account_code
  where c.fiscal_month=date '2026-06-01' and c.company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
    and c.decision in('APPROVE','EDIT_AND_APPROVE') and c.row_semantics='CONTROL_TOTAL' and s.store_id is null;
  if v_total<>138 or v_unreviewed<>0 or v_needs<>0 or v_approved+v_excluded<>138 or v_audit<138 then v_blockers:=v_blockers||'"OWNER_REVIEW_INCOMPLETE"'::jsonb; end if;
  if v_semantics_missing<>0 then v_blockers:=v_blockers||'"ROW_SEMANTICS_INCOMPLETE"'::jsonb; end if;
  if v_mapping_unapproved<>0 or v_approved=0 then v_blockers:=v_blockers||'"ACCOUNT_MAPPING_UNAPPROVED"'::jsonb; end if;
  if v_pl_source<>71 or v_bs_source<>67 then v_blockers:=v_blockers||'"SOURCE_SCOPE_COUNT_MISMATCH"'::jsonb; end if;
  if v_duplicate<>0 then v_blockers:=v_blockers||'"DUPLICATE_CANONICAL_ACCOUNT"'::jsonb; end if;
  if (v_total_sales,v_technical_sales,v_product_sales,v_ec_sales,v_ordinary_profit,v_assets,v_liabilities,v_equity)
    is distinct from (88066258::numeric,72040100::numeric,14776957::numeric,1249201::numeric,5704265::numeric,570155249::numeric,213188431::numeric,356966818::numeric)
    or coalesce(v_assets-v_liabilities-v_equity,1)<>0 then v_blockers:=v_blockers||'"CONTROL_TOTAL_MISMATCH"'::jsonb; end if;
  if v_existing_approval=0 then v_blockers:=v_blockers||'"APPROVAL_RECEIPT_MISSING"'::jsonb; end if;
  if v_existing_promotion<>0 then v_blockers:=v_blockers||'"ALREADY_PROMOTED"'::jsonb; end if;
  v_allowed:=jsonb_array_length(v_blockers)=0;
  return jsonb_build_object(
    'scope','CORPORATE_ACCOUNTING_ACTUAL_V1','fiscalMonth','2026-06','companyId','e4059116-bdb3-4e13-9763-bbc77bdfe062',
    'review',jsonb_build_object('total',v_total,'reviewed',v_total-v_unreviewed,'unreviewed',v_unreviewed,'needsReview',v_needs,'approved',v_approved,'excluded',v_excluded,'auditCount',v_audit),
    'mappingVersion',v_mapping_version,'mappingDigest',v_mapping_digest,'rowSemanticsDigest',v_semantics_digest,'selectedRowDigest',v_selected_digest,
    'sourceRows',jsonb_build_object('pl',v_pl_source,'bs',v_bs_source),
    'canonicalCandidates',jsonb_build_object('plDetail',case when v_allowed then v_pl_detail else 0 end,'plAggregate',case when v_allowed then v_pl_control else 0 end,'bs',case when v_allowed then v_bs_candidate else 0 end,'budget',0,'storeMetrics',0),
    'excludedSubtotalCount',v_derived,'excludedDisplayOnlyCount',v_display,'duplicateGrainCount',greatest(v_duplicate,0),
    'controlTotals',jsonb_build_object('status',case when v_allowed then 'READY_FOR_EXACT_RECONCILIATION' else 'BLOCKED' end,
      'pl',jsonb_build_object('totalSales',88066258,'technicalSales',72040100,'productSales',14776957,'ecSales',1249201,'ordinaryProfit',5704265),
      'bs',jsonb_build_object('assets',570155249,'liabilities',213188431,'equity',356966818,'difference',0)),
    'canonicalBaseline',jsonb_build_object('plDetail',0,'plAggregate',0,'bs',0,'budget',0,'storeMetrics',0),
    'existingApprovalReceipt',v_existing_approval,'existingPromotionReceipt',v_existing_promotion,
    'idempotencyStatus',case when v_existing_promotion=0 then 'UNUSED' else 'USED' end,
    'promotionAllowed',v_allowed,'blockingReasons',v_blockers);
end $fn$;

create function public.dbf_import_promote_corporate_accounting_v1(
  p_actor_employee_id uuid,p_promotion_scope_id text,p_idempotency_key text,p_fiscal_month date,p_company_id uuid,
  p_pl_batch_id uuid,p_bs_batch_id uuid,p_source_file_ids jsonb,p_source_file_digests jsonb,p_selected_row_digest text,
  p_mapping_version text,p_mapping_digest text,p_row_semantics_digest text,p_preview_digest text,p_control_total_digest text,
  p_approval_scope_digest text,p_transaction_plan_digest text,p_expected_pl_candidate_count integer,
  p_expected_bs_candidate_count integer,p_expected_canonical_baseline jsonb,p_expected_post_state jsonb
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, dbf_ingest, accounting, extensions as $fn$
declare v_preflight jsonb; v_receipt uuid; v_pl_detail integer; v_pl_aggregate integer; v_bs integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('CORPORATE_ACCOUNTING_ACTUAL_V1|2026-06|e4059116-bdb3-4e13-9763-bbc77bdfe062',0));
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key,0));
  if p_actor_employee_id is null or p_promotion_scope_id<>'CORPORATE_ACCOUNTING_ACTUAL_V1'
    or p_fiscal_month<>date '2026-06-01' or p_company_id<>'e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
    or p_pl_batch_id<>'13cb25de-0b76-475a-b718-5f588be447fd'::uuid
    or p_bs_batch_id<>'0ffccfd2-1a39-404a-a41d-b16127ea9008'::uuid then raise exception 'DBF_CORPORATE_SCOPE_REJECTED'; end if;
  if p_idempotency_key !~ '^[0-9a-f]{64}$' or p_selected_row_digest !~ '^[0-9a-f]{64}$'
    or p_mapping_digest !~ '^[0-9a-f]{64}$' or p_row_semantics_digest !~ '^[0-9a-f]{64}$'
    or p_preview_digest !~ '^[0-9a-f]{64}$' or p_control_total_digest !~ '^[0-9a-f]{64}$'
    or p_approval_scope_digest !~ '^[0-9a-f]{64}$' or p_transaction_plan_digest !~ '^[0-9a-f]{64}$' then raise exception 'DBF_DIGEST_REJECTED'; end if;
  if p_source_file_ids <> '["4b113b1b-db39-4fbf-908f-67f83f712dce","c27acc17-fdd0-4113-90c2-73b646913f99"]'::jsonb
    or p_source_file_digests <> '["997e89c54b12334d3aa477a78aff9487d46042822a5ff9ab0cd9fe0f86f073d1","f18c9464a9a070ff641140178b19532dbd8dd319e739eb2e2bcef325adfda54c"]'::jsonb then raise exception 'DBF_SOURCE_DIGEST_REJECTED'; end if;
  if (select count(*) from dbf_ingest.source_files where (id,sha256) in (
      ('4b113b1b-db39-4fbf-908f-67f83f712dce'::uuid,'997e89c54b12334d3aa477a78aff9487d46042822a5ff9ab0cd9fe0f86f073d1'),
      ('c27acc17-fdd0-4113-90c2-73b646913f99'::uuid,'f18c9464a9a070ff641140178b19532dbd8dd319e739eb2e2bcef325adfda54c')))<>2
    or not exists(select 1 from dbf_ingest.import_batches where id=p_pl_batch_id and source_file_id='c27acc17-fdd0-4113-90c2-73b646913f99'::uuid and fact_kind='pl' and fiscal_month=date '2026-06-01')
    or not exists(select 1 from dbf_ingest.import_batches where id=p_bs_batch_id and source_file_id='c27acc17-fdd0-4113-90c2-73b646913f99'::uuid and fact_kind='bs' and fiscal_month=date '2026-06-01') then raise exception 'DBF_SOURCE_DB_EVIDENCE_REJECTED'; end if;
  if exists(select 1 from dbf_ingest.staging_rows where batch_id in(p_pl_batch_id,p_bs_batch_id)
      and (company_id is distinct from p_company_id or store_id is not null or mapping_status<>'resolved'
        or validation_status not in('valid','warning') or coalesce(normalized_payload->>'confirmationStatus','')<>'confirmed'
        or coalesce(normalized_payload->>'taxBasis','TAX_EXCLUSIVE')<>'TAX_EXCLUSIVE'))
    or (select count(*) from dbf_ingest.staging_rows where batch_id=p_pl_batch_id and source_row_category='aggregate' and store_id is null)<>71
    or (select count(*) from dbf_ingest.staging_rows where batch_id=p_bs_batch_id and store_id is null)<>67
    then raise exception 'DBF_SCOPE_LEAKAGE_REJECTED'; end if;
  if p_expected_canonical_baseline<>jsonb_build_object('plDetail',0,'plAggregate',0,'bs',0,'budget',0,'storeMetrics',0) then raise exception 'DBF_CANONICAL_BASELINE_REJECTED'; end if;
  v_preflight:=public.dbf_corporate_accounting_promotion_preflight_v1();
  if coalesce((v_preflight->>'promotionAllowed')::boolean,false) is not true then raise exception 'DBF_PREFLIGHT_REJECTED'; end if;
  if v_preflight->>'selectedRowDigest'<>p_selected_row_digest or v_preflight->>'mappingVersion'<>p_mapping_version
    or v_preflight->>'mappingDigest'<>p_mapping_digest or v_preflight->>'rowSemanticsDigest'<>p_row_semantics_digest then raise exception 'DBF_STALE_MANIFEST_REJECTED'; end if;
  if not exists(select 1 from dbf_ingest.corporate_accounting_approval_receipts where approval_scope_digest=p_approval_scope_digest
    and mapping_digest=p_mapping_digest and row_semantics_digest=p_row_semantics_digest) then raise exception 'DBF_APPROVAL_SCOPE_REJECTED'; end if;
  if exists(select 1 from dbf_ingest.corporate_accounting_promotion_receipts where idempotency_key=p_idempotency_key) then raise exception 'DBF_IDEMPOTENCY_REPLAY'; end if;
  perform set_config('dbf.corporate_accounting_scope','CORPORATE_ACCOUNTING_ACTUAL_V1',true);

  insert into public.dbf_pl_detail_facts(fiscal_month,company_id,store_id,account_code,account_name,amount,source_type,source_file_id,batch_id,imported_by_employee_id,version,status,row_semantics,is_additive)
  select date '2026-06-01',c.company_id,null,c.proposed_account_code,c.proposed_account_name,s.amount,b.source_type,b.source_file_id,b.id,p_actor_employee_id,1,'confirmed','POSTABLE_DETAIL',true
  from dbf_ingest.account_mapping_review_candidates c join dbf_ingest.staging_rows s on s.batch_id=c.source_batch_id and s.account_code=c.source_account_code
  join dbf_ingest.import_batches b on b.id=s.batch_id where c.statement_type='pl' and c.decision in('APPROVE','EDIT_AND_APPROVE') and c.row_semantics='POSTABLE_DETAIL' and s.store_id is null;
  get diagnostics v_pl_detail=row_count;
  insert into public.dbf_pl_aggregate_facts(fiscal_month,company_id,aggregate_scope,account_code,account_name,amount,source_type,source_file_id,batch_id,imported_by_employee_id,version,status,row_semantics,is_additive)
  select date '2026-06-01',c.company_id,'company_total',c.proposed_account_code,c.proposed_account_name,s.amount,b.source_type,b.source_file_id,b.id,p_actor_employee_id,1,'confirmed','CONTROL_TOTAL',false
  from dbf_ingest.account_mapping_review_candidates c join dbf_ingest.staging_rows s on s.batch_id=c.source_batch_id and s.account_code=c.source_account_code
  join dbf_ingest.import_batches b on b.id=s.batch_id where c.statement_type='pl' and c.decision in('APPROVE','EDIT_AND_APPROVE') and c.row_semantics='CONTROL_TOTAL' and s.store_id is null;
  get diagnostics v_pl_aggregate=row_count;
  insert into public.dbf_bs_facts(fiscal_month,company_id,account_code,account_name,amount,classification,source_file_id,batch_id,imported_by_employee_id,version,status,row_semantics,is_additive)
  select date '2026-06-01',c.company_id,c.proposed_account_code,c.proposed_account_name,s.amount,s.normalized_payload->>'classification',b.source_file_id,b.id,p_actor_employee_id,1,'confirmed',c.row_semantics,c.row_semantics='POSTABLE_DETAIL'
  from dbf_ingest.account_mapping_review_candidates c join dbf_ingest.staging_rows s on s.batch_id=c.source_batch_id and s.account_code=c.source_account_code
  join dbf_ingest.import_batches b on b.id=s.batch_id where c.statement_type='bs' and c.decision in('APPROVE','EDIT_AND_APPROVE') and c.row_semantics in('POSTABLE_DETAIL','CONTROL_TOTAL') and s.store_id is null;
  get diagnostics v_bs=row_count;
  if v_pl_detail+v_pl_aggregate<>p_expected_pl_candidate_count or v_bs<>p_expected_bs_candidate_count
    or p_expected_post_state<>jsonb_build_object('plDetail',v_pl_detail,'plAggregate',v_pl_aggregate,'bs',v_bs,'budget',0,'storeMetrics',0) then raise exception 'DBF_POST_STATE_REJECTED'; end if;
  insert into dbf_ingest.corporate_accounting_promotion_receipts(scope_code,idempotency_key,fiscal_month,company_id,pl_batch_id,bs_batch_id,selected_row_digest,mapping_version,mapping_digest,row_semantics_digest,preview_digest,control_total_digest,approval_scope_digest,transaction_plan_digest,pl_detail_count,pl_aggregate_count,bs_count,promoted_by_employee_id)
  values(p_promotion_scope_id,p_idempotency_key,p_fiscal_month,p_company_id,p_pl_batch_id,p_bs_batch_id,p_selected_row_digest,p_mapping_version,p_mapping_digest,p_row_semantics_digest,p_preview_digest,p_control_total_digest,p_approval_scope_digest,p_transaction_plan_digest,v_pl_detail,v_pl_aggregate,v_bs,p_actor_employee_id) returning promotion_receipt_id into v_receipt;
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
revoke all on function public.dbf_corporate_accounting_promotion_preflight_v1() from public,anon,authenticated;
revoke all on function public.dbf_import_promote_corporate_accounting_v1(uuid,text,text,date,uuid,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,integer,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.dbf_corporate_accounting_promotion_preflight_v1() to service_role;
grant execute on function public.dbf_import_promote_corporate_accounting_v1(uuid,text,text,date,uuid,uuid,uuid,jsonb,jsonb,text,text,text,text,text,text,text,text,integer,integer,jsonb,jsonb) to service_role;

commit;
