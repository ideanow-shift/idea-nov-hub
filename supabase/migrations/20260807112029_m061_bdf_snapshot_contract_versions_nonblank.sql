-- PR001-B1 / M061 corrective migration.
-- Additive fail-closed repair for the already-applied M011 Snapshot contract.

do $preflight$
begin
  if exists (
    select 1
    from governance.master_source_snapshots
    where mapping_contract_version is null
       or btrim(mapping_contract_version) = ''
       or masking_policy_version is null
       or btrim(masking_policy_version) = ''
  ) then
    raise exception 'BDF_M061_EXISTING_BLANK_CONTRACT_VERSION';
  end if;

  if exists (
    select 1
    from governance.snapshot_validation_results
    where (validation_status = 'passed') <> (expected_value = actual_value)
  ) then
    raise exception 'BDF_M061_EXISTING_VALIDATION_TRUTH_MISMATCH';
  end if;
end
$preflight$;

alter table governance.master_source_snapshots
  add constraint master_source_snapshots_mapping_contract_version_nonblank
    check (btrim(mapping_contract_version) <> ''),
  add constraint master_source_snapshots_masking_policy_version_nonblank
    check (btrim(masking_policy_version) <> '');

alter table governance.snapshot_validation_results
  add constraint snapshot_validation_results_status_value_consistency
    check ((validation_status = 'passed') = (expected_value = actual_value));
