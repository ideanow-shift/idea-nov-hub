-- M013 fail-closed catalog validation. Raises on every contract drift.
do $validation$
declare
  actual_count integer;
begin
  select count(*) into actual_count
  from information_schema.tables
  where table_schema = 'accounting'
    and table_name in ('account_identities', 'accounts', 'account_statement_mappings');
  if actual_count <> 3 then raise exception 'BDF_M013_TABLE_COUNT'; end if;

  select count(*) into actual_count
  from information_schema.columns
  where table_schema = 'accounting'
    and (
      (table_name = 'account_identities' and column_name in ('account_id', 'created_at', 'created_by'))
      or (table_name = 'accounts' and column_name in (
        'account_version_id', 'account_id', 'version_no', 'account_code', 'account_name',
        'account_type', 'statement_type', 'account_category', 'normal_balance', 'sign_policy',
        'measure_type', 'parent_account_id', 'display_order', 'effective_from', 'effective_to',
        'effective_period', 'status', 'source_snapshot_id', 'source_version',
        'mapping_contract_version', 'content_digest', 'supersedes_account_version_id',
        'recorded_at', 'recorded_by'
      ))
      or (table_name = 'account_statement_mappings' and column_name in (
        'statement_mapping_version_id', 'account_id', 'account_version_id', 'version_no',
        'statement_type', 'statement_section', 'statement_line', 'display_order',
        'aggregation_behavior', 'contribution_sign', 'effective_from', 'effective_to',
        'effective_period', 'status', 'mapping_contract_version', 'content_digest',
        'supersedes_mapping_version_id', 'recorded_at', 'recorded_by'
      ))
    );
  if actual_count <> 46 then raise exception 'BDF_M013_REQUIRED_COLUMN_COUNT %', actual_count; end if;

  select count(*) into actual_count
  from pg_constraint c
  where c.conrelid in (
    'accounting.account_identities'::regclass,
    'accounting.accounts'::regclass,
    'accounting.account_statement_mappings'::regclass
  ) and c.contype in ('p', 'f', 'u', 'c', 'x');
  if actual_count < 39 then raise exception 'BDF_M013_REQUIRED_CONSTRAINT_COUNT %', actual_count; end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'accounting.accounts'::regclass
      and conname = 'accounting_accounts_identity_period_excl' and contype = 'x'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'accounting.accounts'::regclass
      and conname = 'accounting_accounts_code_period_excl' and contype = 'x'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'accounting.account_statement_mappings'::regclass
      and conname = 'accounting_statement_mappings_account_period_excl' and contype = 'x'
  ) then raise exception 'BDF_M013_EFFECTIVE_OVERLAP_GUARD'; end if;

  select count(*) into actual_count
  from pg_index i
  where i.indrelid in ('accounting.accounts'::regclass, 'accounting.account_statement_mappings'::regclass)
    and not i.indisprimary;
  if actual_count < 12 then raise exception 'BDF_M013_REQUIRED_INDEX_COUNT %', actual_count; end if;

  select count(*) into actual_count
  from pg_trigger t
  where t.tgrelid in (
    'accounting.account_identities'::regclass,
    'accounting.accounts'::regclass,
    'accounting.account_statement_mappings'::regclass
  ) and not t.tgisinternal;
  if actual_count <> 5 then raise exception 'BDF_M013_TRIGGER_COUNT %', actual_count; end if;

  select count(*) into actual_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'accounting'
    and p.proname in (
      'guard_account_master_mutation',
      'validate_account_version_insert',
      'validate_statement_mapping_insert'
    ) and not p.prosecdef
    and exists (
      select 1 from unnest(p.proconfig) setting
      where setting in ('search_path=', 'search_path=""')
    );
  if actual_count <> 3 then raise exception 'BDF_M013_SECURITY_INVOKER_FUNCTIONS'; end if;

  select count(*) into actual_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'accounting'
    and c.relname in ('account_identities', 'accounts', 'account_statement_mappings')
    and c.relrowsecurity and c.relforcerowsecurity;
  if actual_count <> 3 then raise exception 'BDF_M013_RLS_FORCE_COUNT'; end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'accounting'
      and table_name in ('account_identities', 'accounts', 'account_statement_mappings')
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ) then raise exception 'BDF_M013_FORBIDDEN_GRANTS'; end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'accounting' and p.prosecdef
  ) then raise exception 'BDF_M013_SECURITY_DEFINER'; end if;

  if exists (
    select 1 from information_schema.views
    where table_schema in ('public', 'projection')
      and table_name like '%account%'
  ) then raise exception 'BDF_M013_CONSUMER_VIEW_PROHIBITED'; end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'accounting'
      and table_name in ('account_identities', 'accounts', 'account_statement_mappings')
      and lower(column_name) ~ '(email|phone|address|firebase|bank|insurance|family|production_id|raw_payload)'
  ) then raise exception 'BDF_M013_PII_OR_PRODUCTION_COLUMN'; end if;
end
$validation$;
