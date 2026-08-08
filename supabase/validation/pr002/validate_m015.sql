-- M015 fail-closed catalog validation.
do $validation$
declare
  n integer;
  body text;
begin
  select count(*) into n from information_schema.tables
  where table_schema = 'accounting' and table_name in (
    'journal_entries','journal_lines','accounting_facts',
    'allocation_rule_versions','allocation_sets','accounting_allocations'
  );
  if n <> 6 then raise exception 'BDF_M015_TABLE_COUNT %', n; end if;

  if not exists (select 1 from pg_constraint where conrelid='accounting.journal_entries'::regclass
      and conname='accounting_journal_entries_version_source_unique')
    or not exists (select 1 from pg_indexes where schemaname='accounting'
      and indexname='accounting_journal_lines_import_stable_unique')
    or not exists (select 1 from pg_indexes where schemaname='accounting'
      and indexname='accounting_journal_lines_planning_stable_unique') then
    raise exception 'BDF_M015_DUPLICATE_CONTRACT';
  end if;

  if not exists (select 1 from pg_constraint where conrelid='accounting.accounting_facts'::regclass
      and conname='accounting_facts_journal_line_id_key')
    or not exists (select 1 from pg_constraint where conrelid='accounting.accounting_facts'::regclass
      and conname='accounting_facts_tax_basis_check')
    or not exists (select 1 from pg_constraint where conrelid='accounting.accounting_facts'::regclass
      and conname='accounting_facts_amount_semantics')
    or not exists (select 1 from pg_constraint where conrelid='accounting.accounting_facts'::regclass
      and conname='accounting_facts_amount_finite')
    or not exists (select 1 from pg_constraint where conrelid='accounting.accounting_facts'::regclass
      and conname='accounting_facts_attribution_check')
    or not exists (select 1 from pg_constraint where conrelid='accounting.journal_lines'::regclass
      and conname='accounting_journal_lines_source_shape') then
    raise exception 'BDF_M015_FACT_CONTRACT';
  end if;

  if not exists (select 1 from pg_constraint where conrelid='accounting.allocation_rule_versions'::regclass
      and conname='accounting_allocation_rules_identity_period_excl')
    or not exists (select 1 from pg_constraint where conrelid='accounting.accounting_allocations'::regclass
      and conname='accounting_allocations_target_unique')
    or not exists (select 1 from pg_constraint where conrelid='accounting.accounting_allocations'::regclass
      and conname='accounting_allocations_attribution_check')
    or not exists (select 1 from pg_constraint where conrelid='accounting.allocation_sets'::regclass
      and conname='accounting_allocation_sets_amount_finite')
    or not exists (select 1 from pg_constraint where conrelid='accounting.accounting_allocations'::regclass
      and conname='accounting_allocations_amount_finite') then
    raise exception 'BDF_M015_ALLOCATION_CONTRACT';
  end if;

  select count(*) into n from pg_indexes where schemaname='accounting' and indexname in (
    'accounting_journal_lines_account_version_idx',
    'accounting_journal_lines_corporation_version_idx',
    'accounting_journal_lines_store_version_idx',
    'accounting_journal_lines_department_version_idx',
    'accounting_allocations_target_corporation_version_idx',
    'accounting_allocations_target_store_version_idx',
    'accounting_allocations_target_department_version_idx'
  );
  if n <> 7 then raise exception 'BDF_M015_VERSION_FK_INDEX_COUNT %', n; end if;

  select pg_get_functiondef(p.oid) into body from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='accounting' and p.proname='validate_journal_line_insert';
  if body is null
    or position('BDF_JOURNAL_LINE_IMPORT_SOURCE_NOT_ELIGIBLE' in body)=0
    or position('s.validation_status = ''valid''' in body)=0
    or position('s.normalization_status = ''passed''' in body)=0
    or position('s.mapping_status = ''passed''' in body)=0
    or position('s.tax_basis = ''exclusive''' in body)=0
    or position('account_version_matches_period' in body)=0
    or position('organization_scope_is_valid' in body)=0 then
    raise exception 'BDF_M015_JOURNAL_LINE_GUARD';
  end if;
  if position('s.source_tax_basis in (''exclusive'', ''inclusive'', ''exempt'', ''non_taxable'')' in body)=0
    or position('s.source_tax_category <> ''unknown''' in body)=0
    or position('lower(btrim(s.tax_rate_source_version)) <> ''unknown''' in body)=0
    or position('s.source_tax_rate is not null' in body)=0
    or position('s.source_tax_rate between 0 and 1' in body)=0
    or position('s.source_amount is not null' in body)=0
    or position('s.source_amount not in' in body)=0
    or position('s.value_status = ''observed''' in body)=0
    or position('s.value_status = ''zero''' in body)=0
    or position('s.value_status = ''not_applicable''' in body)=0
    or position('s.normalized_amount not in' in body)=0
    or position('s.rounding_unit is null or' in body)=0
    or position('s.rounding_unit > 0' in body)=0
    or position('s.rounding_difference_amount is null' in body)=0
    or position('s.rounding_difference_amount not in' in body)=0
    or position('s.rounding_mode in (''floor'', ''ceiling'', ''half_up'', ''half_even'', ''truncate'')' in body)=0
    or position('s.rounding_scope in (''line'', ''document'')' in body)=0
    or position('s.rounding_unit is not null' in body)=0
    or position('s.rounding_difference_amount is not null' in body)=0
    or position('s.rounding_mode = ''not_applicable''' in body)=0
    or position('s.rounding_scope = ''not_applicable''' in body)=0 then
    raise exception 'BDF_M015_ACTUAL_TAX_ROUNDING_EVIDENCE_GUARD';
  end if;

  select pg_get_functiondef(p.oid) into body from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='accounting' and p.proname='validate_accounting_fact_insert';
  if body is null
    or position('BDF_ACCOUNTING_FACT_TAX_NORMALIZATION_MISMATCH' in body)=0
    or position('s.source_tax_basis in (''exclusive'', ''inclusive'', ''exempt'', ''non_taxable'')' in body)=0
    or position('s.source_tax_category <> ''unknown''' in body)=0
    or position('lower(btrim(s.tax_rate_source_version)) <> ''unknown''' in body)=0
    or position('s.source_tax_rate between 0 and 1' in body)=0
    or position('s.source_amount is not null' in body)=0
    or position('s.source_amount not in' in body)=0
    or position('s.normalized_amount not in' in body)=0
    or position('s.rounding_unit > 0' in body)=0
    or position('s.rounding_difference_amount not in' in body)=0
    or position('s.rounding_unit is not null' in body)=0
    or position('s.rounding_difference_amount is not null' in body)=0
    or position('s.rounding_mode = ''not_applicable''' in body)=0
    or position('s.rounding_scope = ''not_applicable''' in body)=0 then
    raise exception 'BDF_M015_ACCOUNTING_FACT_EVIDENCE_GUARD';
  end if;

  select pg_get_functiondef(p.oid) into body from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='accounting' and p.proname='guard_allocation_set_mutation';
  if body is null
    or position('BDF_ALLOCATION_RECONCILIATION_FAILED' in body)=0
    or position('pg_advisory_xact_lock' in body)=0 then
    raise exception 'BDF_M015_ALLOCATION_RECONCILIATION_GUARD';
  end if;

  select pg_get_functiondef(p.oid) into body from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='accounting' and p.proname='guard_accounting_allocation_mutation';
  if body is null
    or position('BDF_ACCOUNTING_ALLOCATION_RULE_SCOPE_MISMATCH' in body)=0 then
    raise exception 'BDF_M015_ALLOCATION_RULE_SCOPE_GUARD';
  end if;

  select pg_get_functiondef(p.oid) into body from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='accounting' and p.proname='guard_import_membership_seal_m015';
  if body is null
    or position('lock table accounting.import_files in share mode' in body)=0
    or position('lock table accounting.import_staging_lines in share mode' in body)=0
    or position('BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED' in body)=0 then
    raise exception 'BDF_M015_IMPORT_MEMBERSHIP_SEAL_GUARD';
  end if;

  select count(*) into n from pg_trigger t
  join pg_class c on c.oid=t.tgrelid join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='accounting' and c.relname in (
    'journal_entries','journal_lines','accounting_facts',
    'allocation_rule_versions','allocation_sets','accounting_allocations'
  ) and not t.tgisinternal;
  if n <> 9 then raise exception 'BDF_M015_TRIGGER_COUNT %', n; end if;

  select count(*) into n
  from (values
    ('journal_entries','validate_journal_entry_insert','validate_journal_entry_insert',7),
    ('journal_entries','reject_journal_entry_mutation','reject_ledger_mutation',27),
    ('journal_lines','validate_journal_line_insert','validate_journal_line_insert',7),
    ('journal_lines','reject_journal_line_mutation','reject_ledger_mutation',27),
    ('accounting_facts','validate_accounting_fact_insert','validate_accounting_fact_insert',7),
    ('accounting_facts','reject_accounting_fact_mutation','reject_ledger_mutation',27),
    ('allocation_rule_versions','guard_allocation_rule_mutation','guard_allocation_rule_mutation',31),
    ('allocation_sets','guard_allocation_set_mutation','guard_allocation_set_mutation',31),
    ('accounting_allocations','guard_accounting_allocation_mutation','guard_accounting_allocation_mutation',31)
  ) expected(table_name,trigger_name,function_name,trigger_type)
  join pg_namespace ns on ns.nspname='accounting'
  join pg_class c on c.relnamespace=ns.oid and c.relname=expected.table_name
  join pg_trigger t on t.tgrelid=c.oid and t.tgname=expected.trigger_name
    and t.tgtype=expected.trigger_type and not t.tgisinternal
  join pg_proc p on p.oid=t.tgfoid and p.proname=expected.function_name;
  if n <> 9 then raise exception 'BDF_M015_TRIGGER_BINDING_COUNT %', n; end if;

  select count(*) into n
  from (values
    ('import_batches','a_m015_lock_import_batch_membership','guard_import_membership_seal_m015',19),
    ('import_files','a_m015_seal_import_files','guard_import_membership_seal_m015',31),
    ('import_staging_lines','a_m015_seal_import_staging_lines','guard_import_membership_seal_m015',31)
  ) expected(table_name,trigger_name,function_name,trigger_type)
  join pg_namespace ns on ns.nspname='accounting'
  join pg_class c on c.relnamespace=ns.oid and c.relname=expected.table_name
  join pg_trigger t on t.tgrelid=c.oid and t.tgname=expected.trigger_name
    and t.tgtype=expected.trigger_type and not t.tgisinternal
  join pg_proc p on p.oid=t.tgfoid and p.proname=expected.function_name;
  if n <> 3 then raise exception 'BDF_M015_IMPORT_SEAL_TRIGGER_BINDING_COUNT %', n; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='accounting' and p.proname in (
    'organization_scope_is_valid','account_version_matches_period','reject_ledger_mutation',
    'validate_journal_entry_insert','validate_journal_line_insert','validate_accounting_fact_insert',
    'guard_allocation_rule_mutation','guard_allocation_set_mutation','guard_accounting_allocation_mutation',
    'guard_import_membership_seal_m015'
  ) and not p.prosecdef and exists (
    select 1 from unnest(p.proconfig) setting
    where setting in ('search_path=', 'search_path=""')
  );
  if n <> 10 then raise exception 'BDF_M015_SECURITY_INVOKER_FUNCTIONS %', n; end if;

  select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
  where ns.nspname='accounting' and c.relname in (
    'journal_entries','journal_lines','accounting_facts',
    'allocation_rule_versions','allocation_sets','accounting_allocations'
  ) and c.relrowsecurity and c.relforcerowsecurity;
  if n <> 6 then raise exception 'BDF_M015_RLS_FORCE_COUNT %', n; end if;

  if exists (select 1 from information_schema.role_table_grants
    where table_schema='accounting' and table_name in (
      'journal_entries','journal_lines','accounting_facts',
      'allocation_rule_versions','allocation_sets','accounting_allocations'
    ) and grantee in ('PUBLIC','anon','authenticated','service_role')) then
    raise exception 'BDF_M015_FORBIDDEN_GRANTS';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='accounting' and p.proname in (
      'organization_scope_is_valid','account_version_matches_period','reject_ledger_mutation',
      'validate_journal_entry_insert','validate_journal_line_insert','validate_accounting_fact_insert',
      'guard_allocation_rule_mutation','guard_allocation_set_mutation','guard_accounting_allocation_mutation',
      'guard_import_membership_seal_m015'
    ) and p.prosecdef) then raise exception 'BDF_M015_SECURITY_DEFINER'; end if;
  if exists (select 1 from information_schema.routine_privileges
    where specific_schema='accounting' and routine_name in (
      'organization_scope_is_valid','account_version_matches_period','reject_ledger_mutation',
      'validate_journal_entry_insert','validate_journal_line_insert','validate_accounting_fact_insert',
      'guard_allocation_rule_mutation','guard_allocation_set_mutation','guard_accounting_allocation_mutation',
      'guard_import_membership_seal_m015'
    ) and grantee in ('PUBLIC','anon','authenticated','service_role')) then
    raise exception 'BDF_M015_FORBIDDEN_FUNCTION_GRANT';
  end if;
  if exists (select 1 from information_schema.views
    where table_schema in ('public','projection')
      and table_name ~ '(journal|accounting_fact|allocation)') then
    raise exception 'BDF_M015_CONSUMER_VIEW';
  end if;
  if exists (select 1 from information_schema.columns
    where table_schema='accounting' and table_name in (
      'journal_entries','journal_lines','accounting_facts',
      'allocation_rule_versions','allocation_sets','accounting_allocations'
    ) and lower(column_name) ~ '(email|phone|address|firebase|bank|insurance|family|production_id|raw_payload|credential|secret)') then
    raise exception 'BDF_M015_PII_OR_PRODUCTION_COLUMN';
  end if;
  if to_regclass('accounting.cash_flow_facts') is not null
    or to_regclass('accounting.validation_results') is not null
    or to_regclass('accounting.approvals') is not null
    or to_regclass('accounting.publication_releases') is not null then
    raise exception 'BDF_M015_FUTURE_SCOPE_LEAK';
  end if;
end
$validation$;
