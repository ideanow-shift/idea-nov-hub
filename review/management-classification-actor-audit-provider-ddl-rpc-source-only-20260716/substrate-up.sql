-- SOURCE CANDIDATE ONLY. DO NOT APPLY TO PRODUCTION.
-- Non-disruptive substrate: status reader and SELECT-only actor/audit stub only.

begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $precondition$
declare owner_oid oid; target_count integer;
begin
  select count(*)::integer into target_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'finance_account_classification_rules'
    and c.relkind in ('r', 'p');
  if target_count <> 1 then
    raise exception using errcode = '42P01', message = 'ACTOR_AUDIT_TARGET_NOT_EXACT';
  end if;

  select oid into owner_oid from pg_catalog.pg_roles
  where rolname = 'classification_actor_audit_provider_owner';
  if owner_oid is not null then
    if not exists (
      select 1 from pg_catalog.pg_roles where oid = owner_oid
        and rolcanlogin = false and rolsuper = false
        and rolcreatedb = false and rolcreaterole = false
        and rolinherit = false and rolreplication = false
        and rolbypassrls = false
    ) then
      raise exception using errcode = '42501', message = 'ACTOR_AUDIT_OWNER_ATTRIBUTES_MISMATCH';
    end if;
    if exists (select 1 from pg_catalog.pg_auth_members where roleid = owner_oid or member = owner_oid) then
      raise exception using errcode = '42501', message = 'ACTOR_AUDIT_OWNER_MEMBERSHIP_NOT_ZERO';
    end if;
  end if;

  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'read_finance_classification_actor_audit_provider_status',
        'resolve_finance_classification_actor_audit'
      )
  ) then
    raise exception using errcode = '42710', message = 'ACTOR_AUDIT_PROVIDER_OBJECT_COLLISION';
  end if;
end
$precondition$;

do $role$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'classification_actor_audit_provider_owner') then
    create role classification_actor_audit_provider_owner
      nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
end
$role$;

create function public.read_finance_classification_actor_audit_provider_status()
returns table (
  category text,
  "providerReady" boolean,
  "employeeResolverInstalled" boolean,
  "roleResolverInstalled" boolean,
  "auditCommandInstalled" boolean,
  "runtimeWired" boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select 'ACTOR_AUDIT_PROVIDER_NOT_READY'::text, false, false, false, false, false
$function$;

alter function public.read_finance_classification_actor_audit_provider_status()
  owner to classification_actor_audit_provider_owner;
revoke all on function public.read_finance_classification_actor_audit_provider_status()
  from public, anon, authenticated;

create function public.resolve_finance_classification_actor_audit(p_rule_id uuid)
returns table (
  category text,
  "providerReady" boolean,
  "employeeBound" boolean,
  "roleAuthorized" boolean,
  "scopeMatched" boolean,
  "auditBound" boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select 'ACTOR_AUDIT_PROVIDER_NOT_READY'::text, false, false, false, false, false
$function$;

alter function public.resolve_finance_classification_actor_audit(uuid)
  owner to classification_actor_audit_provider_owner;
revoke all on function public.resolve_finance_classification_actor_audit(uuid)
  from public, anon, authenticated;

do $postcondition$
declare owner_oid oid;
begin
  select oid into strict owner_oid from pg_catalog.pg_roles
  where rolname = 'classification_actor_audit_provider_owner';
  if exists (select 1 from pg_catalog.pg_auth_members where roleid = owner_oid or member = owner_oid) then
    raise exception using errcode = '42501', message = 'ACTOR_AUDIT_OWNER_MEMBERSHIP_NOT_ZERO';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where n.nspname = 'public'
      and p.proname in (
        'read_finance_classification_actor_audit_provider_status',
        'resolve_finance_classification_actor_audit'
      )
      and a.privilege_type = 'EXECUTE'
      and a.grantee <> p.proowner
  ) then
    raise exception using errcode = '42501', message = 'ACTOR_AUDIT_PROVIDER_UNAPPROVED_EXECUTE';
  end if;
end
$postcondition$;

commit;
