-- REVIEW ONLY. ROLLBACK/INVALIDATION IS NOT AUTHORIZED.
-- This is an append-only invalidation plan for execution SQL SHA fixed in the
-- adjacent manifest. It preserves source, raw, staging, audit and Fact history.

do $$
begin
  raise exception 'REVIEW_ONLY_STORE_OPERATIONS_RETAIL_INVALIDATION_NOT_AUTHORIZED';
end
$$;

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(hashtextextended('store-operations-retail-purchase-20260921-v1', 0));

update public.dbf_store_monthly_metric_facts f
set is_active=false,
    superseded_at=statement_timestamp(),
    correction_reason='OWNER_APPROVED_PACKAGE_INVALIDATION'
from dbf_ingest.source_files sf
where sf.id=f.source_file_id
  and sf.source_system='pos_retail_purchase_handoff_v1'
  and sf.sha256=lower('EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942')
  and f.metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS'
  and f.definition_version='POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1'
  and f.is_active;

insert into dbf_ingest.import_events
  (batch_id,event_type,from_status,to_status,actor_employee_id,reason_code,summary)
select b.id,'store_operations_retail_purchase_invalidated','promoted','rolled_back',
  '369d9cd5-f6ba-4e53-9428-f631f0893469'::uuid,
  'OWNER_APPROVED_PACKAGE_INVALIDATION',
  jsonb_build_object('package_sha256','ef2c56108baced3f1999f6903c681b8d7be963a50707388dc84bea2bbfa68942')
from dbf_ingest.import_batches b
join dbf_ingest.source_files sf on sf.id=b.source_file_id
where sf.source_system='pos_retail_purchase_handoff_v1'
  and sf.sha256='ef2c56108baced3f1999f6903c681b8d7be963a50707388dc84bea2bbfa68942'
  and b.status='promoted';

update dbf_ingest.import_batches b
set status='rolled_back'
from dbf_ingest.source_files sf
where sf.id=b.source_file_id
  and sf.source_system='pos_retail_purchase_handoff_v1'
  and sf.sha256='ef2c56108baced3f1999f6903c681b8d7be963a50707388dc84bea2bbfa68942'
  and b.status='promoted';

update dbf_ingest.metric_definitions
set is_active=false
where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS'
  and definition_version='POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1';

update dbf_ingest.entity_mappings
set status='retired'
where source_system='store_ops_retail_purchase_20260921_v1'
  and status='active';

commit;

-- Deliberately no DELETE, DROP, TRUNCATE, or RETAIL_PURCHASE_RATE mutation.
