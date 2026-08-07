-- PR002 / ACF-01 / M012 fail-closed catalog validation.
do $validation$
declare
  actual_tables integer;
  required_columns integer;
  forced_rls_tables integer;
  forbidden_grants integer;
  forbidden_columns integer;
  required_constraints integer;
  required_indexes integer;
  required_triggers integer;
  invoker_functions integer;
  forbidden_schema_privileges integer;
  forbidden_function_privileges integer;
  guard_definition text;
begin
  select count(*) into actual_tables
  from information_schema.tables
  where table_schema = 'accounting';
  if actual_tables <> 3 then
    raise exception 'BDF_M012_TABLE_COUNT expected=3 actual=%', actual_tables;
  end if;

  select count(*) into required_columns
  from information_schema.columns
  where table_schema = 'accounting'
    and (
      (table_name = 'import_batches' and column_name in (
        'import_batch_id', 'source_system', 'source_version', 'source_file',
        'source_period', 'imported_at', 'source_hash', 'schema_version',
        'mapping_contract_version', 'tax_normalization_contract_version',
        'status', 'created_by', 'recorded_at'
      ))
      or (table_name = 'import_files' and column_name in (
        'import_file_id', 'import_batch_id', 'file_name', 'file_type',
        'file_hash', 'row_count', 'validation_status', 'recorded_at'
      ))
      or (table_name = 'import_staging_lines' and column_name in (
        'staging_line_id', 'import_batch_id', 'import_file_id',
        'source_record_key_digest', 'source_line_no', 'row_digest',
        'accounting_period', 'corporation_source_key_digest',
        'store_source_key_digest', 'department_source_key_digest',
        'account_source_key_digest', 'scenario_type', 'measure_type',
        'source_amount', 'source_tax_basis', 'source_tax_category',
        'source_tax_rate', 'tax_rate_source_version', 'rounding_mode',
        'rounding_scope', 'rounding_unit', 'rounding_difference_amount',
        'normalized_amount', 'tax_basis', 'value_status',
        'normalization_status', 'mapping_status', 'validation_status', 'recorded_at'
      ))
    );
  if required_columns <> 50 then
    raise exception 'BDF_M012_REQUIRED_COLUMN_COUNT expected=50 actual=%', required_columns;
  end if;

  select count(*) into forced_rls_tables
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'accounting'
    and c.relname in ('import_batches', 'import_files', 'import_staging_lines')
    and c.relrowsecurity
    and c.relforcerowsecurity;
  if forced_rls_tables <> 3 then
    raise exception 'BDF_M012_RLS_FORCE_COUNT expected=3 actual=%', forced_rls_tables;
  end if;

  select count(*) into forbidden_grants
  from information_schema.role_table_grants
  where table_schema = 'accounting'
    and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role');
  if forbidden_grants <> 0 then
    raise exception 'BDF_M012_FORBIDDEN_GRANTS actual=%', forbidden_grants;
  end if;

  select count(*) into forbidden_schema_privileges
  from pg_catalog.pg_namespace n
  cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
  left join pg_catalog.pg_roles r on r.oid = a.grantee
  where n.nspname = 'accounting'
    and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'))
    and a.privilege_type in ('USAGE', 'CREATE');
  if forbidden_schema_privileges <> 0 then
    raise exception 'BDF_M012_FORBIDDEN_SCHEMA_PRIVILEGES actual=%', forbidden_schema_privileges;
  end if;

  select count(*) into forbidden_columns
  from information_schema.columns
  where table_schema = 'accounting'
    and lower(column_name) in (
      'email', 'phone', 'address', 'firebase_uid', 'bank_account',
      'tax_information', 'insurance_information', 'family_information',
      'raw_data', 'raw_payload', 'credential', 'secret', 'production_id'
    );
  if forbidden_columns <> 0 then
    raise exception 'BDF_M012_PII_OR_SECRET_COLUMN_DETECTED actual=%', forbidden_columns;
  end if;

  select count(*) into required_constraints
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_namespace n on n.oid = con.connamespace
  where n.nspname = 'accounting'
    and con.conname in (
      'accounting_import_batches_source_version_unique',
      'accounting_import_batches_source_digest_unique',
      'accounting_import_files_batch_hash_unique',
      'accounting_import_staging_lines_batch_file_fk',
      'accounting_import_staging_lines_stable_key_unique',
      'accounting_import_staging_lines_canonical_tax_basis',
      'accounting_import_staging_lines_amount_semantics',
      'accounting_import_staging_lines_tax_rate_range',
      'accounting_import_staging_lines_rounding_mode_check',
      'accounting_import_staging_lines_rounding_scope_check'
    );
  if required_constraints <> 10 then
    raise exception 'BDF_M012_REQUIRED_CONSTRAINT_COUNT expected=10 actual=%', required_constraints;
  end if;

  select count(*) into required_indexes
  from pg_catalog.pg_indexes
  where schemaname = 'accounting'
    and indexname in (
      'accounting_import_batches_period_status_idx',
      'accounting_import_files_batch_status_idx',
      'accounting_import_staging_lines_gate_idx',
      'accounting_import_staging_lines_period_scenario_idx'
    );
  if required_indexes <> 4 then
    raise exception 'BDF_M012_REQUIRED_INDEX_COUNT expected=4 actual=%', required_indexes;
  end if;

  select count(*) into required_triggers
  from information_schema.triggers
  where trigger_schema = 'accounting'
    and trigger_name in (
      'guard_import_batches_mutation',
      'guard_import_files_mutation',
      'guard_import_staging_lines_mutation'
    );
  if required_triggers <> 9 then
    raise exception 'BDF_M012_REQUIRED_TRIGGER_EVENT_COUNT expected=9 actual=%', required_triggers;
  end if;

  select count(*) into invoker_functions
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'accounting'
    and p.proname = 'guard_import_boundary_mutation'
    and not p.prosecdef;
  if invoker_functions <> 1 then
    raise exception 'BDF_M012_SECURITY_INVOKER_FUNCTION expected=1 actual=%', invoker_functions;
  end if;

  select count(*) into forbidden_function_privileges
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  left join pg_catalog.pg_roles r on r.oid = a.grantee
  where n.nspname = 'accounting'
    and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'))
    and a.privilege_type = 'EXECUTE';
  if forbidden_function_privileges <> 0 then
    raise exception 'BDF_M012_FORBIDDEN_FUNCTION_PRIVILEGES actual=%', forbidden_function_privileges;
  end if;

  select pg_get_functiondef('accounting.guard_import_boundary_mutation()'::regprocedure)
    into guard_definition;
  if position('BDF_ACCOUNTING_IMPORT_BATCH_VALIDATION_INCOMPLETE' in guard_definition) = 0
    or position('BDF_ACCOUNTING_IMPORT_PROMOTION_NOT_AVAILABLE_BEFORE_M014' in guard_definition) = 0
    or position('BDF_ACCOUNTING_IMPORT_BATCH_INITIAL_STATUS_INVALID' in guard_definition) = 0
    or position('BDF_ACCOUNTING_IMPORT_FILE_INITIAL_STATUS_INVALID' in guard_definition) = 0
    or position('BDF_ACCOUNTING_STAGING_LINE_INITIAL_STATUS_INVALID' in guard_definition) = 0
    or position('BDF_ACCOUNTING_IMPORT_BATCH_IMMUTABLE' in guard_definition) = 0
    or position('BDF_ACCOUNTING_STAGING_SOURCE_FIELDS_IMMUTABLE' in guard_definition) = 0
    or position('BDF_ACCOUNTING_IMPORT_DELETE_FORBIDDEN' in guard_definition) = 0 then
    raise exception 'BDF_M012_LIFECYCLE_OR_IMMUTABILITY_GATE_MISSING';
  end if;
end
$validation$;
