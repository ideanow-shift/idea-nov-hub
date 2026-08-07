-- PR001-B1 M011 fail-closed catalog and contract validation.
do $validation$
declare
  required_columns integer;
  required_tables integer;
  forced_rls_tables integer;
  forbidden_grants integer;
  forbidden_columns integer;
begin
  select count(*) into required_tables
  from information_schema.tables
  where table_schema = 'governance'
    and table_name in (
      'snapshot_master_manifests',
      'snapshot_approvals',
      'snapshot_validation_results'
    );
  if required_tables <> 3 then
    raise exception 'BDF_B1_REQUIRED_TABLE_COUNT expected=3 actual=%', required_tables;
  end if;

  select count(*) into required_columns
  from information_schema.columns
  where table_schema = 'governance'
    and (
      (table_name = 'master_source_snapshots' and column_name in (
        'source_snapshot_id', 'snapshot_version', 'source_system', 'source_version',
        'source_as_of', 'content_digest', 'total_record_count',
        'mapping_contract_version', 'masking_policy_version',
        'approval_reference', 'created_by', 'status', 'recorded_at'
      ))
      or (table_name = 'snapshot_master_manifests' and column_name in (
        'source_snapshot_id', 'master_type', 'record_count', 'content_hash',
        'schema_version', 'source_extract_version', 'masking_status',
        'mapping_status', 'validation_status', 'created_at'
      ))
      or (table_name = 'snapshot_approvals' and column_name in (
        'snapshot_approval_id', 'source_snapshot_id', 'approval_type',
        'approval_reference', 'approved_by', 'approved_at',
        'approval_status', 'created_at'
      ))
      or (table_name = 'snapshot_validation_results' and column_name in (
        'snapshot_validation_result_id', 'source_snapshot_id', 'master_type',
        'validation_code', 'validation_status', 'expected_value',
        'actual_value', 'checked_at', 'created_at'
      ))
    );
  if required_columns <> 40 then
    raise exception 'BDF_B1_REQUIRED_COLUMN_COUNT expected=40 actual=%', required_columns;
  end if;

  select count(*) into forced_rls_tables
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'governance'
    and c.relname in (
      'snapshot_master_manifests',
      'snapshot_approvals',
      'snapshot_validation_results'
    )
    and c.relrowsecurity
    and c.relforcerowsecurity;
  if forced_rls_tables <> 3 then
    raise exception 'BDF_B1_RLS_FORCE_COUNT expected=3 actual=%', forced_rls_tables;
  end if;

  select count(*) into forbidden_grants
  from information_schema.role_table_grants
  where table_schema = 'governance'
    and table_name in (
      'snapshot_master_manifests',
      'snapshot_approvals',
      'snapshot_validation_results'
    )
    and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role');
  if forbidden_grants <> 0 then
    raise exception 'BDF_B1_FORBIDDEN_GRANTS actual=%', forbidden_grants;
  end if;

  select count(*) into forbidden_columns
  from information_schema.columns
  where table_schema = 'governance'
    and table_name in (
      'master_source_snapshots',
      'snapshot_master_manifests',
      'snapshot_approvals',
      'snapshot_validation_results'
    )
    and lower(column_name) in (
      'email', 'phone', 'address', 'firebase_uid', 'bank_account',
      'tax_information', 'insurance_information', 'family_information',
      'raw_data', 'credential', 'secret'
    );
  if forbidden_columns <> 0 then
    raise exception 'BDF_B1_PII_OR_SECRET_COLUMN_DETECTED actual=%', forbidden_columns;
  end if;

  if position('BDF_SNAPSHOT_APPROVAL_INCOMPLETE' in pg_get_functiondef(
    'governance.assert_snapshot_activation_ready(uuid)'::regprocedure
  )) = 0 then
    raise exception 'BDF_B1_ACTIVATION_APPROVAL_GATE_MISSING';
  end if;
end
$validation$;
