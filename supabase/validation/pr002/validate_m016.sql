-- M016 fail-closed catalog validation.
do $validation$
declare n integer; body text;
begin
  select count(*) into n from information_schema.tables
  where table_schema='accounting' and table_name in ('validation_results','approvals','audit_events');
  if n<>3 then raise exception 'BDF_M016_TABLE_COUNT %',n; end if;

  select count(*) into n from pg_constraint c join pg_class t on t.oid=c.conrelid
  join pg_namespace s on s.oid=t.relnamespace
  where s.nspname='accounting' and c.conname in (
    'accounting_validation_results_cycle_code_unique','accounting_validation_results_result_evidence_check',
    'accounting_validation_results_hash_check','accounting_approvals_sequence_unique',
    'accounting_approvals_actor_check','accounting_audit_events_action_check'
  );
  if n<>6 then raise exception 'BDF_M016_CONSTRAINT_COUNT %',n; end if;

  select count(*) into n from pg_indexes where schemaname='accounting' and indexname in (
    'accounting_validation_results_version_idx','accounting_validation_results_status_idx',
    'accounting_approvals_one_approved_type_idx','accounting_approvals_version_cycle_idx',
    'accounting_audit_events_version_idx','accounting_audit_events_cycle_idx',
    'accounting_audit_events_approval_idx'
  );
  if n<>7 then raise exception 'BDF_M016_INDEX_COUNT %',n; end if;

  select count(*) into n from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname='accounting' and p.proname in (
    'm016_required_validation_codes','m016_assert_actor','m016_validation_violation_count',
    'record_accounting_validation','finalize_accounting_validation',
    'record_accounting_approval','guard_m016_evidence_mutation'
  ) and not p.prosecdef and exists (
    select 1 from unnest(p.proconfig) setting
    where setting in ('search_path=','search_path=""')
  );
  if n<>7 then raise exception 'BDF_M016_FUNCTION_SECURITY_COUNT %',n; end if;

  select count(*) into n from information_schema.routine_privileges
  where specific_schema='accounting' and routine_name in (
    'm016_required_validation_codes','m016_assert_actor','m016_validation_violation_count',
    'record_accounting_validation','finalize_accounting_validation',
    'record_accounting_approval','guard_m016_evidence_mutation'
  ) and grantee in ('PUBLIC','anon','authenticated','service_role');
  if n<>0 then raise exception 'BDF_M016_FORBIDDEN_FUNCTION_GRANT %',n; end if;

  select count(*) into n from pg_trigger g join pg_class t on t.oid=g.tgrelid
  join pg_namespace s on s.oid=t.relnamespace join pg_proc p on p.oid=g.tgfoid
  where s.nspname='accounting' and not g.tgisinternal and (
    (t.relname='validation_results' and g.tgname='guard_validation_result_mutation'
      and p.proname='guard_m016_evidence_mutation' and g.tgtype=27)
    or (t.relname='approvals' and g.tgname='guard_approval_mutation'
      and p.proname='guard_m016_evidence_mutation' and g.tgtype=27)
    or (t.relname='audit_events' and g.tgname='guard_audit_event_mutation'
      and p.proname='guard_m016_evidence_mutation' and g.tgtype=27)
  );
  if n<>3 then raise exception 'BDF_M016_TRIGGER_BINDING_COUNT %',n; end if;

  select pg_get_functiondef(p.oid) into body from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname='accounting' and p.proname='guard_accounting_version_mutation';
  if body not ilike '%m016_required_validation_codes%'
    or body not ilike '%BDF_ACCOUNTING_PUBLICATION_NOT_AVAILABLE_BEFORE_M017%'
    or body ilike '%VALIDATION_NOT_AVAILABLE_BEFORE_M016%' then
    raise exception 'BDF_M016_VERSION_GUARD_NOT_ACTIVE';
  end if;

  select pg_get_functiondef(p.oid) into body from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname='accounting' and p.proname='record_accounting_validation';
  if body not ilike '%m016_validation_violation_count%'
    or body not ilike '%BDF_M016_STALE_VERSION%'
    or body not ilike '%validation_result_recorded%' then
    raise exception 'BDF_M016_VALIDATION_COMMAND_DRIFT';
  end if;

  select pg_get_functiondef(p.oid) into body from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname='accounting' and p.proname='record_accounting_approval';
  if body not ilike '%BDF_M016_SELF_APPROVAL_FORBIDDEN%'
    or body not ilike '%BDF_M016_VALIDATION_PASS_REQUIRED%'
    or body not ilike '%accounting_confirmed%' then
    raise exception 'BDF_M016_APPROVAL_COMMAND_DRIFT';
  end if;

  select count(*) into n from pg_class t join pg_namespace s on s.oid=t.relnamespace
  where s.nspname='accounting' and t.relname in ('validation_results','approvals','audit_events')
    and t.relrowsecurity and t.relforcerowsecurity;
  if n<>3 then raise exception 'BDF_M016_RLS_FORCE_COUNT %',n; end if;

  select count(*) into n from information_schema.role_table_grants
  where table_schema='accounting' and table_name in ('validation_results','approvals','audit_events')
    and grantee in ('PUBLIC','anon','authenticated','service_role');
  if n<>0 then raise exception 'BDF_M016_FORBIDDEN_TABLE_GRANT %',n; end if;

  select count(*) into n from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname='accounting' and p.prosecdef;
  if n<>0 then raise exception 'BDF_M016_SECURITY_DEFINER %',n; end if;

  select count(*) into n from information_schema.views where table_schema='accounting';
  if n<>0 then raise exception 'BDF_M016_CONSUMER_VIEW_COUNT %',n; end if;

  select count(*) into n from information_schema.columns
  where table_schema='accounting' and table_name in ('validation_results','approvals','audit_events')
    and lower(column_name) ~ '(email|phone|address|birth|name|payroll|credential|secret|raw|production.*id|internal.*id)';
  if n<>0 then raise exception 'BDF_M016_FORBIDDEN_COLUMN_COUNT %',n; end if;

  select count(*) into n from information_schema.tables
  where table_schema in ('accounting','projection') and table_name in (
    'publication_releases','publication_members','accounting_corporation_pl_v1'
  );
  if n<>0 then raise exception 'BDF_M016_FUTURE_SCOPE_OBJECT %',n; end if;
end
$validation$;
