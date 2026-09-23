-- REVIEW ONLY. PRODUCTION EXECUTION IS NOT AUTHORIZED.
-- Fixed input SHA-256:
-- EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942
-- Package root SHA-256:
-- 94CA104E062E3BCB2CB47910AA47F95F578C1BF9463196A2A4D9304E5A4ABBBA
-- Planned canonical STORE quantity inserts: 1,492. Existing rate updates: 0.

do $$
begin
  raise exception 'REVIEW_ONLY_STORE_OPERATIONS_PREPARING_METRICS_PRODUCTION_V1_EXECUTION_NOT_AUTHORIZED';
end
$$;

-- Proposed metadata DDL. This is intentionally after the unconditional guard.
alter table dbf_ingest.metric_definitions
  drop constraint metric_definitions_metric_code_check;

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
values
  ('RETAIL_PURCHASE_CUSTOMER_VISITS', 'POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1',
   'quantity', '店販購買客数',
   'POS月報の店販行にある客数。0は正式な0、NULLは欠損。技術施術と同時購入を含む。',
   true)
on conflict (metric_code, definition_version) do nothing;

-- Proposed loader boundary. The separately generated candidate file contains
-- exactly 1,492 validated SALON rows and no EC/HQ/company-total/quarantine rows.
-- A separately approved execution package must load those candidates into the
-- existing dbf_ingest raw_rows/staging_rows contract and retain the fixed SHA.

do $preflight$
declare
  candidate_count integer;
  invalid_count integer;
  duplicate_count integer;
begin
  select count(*) into candidate_count
  from dbf_ingest.staging_rows s
  join dbf_ingest.import_batches b on b.id = s.batch_id
  join dbf_ingest.source_files f on f.id = b.source_file_id
  where f.sha256 = lower('EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942')
    and f.source_system = 'pos_retail_purchase_handoff_v1'
    and s.normalized_payload->>'promotion_status' = 'READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH'
    and s.normalized_payload->>'scope_type' = 'SALON'
    and s.mapping_status = 'resolved'
    and s.validation_status = 'valid';

  select count(*) into invalid_count
  from dbf_ingest.staging_rows s
  join dbf_ingest.import_batches b on b.id = s.batch_id
  join dbf_ingest.source_files f on f.id = b.source_file_id
  where f.sha256 = lower('EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942')
    and f.source_system = 'pos_retail_purchase_handoff_v1'
    and s.normalized_payload->>'promotion_status' = 'READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH'
    and (s.quantity < 0
      or s.store_id is null
      or s.company_id is null
      or nullif(s.normalized_payload->>'total_customer_visits_for_validation','')::numeric < s.quantity);

  select count(*) into duplicate_count from (
    select b.fiscal_month, s.company_id, s.store_id, count(*)
    from dbf_ingest.staging_rows s
    join dbf_ingest.import_batches b on b.id = s.batch_id
    join dbf_ingest.source_files f on f.id = b.source_file_id
    where f.sha256 = lower('EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942')
      and f.source_system = 'pos_retail_purchase_handoff_v1'
      and s.normalized_payload->>'promotion_status' = 'READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH'
    group by b.fiscal_month, s.company_id, s.store_id
    having count(*) <> 1
  ) d;

  if candidate_count <> 1492 or invalid_count <> 0 or duplicate_count <> 0 then
    raise exception 'PRODUCTION_RETAIL_PREFLIGHT_FAILED candidates=% invalid=% duplicates=%',
      candidate_count, invalid_count, duplicate_count;
  end if;
end
$preflight$;

-- Proposed canonical DML. It appends only the new quantity metric.
-- RETAIL_PURCHASE_RATE is never inserted, updated, deleted, or superseded here.
insert into public.dbf_store_monthly_metric_facts
  (fiscal_month, company_id, store_id, metric_code, quantity, definition_version,
   source_type, source_file_id, batch_id, imported_by_employee_id,
   version, status, is_active)
select b.fiscal_month, s.company_id, s.store_id,
  'RETAIL_PURCHASE_CUSTOMER_VISITS', s.quantity,
  'POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1',
  'pos_retail_purchase_customer_count_v1', b.source_file_id, b.id,
  '369d9cd5-f6ba-4e53-9428-f631f0893469'::uuid,
  1, 'confirmed', true
from dbf_ingest.staging_rows s
join dbf_ingest.import_batches b on b.id = s.batch_id
join dbf_ingest.source_files f on f.id = b.source_file_id
where f.sha256 = lower('EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942')
  and f.source_system = 'pos_retail_purchase_handoff_v1'
  and s.normalized_payload->>'promotion_status' = 'READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH'
  and s.normalized_payload->>'scope_type' = 'SALON'
  and s.mapping_status = 'resolved'
  and s.validation_status = 'valid'
on conflict (fiscal_month, company_id, store_id, metric_code) where is_active do nothing;

do $verify$
declare
  quantity_count integer;
  active_duplicate_count integer;
  existing_rate_count integer;
begin
  select count(*) into quantity_count
  from public.dbf_store_monthly_metric_facts
  where metric_code = 'RETAIL_PURCHASE_CUSTOMER_VISITS'
    and definition_version = 'POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1'
    and is_active;

  select count(*) into active_duplicate_count from (
    select fiscal_month, company_id, store_id, metric_code, count(*)
    from public.dbf_store_monthly_metric_facts
    where metric_code = 'RETAIL_PURCHASE_CUSTOMER_VISITS' and is_active
    group by fiscal_month, company_id, store_id, metric_code
    having count(*) <> 1
  ) d;

  select count(*) into existing_rate_count
  from public.dbf_store_monthly_metric_facts
  where metric_code = 'RETAIL_PURCHASE_RATE' and is_active;

  if quantity_count <> 1492 or active_duplicate_count <> 0 or existing_rate_count <> 4 then
    raise exception 'PRODUCTION_RETAIL_READBACK_FAILED quantity=% duplicates=% existing_rate=%',
      quantity_count, active_duplicate_count, existing_rate_count;
  end if;
end
$verify$;

-- Deliberately omitted until a separate Owner approval:
-- * any Production execution wrapper or migration
-- * company-total canonical objects/writes
-- * EC/HQ promotion
-- * RETAIL_PURCHASE_RATE mutation
-- * GRANT, policy, Data API exposure, deploy
