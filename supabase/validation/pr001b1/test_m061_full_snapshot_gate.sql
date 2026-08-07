-- M061 Tier 1 full Snapshot Metadata Gate.
-- Synthetic data only; the entire fixture is rolled back.
begin;

create function pg_temp.expect_failure(p_label text, p_sql text, p_reason text default null)
returns void language plpgsql as $function$
begin
  begin
    execute p_sql;
  exception when others then
    if p_reason is null or position(p_reason in sqlerrm) > 0 then
      raise notice 'M061_EXPECTED_REJECTION % [%]', p_label, sqlerrm;
      return;
    end if;
    raise exception 'M061_WRONG_REJECTION % expected=% actual=%', p_label, p_reason, sqlerrm;
  end;
  raise exception 'M061_NEGATIVE_MISPASS %', p_label;
end
$function$;

create function pg_temp.seed_snapshot(
  p_tag text,
  p_manifest_count integer,
  p_validation_count integer,
  p_approval_count integer,
  p_total_record_count bigint
) returns uuid language plpgsql as $function$
declare
  v_id uuid;
  v_masters text[] := array['corporations','stores','departments','employees','employee_store_assignments'];
  v_codes text[] := array['HASH_MATCH','RECORD_COUNT_MATCH','SCHEMA_MATCH','MASKING_POLICY_MATCH','MAPPING_CONTRACT_MATCH'];
  v_approvals text[] := array['data_owner','security_privacy','platform_db','store_operations'];
  i integer;
  j integer;
  inserted_validations integer := 0;
  v_value text;
begin
  insert into governance.master_source_snapshots(
    source_system,source_environment,source_version,snapshot_version,source_as_of,
    content_digest,mapping_contract_version,masking_policy_version,total_record_count,
    approval_reference,created_by
  ) values (
    'm061-local','test',p_tag,'snapshot-' || p_tag,statement_timestamp(),
    md5(p_tag) || md5(p_tag || '-digest'),'mapping-v1','masking-v1',p_total_record_count,
    'APR:M061:' || p_tag,'audit:m061'
  ) returning source_snapshot_id into v_id;

  if p_manifest_count > 0 then
    for i in 1..p_manifest_count loop
      insert into governance.snapshot_master_manifests(
        source_snapshot_id,master_type,record_count,content_hash,schema_version,
        source_extract_version,masking_status,mapping_status,validation_status
      ) values (
        v_id,v_masters[i],1,md5(p_tag || i::text) || md5(p_tag || i::text || '-hash'),
        'schema-v1','extract-v1','passed','passed','passed'
      );
    end loop;
  end if;

  if p_validation_count > 0 then
    for i in 1..5 loop
      for j in 1..5 loop
        exit when inserted_validations >= p_validation_count;
        v_value := case v_codes[j]
          when 'HASH_MATCH' then 'sha256:' || md5(p_tag || i::text) || md5(p_tag || i::text || '-hash')
          when 'RECORD_COUNT_MATCH' then 'count:1'
          when 'SCHEMA_MATCH' then 'version:schema-v1'
          when 'MASKING_POLICY_MATCH' then 'version:masking-v1'
          else 'version:mapping-v1'
        end;
        insert into governance.snapshot_validation_results(
          source_snapshot_id,master_type,validation_code,validation_status,
          expected_value,actual_value,checked_at
        ) values (v_id,v_masters[i],v_codes[j],'passed',v_value,v_value,statement_timestamp());
        inserted_validations := inserted_validations + 1;
      end loop;
      exit when inserted_validations >= p_validation_count;
    end loop;
  end if;

  if p_approval_count > 0 then
    for i in 1..p_approval_count loop
      insert into governance.snapshot_approvals(
        source_snapshot_id,approval_type,approval_reference,approved_by,approved_at,approval_status
      ) values (v_id,v_approvals[i],'APR:M061:' || p_tag,'audit:m061',statement_timestamp(),'approved');
    end loop;
  end if;
  return v_id;
end
$function$;

do $test$
declare
  v_id uuid;
  v_normal uuid;
  v_count bigint;
begin
  -- M061 header boundary.
  perform pg_temp.expect_failure('mapping_empty', $$insert into governance.master_source_snapshots
    (source_system,source_environment,source_version,snapshot_version,source_as_of,content_digest,mapping_contract_version,masking_policy_version,total_record_count,approval_reference,created_by)
    values ('m061-local','test','mapping-empty','mapping-empty',now(),repeat('1',64),'','mask-v1',0,'APR:M061','audit:m061')$$);
  perform pg_temp.expect_failure('mapping_whitespace', $$insert into governance.master_source_snapshots
    (source_system,source_environment,source_version,snapshot_version,source_as_of,content_digest,mapping_contract_version,masking_policy_version,total_record_count,approval_reference,created_by)
    values ('m061-local','test','mapping-space','mapping-space',now(),repeat('2',64),'   ','mask-v1',0,'APR:M061','audit:m061')$$);
  perform pg_temp.expect_failure('masking_empty', $$insert into governance.master_source_snapshots
    (source_system,source_environment,source_version,snapshot_version,source_as_of,content_digest,mapping_contract_version,masking_policy_version,total_record_count,approval_reference,created_by)
    values ('m061-local','test','masking-empty','masking-empty',now(),repeat('3',64),'map-v1','',0,'APR:M061','audit:m061')$$);
  perform pg_temp.expect_failure('masking_whitespace', $$insert into governance.master_source_snapshots
    (source_system,source_environment,source_version,snapshot_version,source_as_of,content_digest,mapping_contract_version,masking_policy_version,total_record_count,approval_reference,created_by)
    values ('m061-local','test','masking-space','masking-space',now(),repeat('4',64),'map-v1','   ',0,'APR:M061','audit:m061')$$);
  perform pg_temp.expect_failure('mapping_null', $$insert into governance.master_source_snapshots
    (source_system,source_environment,source_version,snapshot_version,source_as_of,content_digest,mapping_contract_version,masking_policy_version,total_record_count,approval_reference,created_by)
    values ('m061-local','test','mapping-null','mapping-null',now(),repeat('5',64),null,'mask-v1',0,'APR:M061','audit:m061')$$);
  perform pg_temp.expect_failure('masking_null', $$insert into governance.master_source_snapshots
    (source_system,source_environment,source_version,snapshot_version,source_as_of,content_digest,mapping_contract_version,masking_policy_version,total_record_count,approval_reference,created_by)
    values ('m061-local','test','masking-null','masking-null',now(),repeat('6',64),'map-v1',null,0,'APR:M061','audit:m061')$$);
  perform pg_temp.expect_failure('source_version_missing', $$insert into governance.master_source_snapshots
    (source_system,source_environment,source_version,snapshot_version,source_as_of,content_digest,mapping_contract_version,masking_policy_version,total_record_count,approval_reference,created_by)
    values ('m061-local','test','   ','source-missing',now(),repeat('7',64),'map-v1','mask-v1',0,'APR:M061','audit:m061')$$);

  -- Mismatch evidence cannot claim passed; matching evidence can.
  v_id := pg_temp.seed_snapshot('evidence',0,0,0,0);
  perform pg_temp.expect_failure('hash_mismatch_passed',format($sql$insert into governance.snapshot_validation_results
    (source_snapshot_id,master_type,validation_code,validation_status,expected_value,actual_value,checked_at)
    values (%L,'corporations','HASH_MATCH','passed','sha256:%s','sha256:%s',now())$sql$,
    v_id,repeat('a',64),repeat('b',64)));
  perform pg_temp.expect_failure('mapping_mismatch_passed',format($sql$insert into governance.snapshot_validation_results
    (source_snapshot_id,master_type,validation_code,validation_status,expected_value,actual_value,checked_at)
    values (%L,'stores','MAPPING_CONTRACT_MATCH','passed','version:mapping-v1','version:mapping-v2',now())$sql$,v_id));
  perform pg_temp.expect_failure('masking_mismatch_passed',format($sql$insert into governance.snapshot_validation_results
    (source_snapshot_id,master_type,validation_code,validation_status,expected_value,actual_value,checked_at)
    values (%L,'departments','MASKING_POLICY_MATCH','passed','version:masking-v1','version:masking-v2',now())$sql$,v_id));
  insert into governance.snapshot_validation_results(
    source_snapshot_id,master_type,validation_code,validation_status,expected_value,actual_value,checked_at
  ) values (v_id,'employees','MAPPING_CONTRACT_MATCH','passed','version:mapping-v1','version:mapping-v1',now());

  -- M011 activation negative gates.
  v_id := pg_temp.seed_snapshot('manifest-short',4,0,0,4);
  update governance.master_source_snapshots set status='validated' where source_snapshot_id=v_id;
  perform pg_temp.expect_failure('manifest_missing',format('update governance.master_source_snapshots set status=%L where source_snapshot_id=%L','activated',v_id),'BDF_SNAPSHOT_REQUIRES_FIVE_PASSED_MANIFESTS');

  v_id := pg_temp.seed_snapshot('count-mismatch',5,0,0,4);
  update governance.master_source_snapshots set status='validated' where source_snapshot_id=v_id;
  perform pg_temp.expect_failure('record_count_mismatch',format('update governance.master_source_snapshots set status=%L where source_snapshot_id=%L','activated',v_id),'BDF_SNAPSHOT_TOTAL_RECORD_COUNT_MISMATCH');

  v_id := pg_temp.seed_snapshot('validation-short',5,24,0,5);
  update governance.master_source_snapshots set status='validated' where source_snapshot_id=v_id;
  perform pg_temp.expect_failure('validation_missing',format('update governance.master_source_snapshots set status=%L where source_snapshot_id=%L','activated',v_id),'BDF_SNAPSHOT_REQUIRES_ALL_MASTER_VALIDATIONS');

  v_id := pg_temp.seed_snapshot('approval-short',5,25,3,5);
  update governance.master_source_snapshots set status='validated' where source_snapshot_id=v_id;
  perform pg_temp.expect_failure('approval_missing',format('update governance.master_source_snapshots set status=%L where source_snapshot_id=%L','activated',v_id),'BDF_SNAPSHOT_APPROVAL_INCOMPLETE');

  -- Constraint negatives.
  v_id := pg_temp.seed_snapshot('constraint-negative',0,0,0,0);
  perform pg_temp.expect_failure('unknown_master_type',format($sql$insert into governance.snapshot_master_manifests
    (source_snapshot_id,master_type,record_count,content_hash,schema_version,source_extract_version,masking_status,mapping_status,validation_status)
    values (%L,'unknown',0,%L,'v1','v1','passed','passed','passed')$sql$,v_id,repeat('c',64)));
  perform pg_temp.expect_failure('negative_record_count',format($sql$insert into governance.snapshot_master_manifests
    (source_snapshot_id,master_type,record_count,content_hash,schema_version,source_extract_version,masking_status,mapping_status,validation_status)
    values (%L,'corporations',-1,%L,'v1','v1','passed','passed','passed')$sql$,v_id,repeat('d',64)));
  insert into governance.snapshot_master_manifests
    (source_snapshot_id,master_type,record_count,content_hash,schema_version,source_extract_version,masking_status,mapping_status,validation_status)
  values (v_id,'corporations',0,repeat('e',64),'v1','v1','passed','passed','passed');
  perform pg_temp.expect_failure('duplicate_manifest',format($sql$insert into governance.snapshot_master_manifests
    (source_snapshot_id,master_type,record_count,content_hash,schema_version,source_extract_version,masking_status,mapping_status,validation_status)
    values (%L,'corporations',0,%L,'v1','v1','passed','passed','passed')$sql$,v_id,repeat('f',64)));
  perform pg_temp.expect_failure('duplicate_source_version',$$insert into governance.master_source_snapshots
    (source_system,source_environment,source_version,snapshot_version,source_as_of,content_digest,mapping_contract_version,masking_policy_version,total_record_count,approval_reference,created_by)
    values ('m061-local','test','constraint-negative','duplicate-source',now(),repeat('0',64),'mapping-v1','masking-v1',0,'APR:M061','audit:m061')$$);

  -- Normal 5/25/4 activation.
  v_normal := pg_temp.seed_snapshot('normal',5,25,4,5);
  update governance.master_source_snapshots set status='validated' where source_snapshot_id=v_normal;
  update governance.master_source_snapshots set status='activated' where source_snapshot_id=v_normal;
  if (select status from governance.master_source_snapshots where source_snapshot_id=v_normal) <> 'activated' then
    raise exception 'M061_NORMAL_ACTIVATION_FAILED';
  end if;

  -- Immutable boundary after activation and for all child ledgers.
  perform pg_temp.expect_failure('activated_header_update',format('update governance.master_source_snapshots set approval_reference=%L where source_snapshot_id=%L','APR:M061:changed',v_normal),'BDF_SNAPSHOT_CONFIRMED_IMMUTABLE');
  perform pg_temp.expect_failure('activated_header_delete',format('delete from governance.master_source_snapshots where source_snapshot_id=%L',v_normal),'BDF_SNAPSHOT_DELETE_FORBIDDEN');
  perform pg_temp.expect_failure('manifest_update',format('update governance.snapshot_master_manifests set record_count=2 where source_snapshot_id=%L',v_normal));
  perform pg_temp.expect_failure('manifest_delete',format('delete from governance.snapshot_master_manifests where source_snapshot_id=%L',v_normal));
  perform pg_temp.expect_failure('approval_update',format('update governance.snapshot_approvals set approval_status=%L where source_snapshot_id=%L','rejected',v_normal));
  perform pg_temp.expect_failure('approval_delete',format('delete from governance.snapshot_approvals where source_snapshot_id=%L',v_normal));
  perform pg_temp.expect_failure('validation_update',format('update governance.snapshot_validation_results set validation_status=%L where source_snapshot_id=%L','failed',v_normal));
  perform pg_temp.expect_failure('validation_delete',format('delete from governance.snapshot_validation_results where source_snapshot_id=%L',v_normal));

  select count(*) into v_count from governance.snapshot_validation_results where source_snapshot_id=v_normal;
  if v_count <> 25 then raise exception 'M061_NORMAL_VALIDATION_COUNT expected=25 actual=%',v_count; end if;
  raise notice 'M061_FULL_GATE_PASS normal_header=1 manifests=5 validations=25 approvals=4';
end
$test$;

rollback;

do $residue$
declare v_rows bigint;
begin
  select
    (select count(*) from governance.master_source_snapshots) +
    (select count(*) from governance.snapshot_master_manifests) +
    (select count(*) from governance.snapshot_approvals) +
    (select count(*) from governance.snapshot_validation_results)
  into v_rows;
  if v_rows <> 0 then raise exception 'M061_FIXTURE_RESIDUE actual=%',v_rows; end if;
  raise notice 'M061_FIXTURE_RESIDUE_ZERO';
end
$residue$;
