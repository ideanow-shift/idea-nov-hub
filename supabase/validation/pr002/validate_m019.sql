-- Fail-closed catalog validation for PR002 / M019.
do $validation$
declare
  n integer;
  body text;
begin
  if to_regclass('accounting.consumer_access_contracts') is null then
    raise exception 'BDF_M019_ACCESS_CONTRACT_TABLE_MISSING';
  end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
  where s.nspname='accounting' and c.relname='consumer_access_contracts'
    and c.relrowsecurity and c.relforcerowsecurity;
  if n<>1 then raise exception 'BDF_M019_RLS_NOT_FORCED'; end if;

  select count(*) into n from pg_constraint c join pg_class t on t.oid=c.conrelid
  join pg_namespace s on s.oid=t.relnamespace where s.nspname='accounting'
    and t.relname='consumer_access_contracts' and c.conname in (
      'consumer_access_contracts_sequence_check','consumer_access_contracts_scope_check',
      'consumer_access_contracts_decision_check','consumer_access_contracts_evidence_check',
      'consumer_access_contracts_version_check','consumer_access_contracts_key_sequence_unique'
    );
  if n<>6 then raise exception 'BDF_M019_CONSTRAINT_DRIFT'; end if;
  select count(*) into n from pg_indexes where schemaname='accounting'
    and tablename='consumer_access_contracts' and indexname in (
      'consumer_access_contracts_subject_idx','consumer_access_contracts_employee_idx',
      'consumer_access_contracts_assignment_idx','consumer_access_contracts_scope_idx'
    );
  if n<>4 then raise exception 'BDF_M019_INDEX_DRIFT'; end if;

  select count(*) into n from pg_trigger g join pg_class t on t.oid=g.tgrelid
  join pg_namespace s on s.oid=t.relnamespace where not g.tgisinternal
    and s.nspname='accounting' and t.relname='consumer_access_contracts'
    and g.tgname='guard_consumer_access_contract'
    and g.tgfoid='accounting.guard_consumer_access_contract()'::regprocedure;
  if n<>1 then raise exception 'BDF_M019_TRIGGER_BINDING_DRIFT'; end if;

  select count(*) into n from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where (s.nspname,p.proname) in (
    ('accounting','guard_consumer_access_contract'),
    ('accounting','current_consumer_access_contracts'),
    ('projection','read_accounting_consumer_v1')
  ) and p.proconfig @> array['search_path=""'];
  if n<>3 then raise exception 'BDF_M019_FIXED_SEARCH_PATH_REQUIRED'; end if;
  select count(*) into n from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname in ('accounting','projection') and p.prosecdef;
  if n<>1 or not exists (
    select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
    where s.nspname='projection' and p.proname='read_accounting_consumer_v1' and p.prosecdef
  ) then raise exception 'BDF_M019_SECURITY_DEFINER_INVENTORY_DRIFT'; end if;

  select lower(pg_get_functiondef('projection.read_accounting_consumer_v1(text,uuid,date,text)'::regprocedure)) into body;
  if body like '%execute %' or body like '%format(%' or body like '%accounting.accounting_facts%'
    or body not like '%request.jwt.claim%'
    or body not like '%bdf_m019_consumer_access_denied%'
    or body not like '%accounting_publication_status_v1%'
    or body not like '%accounting_corporation_pl_v1%'
    or body not like '%accounting_corporation_bs_v1%'
    or body not like '%accounting_store_profit_v1%'
    or body not like '%accounting_corporation_comparison_v1%'
    or body not like '%accounting_cash_flow_v1%' then
    raise exception 'BDF_M019_ACCESS_PORT_BODY_DRIFT';
  end if;

  select lower(pg_get_functiondef('accounting.guard_consumer_access_contract()'::regprocedure)) into body;
  if body not like '%pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(%'
    or body not like '%bdf|m019|auth_subject|%new.auth_subject_id%'
    or position('pg_advisory_xact_lock' in body)=0
    or position('bdf_m019_auth_subject_identity_conflict' in body)=0
    or position('pg_advisory_xact_lock' in body) >= position('bdf_m019_auth_subject_identity_conflict' in body) then
    raise exception 'BDF_M019_SUBJECT_LOCK_OR_POST_LOCK_RECHECK_DRIFT';
  end if;

  select count(*) into n from information_schema.routine_privileges
  where specific_schema='projection' and routine_name='read_accounting_consumer_v1'
    and grantee='authenticated' and privilege_type='EXECUTE';
  if n<>1 then raise exception 'BDF_M019_AUTHENTICATED_EXECUTE_MISSING'; end if;
  select count(*) into n from information_schema.routine_privileges
  where specific_schema in ('accounting','projection')
    and routine_name in ('guard_consumer_access_contract','current_consumer_access_contracts','read_accounting_consumer_v1')
    and grantee in ('PUBLIC','anon','service_role');
  if n<>0 then raise exception 'BDF_M019_FORBIDDEN_FUNCTION_GRANT'; end if;
  select count(*) into n from information_schema.role_table_grants
  where table_schema='accounting' and grantee in ('PUBLIC','anon','authenticated','service_role');
  if n<>0 then raise exception 'BDF_M019_RAW_ACCOUNTING_GRANT'; end if;

  select count(*) into n from pg_views v join pg_class c on c.relname=v.viewname
  join pg_namespace s on s.oid=c.relnamespace and s.nspname=v.schemaname
  where v.schemaname='projection' and v.viewname in (
    'accounting_publication_status_v1','accounting_corporation_pl_v1','accounting_corporation_bs_v1',
    'accounting_store_profit_v1','accounting_corporation_comparison_v1','accounting_cash_flow_v1'
  ) and c.reloptions @> array['security_invoker=true','security_barrier=true'];
  if n<>6 then raise exception 'BDF_M019_M018_VIEW_PROTECTION_DRIFT'; end if;
  select count(*) into n from information_schema.role_table_grants where table_schema='projection'
    and table_name like 'accounting_%_v1' and grantee in ('PUBLIC','anon','authenticated','service_role');
  if n<>0 then raise exception 'BDF_M019_RAW_VIEW_GRANT_FORBIDDEN'; end if;

  if exists(select 1 from information_schema.columns where table_schema='accounting'
    and table_name='consumer_access_contracts'
    and column_name ~ '(name|email|phone|address|payroll|tax_id|production|internal_id)') then
    raise exception 'BDF_M019_PII_OR_PRODUCTION_COLUMN';
  end if;
  if exists(select 1 from pg_policies where schemaname='accounting'
    and tablename='consumer_access_contracts') then raise exception 'BDF_M019_POLICY_NOT_EXPECTED'; end if;
end
$validation$;
