-- SELECT-only inventory. Does not read destination rows or raw LINE WORKS IDs.
with target_table as (
  select c.oid, c.relrowsecurity, c.relforcerowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'os'
    and c.relname = 'notification_destinations'
    and c.relkind in ('r', 'p')
), required_columns as (
  select count(*)::integer as column_count
  from pg_catalog.pg_attribute a
  join target_table t on t.oid = a.attrelid
  where a.attnum > 0
    and not a.attisdropped
    and a.attname in ('provider', 'target_type', 'target_id', 'channel_id', 'purpose', 'is_active')
), employee_constraint as (
  select count(*)::integer as constraint_count
  from pg_catalog.pg_constraint con
  join target_table t on t.oid = con.conrelid
  where con.contype = 'c'
    and pg_catalog.pg_get_constraintdef(con.oid, true) like '%employee%'
), target_index as (
  select count(*)::integer as index_count
  from pg_catalog.pg_index i
  join target_table t on t.oid = i.indrelid
  where i.indisunique
), policy_inventory as (
  select
    count(*)::integer as policy_count,
    count(*) filter (where 'anon' = any(p.roles) or 'authenticated' = any(p.roles) or 'public' = any(p.roles))::integer as browser_policy_count
  from pg_catalog.pg_policies p
  where p.schemaname = 'os'
    and p.tablename = 'notification_destinations'
), table_privileges as (
  select
    count(*) filter (where tp.grantee = 'service_role' and tp.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE'))::integer as service_role_privilege_count,
    count(*) filter (where tp.grantee in ('anon', 'authenticated', 'PUBLIC'))::integer as browser_privilege_count
  from information_schema.table_privileges tp
  where tp.table_schema = 'os'
    and tp.table_name = 'notification_destinations'
), required_functions as (
  select
    count(*)::integer as function_count,
    count(*) filter (where p.prosecdef)::integer as security_definer_count,
    count(*) filter (where exists (
      select 1 from unnest(coalesce(p.proconfig, array[]::text[])) config
      where config like 'search_path=%'
    ))::integer as fixed_search_path_count
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'os'
    and p.proname in (
      'get_employee_line_works_destination',
      'upsert_employee_line_works_destination',
      'disable_employee_line_works_destination'
    )
), browser_function_privileges as (
  select count(*)::integer as browser_execute_count
  from information_schema.routine_privileges rp
  where rp.specific_schema = 'os'
    and rp.routine_name in (
      'get_employee_line_works_destination',
      'upsert_employee_line_works_destination',
      'disable_employee_line_works_destination'
    )
    and rp.privilege_type = 'EXECUTE'
    and rp.grantee in ('PUBLIC', 'anon', 'authenticated')
)
select
  (select count(*) = 1 from target_table) as table_exists,
  coalesce((select column_count = 6 from required_columns), false) as required_columns_present,
  coalesce((select constraint_count > 0 from employee_constraint), false) as employee_target_supported,
  coalesce((select index_count > 0 from target_index), false) as unique_index_present,
  coalesce((select relrowsecurity from target_table), false) as rls_enabled,
  coalesce((select relforcerowsecurity from target_table), false) as rls_forced,
  coalesce((select policy_count from policy_inventory), 0) as policy_count,
  coalesce((select browser_policy_count from policy_inventory), 0) as browser_policy_count,
  coalesce((select service_role_privilege_count from table_privileges), 0) as service_role_privilege_count,
  coalesce((select browser_privilege_count from table_privileges), 0) as browser_privilege_count,
  coalesce((select function_count from required_functions), 0) as required_function_count,
  coalesce((select security_definer_count from required_functions), 0) as security_definer_count,
  coalesce((select fixed_search_path_count from required_functions), 0) as fixed_search_path_count,
  coalesce((select browser_execute_count from browser_function_privileges), 0) as browser_execute_count;
