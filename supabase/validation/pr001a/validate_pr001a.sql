-- PR001-A Staging-only validation pack.
-- Catalog checks fail closed. Any future synthetic DML must remain inside this
-- transaction and is discarded by the final ROLLBACK. Never use in Production.

begin;
set local statement_timeout = '15s';
set local lock_timeout = '2s';

do $validation$
declare
  required_views constant text[] := array[
    'corporation_master_v1', 'department_master_v1', 'employee_assignment_v1',
    'master_manifest_v1', 'store_master_v1'
  ];
  required_triggers constant text[] := array[
    'guard_master_source_snapshot_mutation',
    'guard_master_version_member_mutation',
    'guard_master_version_mutation',
    'guard_master_publication_release_insert',
    'guard_store_population_item_mutation',
    'guard_store_population_publication',
    'reject_master_audit_event_mutation'
  ];
  missing_views text[];
  unexpected_views text[];
  insecure_views text[];
  missing_triggers text[];
  missing_fixture_constraints text[];
  actual_view_count integer;
  bad_rls integer;
  exposed_grants integer;
begin
  select coalesce(array_agg(v order by v), array[]::text[]) into missing_views
  from unnest(required_views) v
  where not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'projection' and c.relname = v and c.relkind = 'v'
  );

  select count(*) into actual_view_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'projection' and c.relkind = 'v';

  select coalesce(array_agg(c.relname order by c.relname), array[]::text[]) into unexpected_views
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'projection' and c.relkind = 'v' and not (c.relname = any(required_views));

  select coalesce(array_agg(c.relname order by c.relname), array[]::text[]) into insecure_views
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'projection' and c.relkind = 'v' and c.relname = any(required_views)
    and not ('security_invoker=true' = any(coalesce(c.reloptions, array[]::text[])));

  select coalesce(array_agg(t order by t), array[]::text[]) into missing_triggers
  from unnest(required_triggers) t
  where not exists (
    select 1 from pg_catalog.pg_trigger pt where pt.tgname = t and not pt.tgisinternal
  );

  select coalesce(array_agg(c order by c), array[]::text[]) into missing_fixture_constraints
  from unnest(array['corporations_identity_start_unique', 'corporations_period_excl']) c
  where not exists (
    select 1 from pg_catalog.pg_constraint pc where pc.conname = c
  );

  select count(*) into bad_rls
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('core', 'governance') and c.relkind = 'r'
    and (not c.relrowsecurity or not c.relforcerowsecurity);

  select count(*) into exposed_grants
  from information_schema.table_privileges
  where table_schema in ('core', 'governance', 'projection')
    and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role');

  raise notice 'expected_view_count=5 actual_view_count=% missing_view_names=% unexpected_view_names=% insecure_view_names=%',
    actual_view_count,
    missing_views, unexpected_views, insecure_views;

  if cardinality(missing_views) <> 0 or cardinality(unexpected_views) <> 0
     or cardinality(insecure_views) <> 0 then
    raise exception 'BDF_VALIDATION_VIEW_CONTRACT_FAILED';
  end if;
  if cardinality(missing_triggers) <> 0 then raise exception 'BDF_VALIDATION_TRIGGER_CONTRACT_FAILED'; end if;
  if cardinality(missing_fixture_constraints) <> 0 then
    raise exception 'BDF_VALIDATION_FIXTURE_CONSTRAINT_CONTRACT_FAILED';
  end if;
  if bad_rls <> 0 then raise exception 'BDF_VALIDATION_RLS_CONTRACT_FAILED'; end if;
  if exposed_grants <> 0 then raise exception 'BDF_VALIDATION_GRANT_CONTRACT_FAILED'; end if;
end
$validation$;

select tc.table_schema, tc.table_name, tc.constraint_type, count(*) as constraint_count
from information_schema.table_constraints tc
where tc.table_schema in ('core', 'governance')
group by tc.table_schema, tc.table_name, tc.constraint_type
order by tc.table_schema, tc.table_name, tc.constraint_type;

select schemaname, tablename, indexname
from pg_catalog.pg_indexes
where schemaname in ('core', 'governance')
order by schemaname, tablename, indexname;

select event_object_schema, event_object_table, trigger_name, event_manipulation
from information_schema.triggers
where trigger_schema = 'governance'
order by event_object_schema, event_object_table, trigger_name, event_manipulation;

-- M010 owns the rollback-only synthetic fixture suite for:
-- duplicate periods with distinct effective_from values, primary overlap,
-- orphan FK, Snapshot idempotency, deterministic normalized Corporation/Store
-- fixtures, Store-to-Corporation FK coverage, rerun rollback safety,
-- pending-review candidate isolation (never an official item), pending-only
-- Publication rejection, normal 20/13/7 Publication success,
-- Human Review/20-13-7 publication, unpublished projections, immutable DML,
-- Crosswalk type mismatch, and Version Member type mismatch.

rollback;
