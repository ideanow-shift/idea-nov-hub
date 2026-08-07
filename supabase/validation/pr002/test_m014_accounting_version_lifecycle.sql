-- Synthetic-only M014 contract test. Entire fixture is rolled back.
begin;
create function pg_temp.expect_failure(p_label text,p_sql text,p_reason text) returns void language plpgsql as $f$
begin begin execute p_sql; exception when others then if position(p_reason in sqlerrm)>0 then raise notice 'M014_EXPECTED %',p_label; return; end if; raise exception 'M014_WRONG_REJECTION % expected=% actual=%',p_label,p_reason,sqlerrm; end; raise exception 'M014_MISPASS %',p_label; end $f$;

insert into governance.canonical_entity_registry(canonical_entity_id,entity_type)
values('14000000-0000-4000-8000-000000000001','corporation');
insert into core.corporation_identities(corporation_id)
values('14000000-0000-4000-8000-000000000001');

insert into accounting.accounting_versions(accounting_version_id,corporation_id,scenario_type,version_type,
 fiscal_year,period_start,period_end,version_sequence,version_label,status,content_hash,created_by)
values
('14100000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000001','budget','baseline',2027,'2026-04-01','2026-05-01',1,'Budget baseline','draft',repeat('1',64),'audit:m014'),
('14100000-0000-4000-8000-000000000002','14000000-0000-4000-8000-000000000001','forecast','rolling_forecast',2027,'2026-04-01','2026-05-01',1,'Forecast v1','draft',repeat('2',64),'audit:m014');

select pg_temp.expect_failure('INVALID_SCENARIO',$q$insert into accounting.accounting_versions(corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,version_sequence,version_label,content_hash,created_by) values('14000000-0000-4000-8000-000000000001','previous_year','baseline',2027,'2026-05-01','2026-06-01',1,'bad',repeat('3',64),'audit:m014')$q$,'accounting_versions_scenario_type_matrix');
select pg_temp.expect_failure('INVALID_SCENARIO_TYPE_MATRIX',$q$insert into accounting.accounting_versions(corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,version_sequence,version_label,content_hash,created_by) values('14000000-0000-4000-8000-000000000001','budget','rolling_forecast',2027,'2026-05-01','2026-06-01',1,'bad',repeat('4',64),'audit:m014')$q$,'accounting_versions_scenario_type_matrix');
select pg_temp.expect_failure('INVALID_PERIOD',$q$insert into accounting.accounting_versions(corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,version_sequence,version_label,content_hash,created_by) values('14000000-0000-4000-8000-000000000001','budget','baseline',2027,'2026-05-02','2026-06-01',1,'bad',repeat('5',64),'audit:m014')$q$,'accounting_versions_period_check');
-- A non-positive sequence also violates the mandatory v1/parent lineage shape.
-- The catalog validation separately proves that sequence_positive is installed;
-- this runtime case proves that the combined contract rejects the row.
select pg_temp.expect_failure('INVALID_SEQUENCE',$q$insert into accounting.accounting_versions(corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,version_sequence,version_label,content_hash,created_by) values('14000000-0000-4000-8000-000000000001','budget','baseline',2027,'2026-05-01','2026-06-01',0,'bad',repeat('6',64),'audit:m014')$q$,'accounting_versions_lineage_check');
select pg_temp.expect_failure('DUPLICATE_VERSION',$q$insert into accounting.accounting_versions(corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,version_sequence,version_label,content_hash,created_by) values('14000000-0000-4000-8000-000000000001','budget','baseline',2027,'2026-04-01','2026-05-01',1,'duplicate',repeat('7',64),'audit:m014')$q$,'accounting_versions_stream_sequence_unique');
select pg_temp.expect_failure('DIRECT_PUBLISHED_INSERT',$q$insert into accounting.accounting_versions(corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,version_sequence,version_label,status,content_hash,created_by,validating_at,validating_by,validated_at,validated_by,approved_at,approved_by,published_at,published_by) values('14000000-0000-4000-8000-000000000001','budget','baseline',2027,'2026-05-01','2026-06-01',1,'bad','published',repeat('8',64),'audit:m014',now(),'audit:m014',now(),'audit:m014',now(),'audit:m014',now(),'audit:m014')$q$,'BDF_ACCOUNTING_VERSION_INITIAL_STATUS_DRAFT_REQUIRED');
select pg_temp.expect_failure('ACTUAL_WITHOUT_BATCH',$q$insert into accounting.accounting_versions(corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,version_sequence,version_label,content_hash,created_by) values('14000000-0000-4000-8000-000000000001','actual','preliminary',2027,'2026-05-01','2026-06-01',1,'actual',repeat('9',64),'audit:m014')$q$,'accounting_versions_actual_source_check');
select pg_temp.expect_failure('ORPHAN_SNAPSHOT',$q$insert into accounting.accounting_versions(corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,version_sequence,version_label,source_snapshot_id,content_hash,created_by) values('14000000-0000-4000-8000-000000000001','budget','baseline',2027,'2026-05-01','2026-06-01',1,'bad','14999999-0000-4000-8000-000000000999',repeat('a',64),'audit:m014')$q$,'accounting_versions_source_snapshot_id_fkey');
-- The insert guard resolves and validates the parent stream before the FK phase,
-- so an unknown parent is rejected at the stronger semantic boundary.
select pg_temp.expect_failure('ORPHAN_PARENT',$q$insert into accounting.accounting_versions(corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,version_sequence,version_label,parent_version_id,content_hash,created_by) values('14000000-0000-4000-8000-000000000001','budget','revision',2027,'2026-05-01','2026-06-01',2,'bad','14999999-0000-4000-8000-000000000999',repeat('b',64),'audit:m014')$q$,'BDF_ACCOUNTING_VERSION_PARENT_STREAM_MISMATCH');

insert into accounting.accounting_versions(accounting_version_id,corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,version_sequence,version_label,parent_version_id,content_hash,created_by)
values('14100000-0000-4000-8000-000000000003','14000000-0000-4000-8000-000000000001','forecast','revision',2027,'2026-04-01','2026-05-01',2,'Forecast v2','14100000-0000-4000-8000-000000000002',repeat('c',64),'audit:m014');
select pg_temp.expect_failure('SCENARIO_STREAM_MISMATCH',$q$insert into accounting.accounting_versions(corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,version_sequence,version_label,parent_version_id,content_hash,created_by) values('14000000-0000-4000-8000-000000000001','budget','revision',2027,'2026-04-01','2026-05-01',2,'bad','14100000-0000-4000-8000-000000000002',repeat('d',64),'audit:m014')$q$,'BDF_ACCOUNTING_VERSION_PARENT_STREAM_MISMATCH');

update accounting.accounting_versions set status='validating',validating_at=statement_timestamp(),validating_by='audit:m014'
where accounting_version_id='14100000-0000-4000-8000-000000000001';
select pg_temp.expect_failure('PRE_M016_VALIDATED',$q$update accounting.accounting_versions set status='validated',validated_at=now(),validated_by='audit:m014' where accounting_version_id='14100000-0000-4000-8000-000000000001'$q$,'BDF_ACCOUNTING_VALIDATION_NOT_AVAILABLE_BEFORE_M016');
select pg_temp.expect_failure('CONTENT_UPDATE',$q$update accounting.accounting_versions set version_label='changed' where accounting_version_id='14100000-0000-4000-8000-000000000002'$q$,'BDF_ACCOUNTING_VERSION_CONTENT_IMMUTABLE');
select pg_temp.expect_failure('IMMUTABLE_DELETE',$q$delete from accounting.accounting_versions where accounting_version_id='14100000-0000-4000-8000-000000000002'$q$,'BDF_ACCOUNTING_VERSION_IMMUTABLE');
select pg_temp.expect_failure('SCENARIO_CONTRACT_UPDATE',$q$update accounting.scenario_contracts set scenario_type='other' where scenario_type='actual'$q$,'BDF_ACCOUNTING_CONTRACT_IMMUTABLE');

do $checks$ begin
 if (select count(*) from accounting.accounting_versions where period_start='2026-04-01' and scenario_type in('budget','forecast'))<>3 then raise exception 'M014_SCENARIO_SEPARATION'; end if;
 if (select count(*) from accounting.scenario_contracts)<>3 or (select count(*) from accounting.measure_type_contracts)<>2 then raise exception 'M014_REFERENCE_CONTRACT'; end if;
end $checks$;
rollback;
