\set ON_ERROR_STOP on

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'dbf_pl_detail_facts',
    'dbf_pl_aggregate_facts',
    'dbf_bs_facts',
    'dbf_store_monthly_metric_facts',
    'dbf_budget_facts'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = relation_name
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'RLS/FORCE RLS missing for %', relation_name;
    end if;
  end loop;

  if to_regprocedure('public.dbf_store_monthly_actual_read_v1(date,uuid,uuid[])') is null
     or to_regprocedure('public.dbf_store_monthly_actual_range_read_v1(date,date,uuid,uuid[])') is null
     or to_regprocedure('public.dbf_store_monthly_budget_range_read_v1(date,date,uuid,uuid[])') is null then
    raise exception 'Store Operations release RPC signature missing';
  end if;

  if has_function_privilege('anon', 'public.dbf_store_monthly_actual_read_v1(date,uuid,uuid[])', 'execute')
     or has_function_privilege('authenticated', 'public.dbf_store_monthly_actual_read_v1(date,uuid,uuid[])', 'execute')
     or has_function_privilege('anon', 'public.dbf_store_monthly_actual_range_read_v1(date,date,uuid,uuid[])', 'execute')
     or has_function_privilege('authenticated', 'public.dbf_store_monthly_actual_range_read_v1(date,date,uuid,uuid[])', 'execute')
     or has_function_privilege('anon', 'public.dbf_store_monthly_budget_range_read_v1(date,date,uuid,uuid[])', 'execute')
     or has_function_privilege('authenticated', 'public.dbf_store_monthly_budget_range_read_v1(date,date,uuid,uuid[])', 'execute') then
    raise exception 'Browser role can execute a Store Operations release RPC';
  end if;

  if not has_function_privilege('service_role', 'public.dbf_store_monthly_actual_read_v1(date,uuid,uuid[])', 'execute')
     or not has_function_privilege('service_role', 'public.dbf_store_monthly_actual_range_read_v1(date,date,uuid,uuid[])', 'execute')
     or not has_function_privilege('service_role', 'public.dbf_store_monthly_budget_range_read_v1(date,date,uuid,uuid[])', 'execute') then
    raise exception 'service_role release RPC boundary missing';
  end if;

  if (select count(*) from public.dbf_store_monthly_metric_facts) <> 0
     or (select count(*) from public.dbf_budget_facts) <> 0 then
    raise exception 'Release migration chain populated business facts';
  end if;
end
$$;
