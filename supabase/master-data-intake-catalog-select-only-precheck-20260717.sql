-- SELECT-only catalog inventory. Does not read employee, store, corporation, or audit rows.
with required_tables(table_name) as (
  values ('employees'), ('stores'), ('corporations'), ('master_change_logs')
), tables as (
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join required_tables r on r.table_name = c.relname
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
), required_columns(table_name, column_name) as (
  values
    ('employees', 'id'),
    ('employees', 'employee_id'),
    ('employees', 'full_name'),
    ('stores', 'id'),
    ('stores', 'store_id'),
    ('stores', 'store_name'),
    ('corporations', 'id'),
    ('corporations', 'corporation_no'),
    ('corporations', 'corporation_name'),
    ('master_change_logs', 'id'),
    ('master_change_logs', 'table_name'),
    ('master_change_logs', 'record_id'),
    ('master_change_logs', 'changed_by_email'),
    ('master_change_logs', 'change_payload'),
    ('master_change_logs', 'action_type'),
    ('master_change_logs', 'target_name'),
    ('master_change_logs', 'change_summary'),
    ('master_change_logs', 'created_at')
), present_columns as (
  select count(*)::integer as present_count
  from required_columns r
  join tables t on t.relname = r.table_name
  join pg_catalog.pg_attribute a
    on a.attrelid = t.oid
   and a.attname = r.column_name
   and a.attnum > 0
   and not a.attisdropped
), natural_key_indexes as (
  select count(distinct t.relname)::integer as covered_table_count
  from tables t
  join pg_catalog.pg_index i on i.indrelid = t.oid and i.indisunique
  join pg_catalog.pg_attribute a on a.attrelid = t.oid and a.attnum = any(i.indkey)
  where (t.relname = 'employees' and a.attname = 'employee_id')
     or (t.relname = 'stores' and a.attname = 'store_id')
     or (t.relname = 'corporations' and a.attname = 'corporation_no')
), browser_privileges as (
  select count(*)::integer as privilege_count
  from information_schema.table_privileges tp
  where tp.table_schema = 'public'
    and tp.table_name in ('employees', 'stores', 'corporations', 'master_change_logs')
    and tp.grantee in ('PUBLIC', 'anon', 'authenticated')
    and tp.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES')
), profile_tables as (
  select count(*)::integer as table_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('store_business_profiles', 'corporation_business_profiles')
    and c.relkind in ('r', 'p')
)
select
  (select count(*) from tables) as required_table_count,
  (select count(*) from required_columns) as required_column_count,
  coalesce((select present_count from present_columns), 0) as present_required_column_count,
  coalesce((select covered_table_count from natural_key_indexes), 0) as natural_key_unique_index_table_count,
  (select count(*) from tables where relrowsecurity) as rls_enabled_table_count,
  (select count(*) from tables where relforcerowsecurity) as rls_forced_table_count,
  coalesce((select privilege_count from browser_privileges), 0) as browser_write_privilege_count,
  coalesce((select table_count from profile_tables), 0) as business_profile_table_count;
