-- M062 fail-closed catalog validation.
do $validation$
declare body text; trigger_count integer; table_change_count integer;
begin
  select pg_get_functiondef(p.oid) into body from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='accounting' and p.proname='validate_account_version_insert';
  if body is null or position('account_hierarchy_cycle_exists' in body)=0
    or position('pg_advisory_xact_lock' in body)=0 then
    raise exception 'BDF_M062_INSERT_GUARD_NOT_CORRECTED';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='accounting' and p.proname='account_hierarchy_cycle_exists') then
    raise exception 'BDF_M062_GRAPH_FUNCTION_MISSING';
  end if;
  select count(*) into trigger_count from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='accounting' and c.relname='accounts'
      and t.tgname='revalidate_account_hierarchy_deferred' and t.tgconstraint<>0
      and t.tgdeferrable and t.tginitdeferred and not t.tgisinternal;
  if trigger_count<>1 then raise exception 'BDF_M062_DEFERRED_TRIGGER_MISSING'; end if;
  select count(*) into table_change_count from information_schema.tables
    where table_schema='accounting' and table_name in ('account_identities','accounts','account_statement_mappings');
  if table_change_count<>3 then raise exception 'BDF_M062_M013_TABLE_DRIFT'; end if;
  if exists (select 1 from information_schema.routine_privileges where specific_schema='accounting'
    and routine_name in ('account_hierarchy_cycle_exists','revalidate_account_hierarchy_deferred')
    and grantee in ('PUBLIC','anon','authenticated','service_role')) then
    raise exception 'BDF_M062_FORBIDDEN_FUNCTION_GRANT';
  end if;
end
$validation$;
