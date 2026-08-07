-- M061-only rollback. M001-M011 and M012 remain intact.

alter table governance.snapshot_validation_results
  drop constraint snapshot_validation_results_status_value_consistency;

alter table governance.master_source_snapshots
  drop constraint master_source_snapshots_masking_policy_version_nonblank,
  drop constraint master_source_snapshots_mapping_contract_version_nonblank;
