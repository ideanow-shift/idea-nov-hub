-- DBF Business Facts MVP / Phase 1 canonical Fact ACL corrective.
-- Scope is intentionally limited to the five public.dbf_*_facts tables below.
-- The Supabase public-schema default ACL made service_role broader than the
-- Phase B contract when the foundation tables were created.  This migration
-- replaces only those direct table ACLs with SELECT / INSERT / UPDATE.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  target_count integer;
  invalid_relation_count integer;
  owner_violation_count integer;
  membership_count integer;
  sequence_dependency_count integer;
  public_grant_count integer;
  browser_grant_count integer;
  service_grant_option_count integer;
begin
  if to_regrole('service_role') is null
     or to_regrole('anon') is null
     or to_regrole('authenticated') is null then
    raise exception 'Required Supabase roles are missing; refusing ACL corrective';
  end if;

  select count(*)
    into target_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where (n.nspname, c.relname) in (
     ('public', 'dbf_pl_detail_facts'),
     ('public', 'dbf_pl_aggregate_facts'),
     ('public', 'dbf_bs_facts'),
     ('public', 'dbf_store_monthly_metric_facts'),
     ('public', 'dbf_budget_facts')
   );

  if target_count <> 5 then
    raise exception 'Expected all five DBF Phase 1 Fact tables, found %', target_count;
  end if;

  select count(*)
    into invalid_relation_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where (n.nspname, c.relname) in (
     ('public', 'dbf_pl_detail_facts'),
     ('public', 'dbf_pl_aggregate_facts'),
     ('public', 'dbf_bs_facts'),
     ('public', 'dbf_store_monthly_metric_facts'),
     ('public', 'dbf_budget_facts')
   )
     and c.relkind <> 'r';

  if invalid_relation_count <> 0 then
    raise exception 'DBF Phase 1 Fact target is not an ordinary table';
  end if;

  select count(*)
    into owner_violation_count
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
     and (
       owner_role.rolname = 'service_role'
       or pg_has_role('service_role', owner_role.oid, 'MEMBER')
       or pg_has_role('service_role', owner_role.oid, 'SET')
     );

  if owner_violation_count <> 0 then
    raise exception 'service_role owns or can assume a DBF Phase 1 Fact owner role';
  end if;

  with recursive inherited_roles(role_oid) as (
    select m.roleid
      from pg_auth_members m
     where m.member = 'service_role'::regrole
    union
    select m.roleid
      from pg_auth_members m
      join inherited_roles inherited on inherited.role_oid = m.member
  )
  select count(*) into membership_count from inherited_roles;

  if membership_count <> 0 then
    raise exception 'service_role has inherited role memberships; refusing ambiguous ACL correction';
  end if;

  select count(*)
    into sequence_dependency_count
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where (n.nspname, c.relname) in (
     ('public', 'dbf_pl_detail_facts'),
     ('public', 'dbf_pl_aggregate_facts'),
     ('public', 'dbf_bs_facts'),
     ('public', 'dbf_store_monthly_metric_facts'),
     ('public', 'dbf_budget_facts')
   )
     and a.attnum > 0
     and not a.attisdropped
     and (
       a.attidentity <> ''
       or coalesce(pg_get_expr(d.adbin, d.adrelid), '') ~* '(^|[^[:alnum:]_])nextval[[:space:]]*\('
     );

  if sequence_dependency_count <> 0 then
    raise exception 'DBF Phase 1 Fact INSERT depends on a sequence; refusing out-of-contract grant';
  end if;

  select count(*)
    into public_grant_count
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
     and acl.grantee = 0;

  if public_grant_count <> 0 then
    raise exception 'PUBLIC has a DBF Phase 1 Fact table grant; refusing service_role-only corrective';
  end if;

  select count(*)
    into browser_grant_count
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
     and acl.grantee in ('anon'::regrole, 'authenticated'::regrole);

  if browser_grant_count <> 0 then
    raise exception 'Browser role has a DBF Phase 1 Fact table grant';
  end if;

  select count(*)
    into service_grant_option_count
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
     and acl.grantee = 'service_role'::regrole
     and acl.is_grantable;

  if service_grant_option_count <> 0 then
    raise exception 'service_role has GRANT OPTION before corrective';
  end if;
end
$$;

revoke all privileges on table
  public.dbf_pl_detail_facts,
  public.dbf_pl_aggregate_facts,
  public.dbf_bs_facts,
  public.dbf_store_monthly_metric_facts,
  public.dbf_budget_facts
from service_role;

grant select, insert, update on table
  public.dbf_pl_detail_facts,
  public.dbf_pl_aggregate_facts,
  public.dbf_bs_facts,
  public.dbf_store_monthly_metric_facts,
  public.dbf_budget_facts
to service_role;

do $$
declare
  relation record;
  actual_privileges text[];
  forbidden_privilege text;
  grant_option_count integer;
  public_grant_count integer;
  browser_grant_count integer;
begin
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
      raise exception 'Unexpected direct service_role ACL on %.%: %',
        relation.nspname, relation.relname, actual_privileges;
    end if;

    foreach forbidden_privilege in array array['DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']
    loop
      if has_table_privilege('service_role', relation.oid, forbidden_privilege) then
        raise exception 'service_role retains % on %.%',
          forbidden_privilege, relation.nspname, relation.relname;
      end if;
    end loop;

    if not has_table_privilege('service_role', relation.oid, 'SELECT')
       or not has_table_privilege('service_role', relation.oid, 'INSERT')
       or not has_table_privilege('service_role', relation.oid, 'UPDATE') then
      raise exception 'service_role is missing an allowed privilege on %.%',
        relation.nspname, relation.relname;
    end if;

    if exists (
      select 1
        from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])
          privilege_list(privilege_name)
       where has_table_privilege('anon', relation.oid, privilege_name)
          or has_table_privilege('authenticated', relation.oid, privilege_name)
    ) then
      raise exception 'Browser role gained an effective privilege on %.%',
        relation.nspname, relation.relname;
    end if;
  end loop;

  select count(*)
    into grant_option_count
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
     and acl.grantee = 'service_role'::regrole
     and acl.is_grantable;

  select count(*)
    into public_grant_count
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
     and acl.grantee = 0;

  select count(*)
    into browser_grant_count
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
     and acl.grantee in ('anon'::regrole, 'authenticated'::regrole);

  if grant_option_count <> 0
     or public_grant_count <> 0
     or browser_grant_count <> 0 then
    raise exception 'Post-corrective ACL validation failed: grant_option %, PUBLIC %, browser %',
      grant_option_count, public_grant_count, browser_grant_count;
  end if;
end
$$;

commit;
