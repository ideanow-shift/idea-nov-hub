-- M061 DB negative test. Run only on a disposable non-Production test DB.
begin;

create function pg_temp.expect_failure(p_label text, p_sql text)
returns void language plpgsql as $function$
begin
  begin
    execute p_sql;
  exception when check_violation then
    return;
  end;
  raise exception 'M061_NEGATIVE_MISPASS:%', p_label;
end
$function$;

select pg_temp.expect_failure('mapping_empty', $sql$
  insert into governance.master_source_snapshots
    (source_system, source_environment, source_version, snapshot_version,
     source_as_of, content_digest, mapping_contract_version, masking_policy_version,
     total_record_count, approval_reference, created_by)
  values ('m061-test','test','src-map-empty','snap-map-empty',statement_timestamp(),
    repeat('a',64),'','mask-v1',0,'APR:M061','audit:m061')$sql$);

select pg_temp.expect_failure('mapping_whitespace', $sql$
  insert into governance.master_source_snapshots
    (source_system, source_environment, source_version, snapshot_version,
     source_as_of, content_digest, mapping_contract_version, masking_policy_version,
     total_record_count, approval_reference, created_by)
  values ('m061-test','test','src-map-space','snap-map-space',statement_timestamp(),
    repeat('b',64),'   ','mask-v1',0,'APR:M061','audit:m061')$sql$);

select pg_temp.expect_failure('masking_empty', $sql$
  insert into governance.master_source_snapshots
    (source_system, source_environment, source_version, snapshot_version,
     source_as_of, content_digest, mapping_contract_version, masking_policy_version,
     total_record_count, approval_reference, created_by)
  values ('m061-test','test','src-mask-empty','snap-mask-empty',statement_timestamp(),
    repeat('c',64),'map-v1','',0,'APR:M061','audit:m061')$sql$);

select pg_temp.expect_failure('masking_whitespace', $sql$
  insert into governance.master_source_snapshots
    (source_system, source_environment, source_version, snapshot_version,
     source_as_of, content_digest, mapping_contract_version, masking_policy_version,
     total_record_count, approval_reference, created_by)
  values ('m061-test','test','src-mask-space','snap-mask-space',statement_timestamp(),
    repeat('d',64),'map-v1','   ',0,'APR:M061','audit:m061')$sql$);

insert into governance.master_source_snapshots
  (source_system, source_environment, source_version, snapshot_version,
   source_as_of, content_digest, mapping_contract_version, masking_policy_version,
   total_record_count, approval_reference, created_by)
values ('m061-test','test','src-valid','snap-valid',statement_timestamp(),
  repeat('e',64),'mapping-v1','masking-v1',0,'APR:M061','audit:m061');

with snapshot as (
  select source_snapshot_id
  from governance.master_source_snapshots
  where source_system = 'm061-test' and source_version = 'src-valid'
)
select pg_temp.expect_failure('hash_passed_mismatch', format(
  'insert into governance.snapshot_validation_results
   (source_snapshot_id,master_type,validation_code,validation_status,expected_value,actual_value,checked_at)
   values (%L,%L,%L,%L,%L,%L,statement_timestamp())',
  source_snapshot_id, 'corporations', 'HASH_MATCH', 'passed',
  'sha256:' || repeat('1',64), 'sha256:' || repeat('2',64)
)) from snapshot;

with snapshot as (
  select source_snapshot_id from governance.master_source_snapshots
  where source_system = 'm061-test' and source_version = 'src-valid'
)
select pg_temp.expect_failure('mapping_passed_mismatch', format(
  'insert into governance.snapshot_validation_results
   (source_snapshot_id,master_type,validation_code,validation_status,expected_value,actual_value,checked_at)
   values (%L,%L,%L,%L,%L,%L,statement_timestamp())',
  source_snapshot_id, 'corporations', 'MAPPING_CONTRACT_MATCH', 'passed',
  'version:mapping-v1', 'version:mapping-v2'
)) from snapshot;

with snapshot as (
  select source_snapshot_id from governance.master_source_snapshots
  where source_system = 'm061-test' and source_version = 'src-valid'
)
select pg_temp.expect_failure('masking_passed_mismatch', format(
  'insert into governance.snapshot_validation_results
   (source_snapshot_id,master_type,validation_code,validation_status,expected_value,actual_value,checked_at)
   values (%L,%L,%L,%L,%L,%L,statement_timestamp())',
  source_snapshot_id, 'corporations', 'MASKING_POLICY_MATCH', 'passed',
  'version:masking-v1', 'version:masking-v2'
)) from snapshot;

-- A mismatch is valid evidence only when explicitly recorded as failed.
insert into governance.snapshot_validation_results
  (source_snapshot_id,master_type,validation_code,validation_status,expected_value,actual_value,checked_at)
select source_snapshot_id, 'corporations', 'HASH_MATCH', 'failed',
  'sha256:' || repeat('1',64), 'sha256:' || repeat('2',64), statement_timestamp()
from governance.master_source_snapshots
where source_system = 'm061-test' and source_version = 'src-valid';

do $test$
begin
  begin
    update governance.master_source_snapshots
    set status = 'validated'
    where source_system = 'm061-test' and source_version = 'src-valid';
    update governance.master_source_snapshots
    set status = 'activated'
    where source_system = 'm061-test' and source_version = 'src-valid';
  exception when others then
    if position('BDF_SNAPSHOT_REQUIRES_FIVE_PASSED_MANIFESTS' in sqlerrm) = 0 then
      raise;
    end if;
  end;
end
$test$;

do $record_count_test$
declare
  v_id uuid;
  v_master text;
begin
  insert into governance.master_source_snapshots
    (source_system, source_environment, source_version, snapshot_version,
     source_as_of, content_digest, mapping_contract_version, masking_policy_version,
     total_record_count, approval_reference, created_by)
  values ('m061-test','test','src-count-mismatch','snap-count-mismatch',statement_timestamp(),
    repeat('8',64),'mapping-v1','masking-v1',4,'APR:M061','audit:m061')
  returning source_snapshot_id into v_id;

  foreach v_master in array array[
    'corporations','stores','departments','employees','employee_store_assignments'
  ] loop
    insert into governance.snapshot_master_manifests
      (source_snapshot_id,master_type,record_count,content_hash,schema_version,
       source_extract_version,masking_status,mapping_status,validation_status)
    values (v_id,v_master,1,repeat('7',64),'schema-v1','extract-v1','passed','passed','passed');
  end loop;

  update governance.master_source_snapshots set status = 'validated'
  where source_snapshot_id = v_id;
  begin
    update governance.master_source_snapshots set status = 'activated'
    where source_snapshot_id = v_id;
    raise exception 'M061_NEGATIVE_MISPASS:record_count_mismatch';
  exception when others then
    if sqlerrm = 'M061_NEGATIVE_MISPASS:record_count_mismatch'
       or position('BDF_SNAPSHOT_TOTAL_RECORD_COUNT_MISMATCH' in sqlerrm) = 0 then
      raise;
    end if;
  end;
end
$record_count_test$;

rollback;
