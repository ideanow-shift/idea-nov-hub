-- STAGING VALIDATION CLEANUP ONLY. Never apply to Production.
begin;

do $$
declare
  v_relation_count integer;
begin
  if pg_catalog.to_regnamespace('identity_access') is null
     or pg_catalog.to_regprocedure('public.store_corporation_effective_operator_range_read_v1(date,date,uuid[])') is null
     or pg_catalog.to_regprocedure('identity_access.store_corporation_effective_operator_range_read_internal_v1(date,date,uuid[])') is null then
    raise exception 'STORE_CORPORATION_GATE5_STAGING_OBJECT_MISSING';
  end if;

  select count(*) into v_relation_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'identity_access' and c.relkind in ('r', 'p', 'v', 'm');

  if v_relation_count <> 4
     or (select count(*) from identity_access.store_corporation_history_sets) <> 1
     or (select count(*) from identity_access.store_corporation_history_rows) <> 3
     or (select count(*) from identity_access.store_corporation_history_publication) <> 1 then
    raise exception 'STORE_CORPORATION_GATE5_STAGING_FIXTURE_DRIFT';
  end if;
end;
$$;

drop function public.store_corporation_effective_operator_range_read_v1(date, date, uuid[]);
drop function identity_access.store_corporation_effective_operator_range_read_internal_v1(date, date, uuid[]);
drop schema identity_access cascade;

commit;
