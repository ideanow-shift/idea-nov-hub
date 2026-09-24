\set ON_ERROR_STOP on

do $$
declare
  quantity_count integer;
  rate_count integer;
  definition_count integer;
  mapping_count integer;
  batch_count integer;
  raw_count integer;
  stage_count integer;
  non_salon_count integer;
begin
  select count(*) into quantity_count from public.dbf_store_monthly_metric_facts
    where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS' and is_active;
  select count(*) into rate_count from public.dbf_store_monthly_metric_facts
    where metric_code='RETAIL_PURCHASE_RATE' and is_active;
  select count(*) into definition_count from dbf_ingest.metric_definitions
    where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS'
      and definition_version='POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1';
  select count(*) into mapping_count from dbf_ingest.entity_mappings
    where source_system='store_ops_retail_purchase_20260921_v1' and status='active';
  select count(*) into batch_count from dbf_ingest.import_batches b
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system='pos_retail_purchase_handoff_v1'
      and f.sha256='ef2c56108baced3f1999f6903c681b8d7be963a50707388dc84bea2bbfa68942'
      and b.status='promoted';
  select count(*) into raw_count from dbf_ingest.raw_rows rr
    join dbf_ingest.import_batches b on b.id=rr.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system='pos_retail_purchase_handoff_v1';
  select count(*) into stage_count from dbf_ingest.staging_rows s
    join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system='pos_retail_purchase_handoff_v1';
  select count(*) into non_salon_count from dbf_ingest.staging_rows s
    join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system='pos_retail_purchase_handoff_v1'
      and (s.normalized_payload->>'source_scope_type'<>'SALON'
        or s.normalized_payload->>'promotion_status'<>'READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH');

  if quantity_count<>1492 or rate_count<>4 or definition_count<>1 or mapping_count<>27
     or batch_count<>92 or raw_count<>1492 or stage_count<>1492 or non_salon_count<>0 then
    raise exception 'MOCK_READBACK_FAILED quantity=% rate=% definition=% mapping=% batch=% raw=% stage=% non_salon=%',
      quantity_count,rate_count,definition_count,mapping_count,batch_count,raw_count,stage_count,non_salon_count;
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='dbf_store_monthly_metric_facts'
      and c.relrowsecurity and c.relforcerowsecurity
  ) then
    raise exception 'FACT_RLS_OR_FORCE_RLS_MISSING';
  end if;
  if has_table_privilege('anon','public.dbf_store_monthly_metric_facts','insert')
     or has_table_privilege('authenticated','public.dbf_store_monthly_metric_facts','insert') then
    raise exception 'BROWSER_ROLE_GAINED_FACT_INSERT';
  end if;
end
$$;
