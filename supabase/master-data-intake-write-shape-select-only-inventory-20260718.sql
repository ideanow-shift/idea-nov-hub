-- Catalog-only inventory for the Data Intake transactional write design.
-- No employee, store, corporation, profile, or audit rows are read.
with target_tables(table_schema, table_name) as (
  values
    ('public', 'employees'),
    ('public', 'stores'),
    ('public', 'corporations'),
    ('public', 'store_business_profiles'),
    ('public', 'corporation_business_profiles'),
    ('public', 'master_change_logs')
), columns as (
  select
    c.table_schema,
    c.table_name,
    c.column_name,
    c.ordinal_position,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    case when c.column_default is null then false else true end as has_default,
    c.is_identity,
    c.is_generated
  from information_schema.columns c
  join target_tables t using (table_schema, table_name)
), constraints as (
  select
    n.nspname as table_schema,
    c.relname as table_name,
    con.conname as constraint_name,
    con.contype as constraint_type,
    pg_catalog.pg_get_constraintdef(con.oid, true) as constraint_definition
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid = con.conrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join target_tables t on t.table_schema = n.nspname and t.table_name = c.relname
), indexes as (
  select
    schemaname as table_schema,
    tablename as table_name,
    indexname as index_name,
    indexdef as index_definition
  from pg_catalog.pg_indexes i
  join target_tables t on t.table_schema = i.schemaname and t.table_name = i.tablename
), privileges as (
  select
    p.table_schema,
    p.table_name,
    p.grantee,
    p.privilege_type
  from information_schema.table_privileges p
  join target_tables t using (table_schema, table_name)
  where p.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
), rls as (
  select
    n.nspname as table_schema,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join target_tables t on t.table_schema = n.nspname and t.table_name = c.relname
  where c.relkind in ('r', 'p')
)
select jsonb_build_object(
  'table_count', (select count(*) from rls),
  'columns', coalesce((select jsonb_agg(to_jsonb(columns) order by table_name, ordinal_position) from columns), '[]'::jsonb),
  'constraints', coalesce((select jsonb_agg(to_jsonb(constraints) order by table_name, constraint_name) from constraints), '[]'::jsonb),
  'indexes', coalesce((select jsonb_agg(to_jsonb(indexes) order by table_name, index_name) from indexes), '[]'::jsonb),
  'privileges', coalesce((select jsonb_agg(to_jsonb(privileges) order by table_name, grantee, privilege_type) from privileges), '[]'::jsonb),
  'rls', coalesce((select jsonb_agg(to_jsonb(rls) order by table_name) from rls), '[]'::jsonb)
) as data_intake_write_shape;
