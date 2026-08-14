\set ON_ERROR_STOP on

do $$
declare
  runtime_function record;
begin
  if current_setting('server_version_num')::integer < 170000
     or current_setting('server_version_num')::integer >= 180000 then
    raise exception 'Expected PostgreSQL 17.x, got %', current_setting('server_version');
  end if;

  if (select count(*) from dbf_ingest.metric_definitions where definition_version = 'v1') <> 19 then
    raise exception 'Phase C metric definition count is not 19';
  end if;

  if (
    select count(*)
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname like 'dbf_import_%_v1'
       and p.prosecdef
  ) <> 9 then
    raise exception 'Phase C SECURITY DEFINER runtime function count is not 9';
  end if;

  for runtime_function in
    select p.oid, p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname like 'dbf_import_%_v1'
  loop
    if not has_function_privilege('service_role', runtime_function.oid, 'EXECUTE') then
      raise exception 'service_role cannot execute %', runtime_function.proname;
    end if;
    if has_function_privilege('anon', runtime_function.oid, 'EXECUTE')
       or has_function_privilege('authenticated', runtime_function.oid, 'EXECUTE') then
      raise exception 'Browser role can execute %', runtime_function.proname;
    end if;
  end loop;

  if exists (
    select 1
      from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
     where p.pronamespace = 'public'::regnamespace
       and p.proname like 'dbf_import_%_v1'
       and acl.grantee = 0
       and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC can execute a Phase C runtime function';
  end if;

  if (select count(*) from public.dbf_pl_detail_facts)
       + (select count(*) from public.dbf_pl_aggregate_facts)
       + (select count(*) from public.dbf_bs_facts)
       + (select count(*) from public.dbf_store_monthly_metric_facts)
       + (select count(*) from public.dbf_budget_facts) <> 0 then
    raise exception 'Canonical Fact rows are not zero before runtime smoke';
  end if;
end
$$;

begin;
set local role service_role;
select public.dbf_import_start_v1(
  '11111111-1111-4111-8111-111111111111'::uuid,
  jsonb_build_object(
    'sha256', repeat('a', 64),
    'byteSize', 64,
    'originalFileName', 'pilot.csv',
    'mediaType', 'text/csv'
  ),
  'pl',
  date '2026-07-01',
  'normalized_csv',
  'pilot-csv-v1',
  jsonb_build_array(jsonb_build_object(
    'sourceRowNumber', 1,
    'payload', jsonb_build_object('company', 'IDEA NOV', 'accountCode', '4000', 'amount', 1000),
    'payloadSha256', repeat('b', 64)
  )),
  null,
  null
);
do $$
begin
  if (select count(*) from dbf_ingest.import_batches) <> 1 then
    raise exception 'Runtime start did not create exactly one batch';
  end if;
end
$$;
rollback;

do $$
begin
  if (select count(*) from dbf_ingest.source_files)
       + (select count(*) from dbf_ingest.import_batches)
       + (select count(*) from dbf_ingest.raw_rows)
       + (select count(*) from dbf_ingest.import_events) <> 0 then
    raise exception 'Runtime smoke rollback left ingest rows';
  end if;
  if (select count(*) from public.dbf_pl_detail_facts)
       + (select count(*) from public.dbf_pl_aggregate_facts)
       + (select count(*) from public.dbf_bs_facts)
       + (select count(*) from public.dbf_store_monthly_metric_facts)
       + (select count(*) from public.dbf_budget_facts) <> 0 then
    raise exception 'Runtime smoke rollback left Fact rows';
  end if;
end
$$;
