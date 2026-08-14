\set ON_ERROR_STOP on

do $$
declare
  relation record;
  actual_privileges text[];
  privilege_name text;
  target_row_count bigint;
  fact_index_count integer;
  total_index_count integer;
begin
  if current_setting('server_version_num')::integer < 170000
     or current_setting('server_version_num')::integer >= 180000 then
    raise exception 'Expected PostgreSQL 17.x, got %', current_setting('server_version');
  end if;

  if (
    select count(*)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where (n.nspname, c.relname) in (
       ('public', 'dbf_pl_detail_facts'),
       ('public', 'dbf_pl_aggregate_facts'),
       ('public', 'dbf_bs_facts'),
       ('public', 'dbf_store_monthly_metric_facts'),
       ('public', 'dbf_budget_facts')
     )
       and c.relkind = 'r'
  ) <> 5 then
    raise exception 'Canonical Fact table count is not five';
  end if;

  if (
    select count(*)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where (n.nspname, c.relname) in (
       ('public', 'dbf_pl_detail_facts'),
       ('public', 'dbf_pl_aggregate_facts'),
       ('public', 'dbf_bs_facts'),
       ('public', 'dbf_store_monthly_metric_facts'),
       ('public', 'dbf_budget_facts')
     )
       and c.relrowsecurity
       and c.relforcerowsecurity
  ) <> 5 then
    raise exception 'RLS / FORCE RLS is not 5 / 5';
  end if;

  if (
    select count(*)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_roles owner_role on owner_role.oid = c.relowner
     where (n.nspname, c.relname) in (
       ('public', 'dbf_pl_detail_facts'),
       ('public', 'dbf_pl_aggregate_facts'),
       ('public', 'dbf_bs_facts'),
       ('public', 'dbf_store_monthly_metric_facts'),
       ('public', 'dbf_budget_facts')
     )
       and (owner_role.rolname = 'service_role'
         or pg_has_role('service_role', owner_role.oid, 'MEMBER')
         or pg_has_role('service_role', owner_role.oid, 'SET'))
  ) <> 0 then
    raise exception 'service_role owns or can assume the Fact owner';
  end if;

  for relation in
    select c.oid, n.nspname, c.relname, c.relowner
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where (n.nspname, c.relname) in (
       ('public', 'dbf_pl_detail_facts'),
       ('public', 'dbf_pl_aggregate_facts'),
       ('public', 'dbf_bs_facts'),
       ('public', 'dbf_store_monthly_metric_facts'),
       ('public', 'dbf_budget_facts')
     )
  loop
    select array_agg(lower(acl.privilege_type) order by lower(acl.privilege_type))
      into actual_privileges
      from pg_class relation_acl
      cross join lateral aclexplode(coalesce(relation_acl.relacl, acldefault('r', relation_acl.relowner))) acl
     where relation_acl.oid = relation.oid
       and acl.grantee = 'service_role'::regrole;

    if actual_privileges is distinct from array['insert', 'select', 'update']::text[] then
      raise exception 'Unexpected service_role ACL on %.%: %',
        relation.nspname, relation.relname, actual_privileges;
    end if;

    foreach privilege_name in array array['SELECT','INSERT','UPDATE'] loop
      if not has_table_privilege('service_role', relation.oid, privilege_name) then
        raise exception 'Missing allowed % privilege on %.%', privilege_name, relation.nspname, relation.relname;
      end if;
    end loop;

    foreach privilege_name in array array['DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
      if has_table_privilege('service_role', relation.oid, privilege_name) then
        raise exception 'Forbidden % privilege on %.%', privilege_name, relation.nspname, relation.relname;
      end if;
      if has_table_privilege('anon', relation.oid, privilege_name)
         or has_table_privilege('authenticated', relation.oid, privilege_name) then
        raise exception 'Browser role has % on %.%', privilege_name, relation.nspname, relation.relname;
      end if;
    end loop;

    foreach privilege_name in array array['SELECT','INSERT','UPDATE'] loop
      if has_table_privilege('anon', relation.oid, privilege_name)
         or has_table_privilege('authenticated', relation.oid, privilege_name) then
        raise exception 'Browser role has % on %.%', privilege_name, relation.nspname, relation.relname;
      end if;
    end loop;
  end loop;

  if exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
     where (n.nspname, c.relname) in (
       ('public', 'dbf_pl_detail_facts'),
       ('public', 'dbf_pl_aggregate_facts'),
       ('public', 'dbf_bs_facts'),
       ('public', 'dbf_store_monthly_metric_facts'),
       ('public', 'dbf_budget_facts')
     )
       and (acl.grantee = 0 or acl.is_grantable)
  ) then
    raise exception 'PUBLIC grant or GRANT OPTION exists';
  end if;

  if (
    select count(*)
      from information_schema.role_table_grants
     where grantee = 'service_role'
       and table_schema = 'public'
       and table_name in (
         'dbf_pl_detail_facts', 'dbf_pl_aggregate_facts', 'dbf_bs_facts',
         'dbf_store_monthly_metric_facts', 'dbf_budget_facts'
       )
       and privilege_type in ('SELECT','INSERT','UPDATE')
       and is_grantable = 'NO'
  ) <> 15 then
    raise exception 'role_table_grants does not show the expected 15 non-grantable ACL rows';
  end if;

  if exists (
    select 1
      from information_schema.table_privileges
     where table_schema = 'public'
       and table_name in (
         'dbf_pl_detail_facts', 'dbf_pl_aggregate_facts', 'dbf_bs_facts',
         'dbf_store_monthly_metric_facts', 'dbf_budget_facts'
       )
       and grantee in ('PUBLIC','anon','authenticated')
  ) then
    raise exception 'table_privileges exposes a browser or PUBLIC grant';
  end if;

  select sum(row_count)
    into target_row_count
    from (
      select count(*) row_count from public.dbf_pl_detail_facts
      union all select count(*) from public.dbf_pl_aggregate_facts
      union all select count(*) from public.dbf_bs_facts
      union all select count(*) from public.dbf_store_monthly_metric_facts
      union all select count(*) from public.dbf_budget_facts
    ) counts;

  if target_row_count <> 0 then
    raise exception 'Fresh Fact tables are not empty';
  end if;

  select count(*)
    into fact_index_count
    from pg_index i
    join pg_class index_relation on index_relation.oid = i.indexrelid
   where index_relation.relname in (
     'dbf_pl_detail_active_grain', 'dbf_pl_aggregate_active_grain',
     'dbf_bs_active_grain', 'dbf_store_metric_active_grain', 'dbf_budget_active_grain',
     'dbf_pl_detail_correction_once', 'dbf_pl_aggregate_correction_once',
     'dbf_bs_correction_once', 'dbf_store_metric_correction_once', 'dbf_budget_correction_once'
   )
     and i.indisunique
     and i.indisvalid;

  if fact_index_count <> 10 then
    raise exception 'Active-version / correction-lineage index validation is not 10 / 10';
  end if;

  select count(*)
    into total_index_count
    from pg_index i
    join pg_class table_relation on table_relation.oid = i.indrelid
    join pg_namespace n on n.oid = table_relation.relnamespace
   where not exists (
     select 1
       from pg_constraint constraint_index
      where constraint_index.conindid = i.indexrelid
   )
     and (
       (
         n.nspname = 'dbf_ingest'
         and table_relation.relname in (
           'source_files','import_batches','raw_rows','entity_mappings','staging_rows',
           'validation_issues','import_events','metric_definitions'
         )
       ) or (
         n.nspname = 'public'
         and table_relation.relname in (
           'dbf_pl_detail_facts','dbf_pl_aggregate_facts','dbf_bs_facts',
           'dbf_store_monthly_metric_facts','dbf_budget_facts'
         )
       )
     );

  if total_index_count <> 31 then
    raise exception 'Phase B non-constraint index count is %, expected 31', total_index_count;
  end if;
end
$$;

-- Correction happy path: the canonical design needs only SELECT / INSERT /
-- UPDATE.  Every fixture row is rolled back and the Fresh DB returns to zero.
begin;

insert into dbf_ingest.source_files (
  id, sha256, byte_size, original_file_name, media_type, source_system,
  received_by_employee_id
) values (
  '10000000-0000-0000-0000-000000000001', repeat('a', 64), 1,
  'fixture.csv', 'text/csv', 'acl_fixture',
  '20000000-0000-0000-0000-000000000001'
);

insert into dbf_ingest.import_batches (
  id, source_file_id, fact_kind, fiscal_month, source_type, status,
  created_by_employee_id, approved_by_employee_id, approved_at
) values (
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'pl', date '2026-07-01', 'acl_fixture', 'approved',
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', statement_timestamp()
);

set local role service_role;

insert into public.dbf_pl_detail_facts (
  id, fiscal_month, company_id, store_id, account_code, account_name, amount,
  source_type, source_file_id, batch_id, imported_by_employee_id,
  version, status
) values (
  '30000000-0000-0000-0000-000000000001', date '2026-07-01',
  '40000000-0000-0000-0000-000000000001', null, 'SALES', 'Sales', 100,
  'acl_fixture', '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001', 1, 'confirmed'
);

select id from public.dbf_pl_detail_facts
 where id = '30000000-0000-0000-0000-000000000001';

update public.dbf_pl_detail_facts
   set is_active = false, superseded_at = statement_timestamp()
 where id = '30000000-0000-0000-0000-000000000001';

insert into public.dbf_pl_detail_facts (
  id, fiscal_month, company_id, store_id, account_code, account_name, amount,
  source_type, source_file_id, batch_id, imported_by_employee_id,
  version, status, correction_of_fact_id, correction_reason
) values (
  '30000000-0000-0000-0000-000000000002', date '2026-07-01',
  '40000000-0000-0000-0000-000000000001', null, 'SALES', 'Sales', 110,
  'acl_fixture', '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001', 2, 'confirmed',
  '30000000-0000-0000-0000-000000000001', 'fixture correction'
);

reset role;

do $$
begin
  if (select count(*) from public.dbf_pl_detail_facts) <> 2
     or (select count(*) from public.dbf_pl_detail_facts where is_active) <> 1
     or (select count(*) from public.dbf_pl_detail_facts where not is_active) <> 1
     or not exists (
       select 1 from public.dbf_pl_detail_facts
        where correction_of_fact_id = '30000000-0000-0000-0000-000000000001'
     ) then
    raise exception 'Correction happy path did not preserve active/superseded lineage';
  end if;
end
$$;

rollback;

do $$
begin
  if (select count(*) from public.dbf_pl_detail_facts) <> 0
     or (select count(*) from dbf_ingest.source_files) <> 0
     or (select count(*) from dbf_ingest.import_batches) <> 0 then
    raise exception 'Correction fixture rollback did not restore zero rows';
  end if;
end
$$;
