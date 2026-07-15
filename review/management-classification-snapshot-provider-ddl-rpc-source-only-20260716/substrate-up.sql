-- SOURCE CANDIDATE ONLY. DO NOT APPLY TO PRODUCTION.
-- Non-disruptive substrate: no generator, trigger, or mutation path.

begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $precondition$
declare
  owner_oid oid;
begin
  select oid into owner_oid
  from pg_catalog.pg_roles
  where rolname = 'classification_snapshot_provider_owner';

  if owner_oid is not null then
    if not exists (
      select 1 from pg_catalog.pg_roles
      where oid = owner_oid
        and rolcanlogin = false and rolsuper = false
        and rolcreatedb = false and rolcreaterole = false
        and rolinherit = false and rolreplication = false
        and rolbypassrls = false
    ) then
      raise exception using errcode = '42501', message = 'SNAPSHOT_OWNER_ATTRIBUTES_MISMATCH';
    end if;
    if exists (
      select 1 from pg_catalog.pg_auth_members
      where roleid = owner_oid or member = owner_oid
    ) then
      raise exception using errcode = '42501', message = 'SNAPSHOT_OWNER_MEMBERSHIP_NOT_ZERO';
    end if;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_account_classification_rules'
      and column_name = 'classification_snapshot'
  ) then
    raise exception using errcode = '42701', message = 'SNAPSHOT_COLUMN_COLLISION';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'read_finance_classification_snapshot_provider_status',
        'derive_finance_classification_snapshot'
      )
  ) then
    raise exception using errcode = '42710', message = 'SNAPSHOT_PROVIDER_OBJECT_COLLISION';
  end if;
end
$precondition$;

do $role$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'classification_snapshot_provider_owner'
  ) then
    create role classification_snapshot_provider_owner
      nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
end
$role$;

alter table public.finance_account_classification_rules
  add column classification_snapshot text null;

alter table public.finance_account_classification_rules
  add constraint finance_account_classification_rules_snapshot_format
  check (
    classification_snapshot is null
    or classification_snapshot ~ '^s2:[a-f0-9]{64}$'
  );

create function public.read_finance_classification_snapshot_provider_status()
returns table (
  category text,
  "providerReady" boolean,
  "canonicalProviderInstalled" boolean,
  "runtimeWired" boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select 'SNAPSHOT_PROVIDER_NOT_READY'::text, false, false, false
$function$;

alter function public.read_finance_classification_snapshot_provider_status()
  owner to classification_snapshot_provider_owner;
revoke all on function public.read_finance_classification_snapshot_provider_status()
  from public, anon, authenticated;

create function public.derive_finance_classification_snapshot(p_rule_id uuid)
returns table (
  category text,
  "snapshotDerived" boolean,
  "versionBound" boolean,
  "collisionFree" boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select 'SNAPSHOT_PROVIDER_NOT_READY'::text, false, false, false
$function$;

alter function public.derive_finance_classification_snapshot(uuid)
  owner to classification_snapshot_provider_owner;
revoke all on function public.derive_finance_classification_snapshot(uuid)
  from public, anon, authenticated;

revoke update (classification_snapshot)
  on public.finance_account_classification_rules
  from public, anon, authenticated;

do $postcondition$
declare
  owner_oid oid;
begin
  select oid into strict owner_oid
  from pg_catalog.pg_roles
  where rolname = 'classification_snapshot_provider_owner';

  if exists (
    select 1 from pg_catalog.pg_auth_members
    where roleid = owner_oid or member = owner_oid
  ) then
    raise exception using errcode = '42501', message = 'SNAPSHOT_OWNER_MEMBERSHIP_NOT_ZERO';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) a
    where n.nspname = 'public'
      and p.proname in (
        'read_finance_classification_snapshot_provider_status',
        'derive_finance_classification_snapshot'
      )
      and a.privilege_type = 'EXECUTE'
      and a.grantee <> p.proowner
  ) then
    raise exception using errcode = '42501', message = 'SNAPSHOT_PROVIDER_UNAPPROVED_EXECUTE';
  end if;
end
$postcondition$;

commit;

