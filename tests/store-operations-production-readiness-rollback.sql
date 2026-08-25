\set ON_ERROR_STOP on

begin;

revoke all on function public.dbf_store_monthly_actual_read_v1(date, uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.dbf_store_monthly_actual_range_read_v1(date, date, uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.dbf_store_monthly_budget_range_read_v1(date, date, uuid, uuid[]) from public, anon, authenticated, service_role;

drop function public.dbf_store_monthly_actual_read_v1(date, uuid, uuid[]);
drop function public.dbf_store_monthly_actual_range_read_v1(date, date, uuid, uuid[]);
drop function public.dbf_store_monthly_budget_range_read_v1(date, date, uuid, uuid[]);

do $$
begin
  if to_regprocedure('public.dbf_store_monthly_actual_read_v1(date,uuid,uuid[])') is not null
     or to_regprocedure('public.dbf_store_monthly_actual_range_read_v1(date,date,uuid,uuid[])') is not null
     or to_regprocedure('public.dbf_store_monthly_budget_range_read_v1(date,date,uuid,uuid[])') is not null then
    raise exception 'Store Operations read RPC rollback did not remove exact signatures';
  end if;
  if to_regclass('public.dbf_store_monthly_metric_facts') is null
     or to_regclass('public.dbf_budget_facts') is null then
    raise exception 'Rollback must preserve canonical fact tables';
  end if;
end
$$;

rollback;
