select
  to_regclass('public.master_data_intake_receipts') is not null,
  c.relrowsecurity,
  c.relforcerowsecurity,
  (
    select count(*)
    from pg_catalog.pg_constraint con
    where con.conrelid = c.oid
      and con.contype in ('p', 'u', 'c', 'f')
  ),
  (
    select count(*)
    from information_schema.table_privileges p
    where p.table_schema = 'public'
      and p.table_name = 'master_data_intake_receipts'
      and p.grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  (
    select count(*)
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'master_data_intake_receipts'
  )
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'master_data_intake_receipts';
