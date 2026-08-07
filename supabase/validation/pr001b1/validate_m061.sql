-- M061 fail-closed catalog and data validation.
do $validation$
declare
  constraint_count integer;
  violation_count bigint;
begin
  select count(*) into constraint_count
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_class t on t.oid = c.conrelid
  join pg_catalog.pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'governance'
    and (
      (t.relname = 'master_source_snapshots' and c.conname in (
        'master_source_snapshots_mapping_contract_version_nonblank',
        'master_source_snapshots_masking_policy_version_nonblank'
      ))
      or (t.relname = 'snapshot_validation_results'
        and c.conname = 'snapshot_validation_results_status_value_consistency')
    )
    and c.contype = 'c'
    and c.convalidated;

  if constraint_count <> 3 then
    raise exception 'BDF_M061_REQUIRED_CONSTRAINT_COUNT expected=3 actual=%', constraint_count;
  end if;

  select count(*) into violation_count
  from governance.master_source_snapshots
  where mapping_contract_version is null
     or btrim(mapping_contract_version) = ''
     or masking_policy_version is null
     or btrim(masking_policy_version) = '';
  if violation_count <> 0 then
    raise exception 'BDF_M061_BLANK_CONTRACT_VERSION_ROWS actual=%', violation_count;
  end if;

  select count(*) into violation_count
  from governance.snapshot_validation_results
  where (validation_status = 'passed') <> (expected_value = actual_value);
  if violation_count <> 0 then
    raise exception 'BDF_M061_VALIDATION_TRUTH_MISMATCH_ROWS actual=%', violation_count;
  end if;
end
$validation$;
