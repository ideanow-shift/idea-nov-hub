-- AUTH-01 / M019 Production port over the existing NOV HUB masters.
-- Additive contract only. No employee, role, store, Auth user or grant is populated.
-- The incompatible BDF core.* model and all application tables remain untouched.
begin;
create schema identity_access;
revoke all on schema identity_access from public, anon, authenticated;
grant usage on schema identity_access to service_role;
alter default privileges in schema identity_access revoke execute on functions from public;
alter default privileges in schema identity_access revoke all on tables from public, anon, authenticated;

create view identity_access.canonical_employee_v1 with (security_invoker=true) as
select e.id as employee_id, e.employee_id as source_employee_code, e.store_id as own_store_id
from public.employees e
where e.is_active and e.employment_status in ('現職','在籍','active','Active')
  and (e.joined_on is null or e.joined_on <= current_date)
  and (e.retired_on is null or e.retired_on > current_date);

create view identity_access.canonical_store_v1 with (security_invoker=true) as
select s.id as store_id, s.store_id as store_key, s.store_no, s.store_name,
  s.corporation_id, c.corporation_name,
  case when s.store_type in ('直営','DIRECT','直営店') then 'DIRECT' else 'FC' end as ownership,
  p.opened_on as effective_from, p.closed_on as effective_to
from public.stores s join public.corporations c on c.id=s.corporation_id and c.is_active
left join public.store_business_profiles p on p.store_id=s.id
where s.is_active and s.store_type in ('直営','DIRECT','直営店','FC','FRANCHISE','FC店')
  and (p.opened_on is null or p.opened_on<=current_date)
  and (p.closed_on is null or current_date<p.closed_on)
  and (p.operating_status is null or p.operating_status in ('営業中','active','operating'));

-- Explicit namespace mapping: no code/name/email heuristics. Optional external aliases
-- require a separately approved evidence record; no alias is populated by this migration.
create table identity_access.store_alias_decisions (
 decision_id uuid primary key default gen_random_uuid(), decision_key uuid not null,
 decision_sequence integer not null check(decision_sequence>0), decision text not null check(decision in ('grant','revoke')),
 source_system text not null check(source_system in ('legacy_core','bdf')),
 source_store_id uuid not null, canonical_store_id uuid not null references public.stores(id) on delete restrict,
 granted_at timestamptz not null default statement_timestamp(), revoked_at timestamptz,
 evidence_reference text not null check(evidence_reference ~ '^(approval|evidence|contract):[A-Za-z0-9._:/-]{1,240}$'),
 recorded_at timestamptz not null default statement_timestamp(), unique(decision_key,decision_sequence)
);
create view identity_access.store_alias_latest with (security_invoker=true) as
select distinct on(decision_key) * from identity_access.store_alias_decisions order by decision_key,decision_sequence desc;
create view identity_access.store_identity_mapping_v1 with (security_invoker=true) as
select 'nov_hub_public'::text as source_system,s.store_id as source_store_id,s.store_id as canonical_store_id
from identity_access.canonical_store_v1 s
union all select a.source_system,a.source_store_id,a.canonical_store_id from identity_access.store_alias_latest a
join identity_access.canonical_store_v1 s on s.store_id=a.canonical_store_id where a.decision='grant';

create table identity_access.auth01_binding_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  decision_key uuid not null, decision_sequence integer not null check(decision_sequence>0),
  decision text not null check(decision in ('grant','revoke')),
  provider text not null check(provider='nov_hub'),
  issuer text not null check(issuer='nov_hub_production'),
  audience text not null check(audience='nov_hub'),
  subject_digest text not null check(subject_digest ~ '^[a-f0-9]{64}$'),
  employee_id uuid not null references public.employees(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  expires_at timestamptz,
  evidence_reference text not null check(evidence_reference ~ '^(approval|evidence|contract):[A-Za-z0-9._:/-]{1,240}$'),
  recorded_at timestamptz not null default statement_timestamp(),
  unique(decision_key,decision_sequence),
  check(expires_at is null or expires_at>granted_at)
);

-- This port grants a scope, never a Role. Role is re-read from NOV HUB.
-- Existing public employee_store_assignments remain the assigned-store master.
create table identity_access.m019_scope_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  decision_key uuid not null, decision_sequence integer not null check(decision_sequence>0),
  decision text not null check(decision in ('grant','revoke')),
  employee_id uuid not null references public.employees(id) on delete restrict,
  assignment_type text not null check(assignment_type in ('global','delegated','primary')),
  scope_type text not null check(scope_type in ('all','assigned','own')),
  scope_id uuid references public.stores(id) on delete restrict,
  source_assignment_id uuid references public.employee_store_assignments(id) on delete restrict,
  effective_from date not null, effective_to date,
  granted_at timestamptz not null default statement_timestamp(), revoked_at timestamptz,
  evidence_reference text not null check(evidence_reference ~ '^(approval|evidence|contract):[A-Za-z0-9._:/-]{1,240}$'),
  recorded_at timestamptz not null default statement_timestamp(),
  unique(decision_key,decision_sequence),
  check(effective_to is null or effective_to>effective_from),
  check((scope_type='all' and assignment_type='global' and scope_id is null and source_assignment_id is null)
    or (scope_type='assigned' and assignment_type='delegated' and scope_id is not null and source_assignment_id is not null)
    or (scope_type='own' and assignment_type='primary' and scope_id is not null and source_assignment_id is null))
);

create table identity_access.consumer_access_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  decision_key uuid not null, decision_sequence integer not null check(decision_sequence>0),
  decision text not null check(decision in ('grant','revoke')),
  employee_id uuid not null references public.employees(id) on delete restrict,
  consumer_key text not null check(consumer_key='store_operations_v1'),
  effective_from date not null, effective_to date,
  granted_at timestamptz not null default statement_timestamp(), revoked_at timestamptz,
  evidence_reference text not null check(evidence_reference ~ '^(approval|evidence|contract):[A-Za-z0-9._:/-]{1,240}$'),
  recorded_at timestamptz not null default statement_timestamp(),
  unique(decision_key,decision_sequence),
  check(effective_to is null or effective_to>effective_from)
);

alter table identity_access.auth01_binding_decisions add column recorded_by name not null default current_user;
alter table identity_access.m019_scope_decisions add column recorded_by name not null default current_user;
alter table identity_access.consumer_access_decisions add column recorded_by name not null default current_user;
alter table identity_access.store_alias_decisions add column recorded_by name not null default current_user;

create index auth01_subject_lookup on identity_access.auth01_binding_decisions(subject_digest,decision_key,decision_sequence desc);
create index auth01_employee_lookup on identity_access.auth01_binding_decisions(employee_id);
create index auth01_auth_user_lookup on identity_access.auth01_binding_decisions(auth_user_id);
create index m019_employee_lookup on identity_access.m019_scope_decisions(employee_id,decision_key,decision_sequence desc);
create index m019_source_assignment_lookup on identity_access.m019_scope_decisions(source_assignment_id);
create index m019_store_lookup on identity_access.m019_scope_decisions(scope_id);
create index consumer_employee_lookup on identity_access.consumer_access_decisions(employee_id,consumer_key,decision_key,decision_sequence desc);
create index store_alias_source_lookup on identity_access.store_alias_decisions(source_system,source_store_id);
create index store_alias_canonical_lookup on identity_access.store_alias_decisions(canonical_store_id);

create view identity_access.auth01_latest with (security_invoker=true) as
select distinct on (decision_key) * from identity_access.auth01_binding_decisions order by decision_key,decision_sequence desc;
create view identity_access.m019_latest with (security_invoker=true) as
select distinct on (decision_key) * from identity_access.m019_scope_decisions order by decision_key,decision_sequence desc;
create view identity_access.consumer_latest with (security_invoker=true) as
select distinct on (decision_key) * from identity_access.consumer_access_decisions order by decision_key,decision_sequence desc;

-- SERIALIZABLE/REPEATABLE READ stale snapshots must not be used for authoring.
-- One transaction lock serializes the very small administrative ledger write path.
create function identity_access.guard_decision_v1() returns trigger
language plpgsql security invoker set search_path='' as $fn$
declare prior jsonb; incoming jsonb; source_assignment public.employee_store_assignments%rowtype;
begin
  if tg_op<>'INSERT' then raise exception 'IDENTITY_ACCESS_APPEND_ONLY'; end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'IDENTITY_ACCESS_AUTHORING_REQUIRES_READ_COMMITTED'; end if;
  perform pg_advisory_xact_lock(718019001);
  new.recorded_at:=statement_timestamp();
  new.recorded_by:=current_user;
  if new.decision='revoke' then new.revoked_at:=statement_timestamp();
  elsif new.revoked_at is not null or new.granted_at>statement_timestamp() then
    raise exception 'IDENTITY_ACCESS_INVALID_TIME'; end if;
  incoming:=to_jsonb(new);
  execute format('select to_jsonb(d) from identity_access.%I d where decision_key=$1 order by decision_sequence desc limit 1',tg_table_name)
    into prior using new.decision_key;
  if prior is null then
    if new.decision_sequence<>1 or new.decision<>'grant' then raise exception 'IDENTITY_ACCESS_GRANT_REQUIRED'; end if;
  else
    if new.decision_sequence<>(prior->>'decision_sequence')::integer+1
      or new.decision<>'revoke' or prior->>'decision'<>'grant'
      or incoming-array['decision_id','decision_sequence','decision','revoked_at','evidence_reference','recorded_at','recorded_by']
        is distinct from prior-array['decision_id','decision_sequence','decision','revoked_at','evidence_reference','recorded_at','recorded_by'] then
      raise exception 'IDENTITY_ACCESS_INVALID_REVOKE'; end if;
  end if;
  -- Revocation remains possible after employee/assignment deactivation.
  if new.decision='revoke' then return new; end if;
  if tg_table_name='store_alias_decisions' then
    if not exists(select 1 from identity_access.canonical_store_v1 s where s.store_id=new.canonical_store_id)
      or exists(select 1 from identity_access.store_alias_latest a where a.decision='grant'
        and a.source_system=new.source_system and (a.source_store_id=new.source_store_id or a.canonical_store_id=new.canonical_store_id)) then
      raise exception 'STORE_ALIAS_MISSING_OR_AMBIGUOUS'; end if;
    return new;
  end if;
  if not exists(select 1 from identity_access.canonical_employee_v1 e where e.employee_id=new.employee_id) then
    raise exception 'IDENTITY_ACCESS_EMPLOYEE_INACTIVE'; end if;
  if tg_table_name='auth01_binding_decisions' then
    -- The external subject of a verified native HUB session is its immutable HUB employee UUID.
    if new.subject_digest<>encode(sha256(convert_to(new.employee_id::text,'UTF8')),'hex') then
      raise exception 'AUTH01_SUBJECT_EMPLOYEE_MISMATCH'; end if;
    if not exists(select 1 from auth.users u where u.id=new.auth_user_id and u.deleted_at is null
      and not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until<=statement_timestamp())) then
      raise exception 'AUTH01_AUTH_USER_INACTIVE'; end if;
    if exists(select 1 from identity_access.auth01_latest a where a.decision='grant'
      and (a.expires_at is null or a.expires_at>statement_timestamp())
      and (a.subject_digest=new.subject_digest or a.employee_id=new.employee_id or a.auth_user_id=new.auth_user_id)) then
      raise exception 'AUTH01_DUPLICATE_ACTIVE_BINDING'; end if;
  elsif tg_table_name='m019_scope_decisions' then
    if new.scope_type='assigned' then
      select * into source_assignment from public.employee_store_assignments a where a.id=new.source_assignment_id;
      if not found or source_assignment.employee_id<>new.employee_id or source_assignment.store_id<>new.scope_id
        or not source_assignment.is_active or source_assignment.assignment_type not in ('primary','secondary','third') then
        raise exception 'M019_SOURCE_ASSIGNMENT_MISMATCH'; end if;
    elsif new.scope_type='own' and not exists(select 1 from public.employees e where e.id=new.employee_id and e.store_id=new.scope_id) then
      raise exception 'M019_OWN_STORE_MISMATCH'; end if;
    if exists(select 1 from identity_access.m019_latest a where a.decision='grant' and a.employee_id=new.employee_id
      and daterange(a.effective_from,a.effective_to,'[)') && daterange(new.effective_from,new.effective_to,'[)')
      and (a.scope_type<>new.scope_type or new.scope_type<>'assigned' or a.scope_id=new.scope_id)) then
      raise exception 'M019_CONFLICTING_SCOPE'; end if;
  else
    if exists(select 1 from identity_access.consumer_latest a where a.decision='grant' and a.employee_id=new.employee_id
      and a.consumer_key=new.consumer_key
      and daterange(a.effective_from,a.effective_to,'[)') && daterange(new.effective_from,new.effective_to,'[)')) then
      raise exception 'CONSUMER_DUPLICATE_GRANT'; end if;
  end if;
  return new;
end $fn$;

create trigger auth01_append_only before insert or update or delete on identity_access.auth01_binding_decisions
for each row execute function identity_access.guard_decision_v1();
create trigger m019_append_only before insert or update or delete on identity_access.m019_scope_decisions
for each row execute function identity_access.guard_decision_v1();
create trigger consumer_append_only before insert or update or delete on identity_access.consumer_access_decisions
for each row execute function identity_access.guard_decision_v1();
create trigger store_alias_append_only before insert or update or delete on identity_access.store_alias_decisions
for each row execute function identity_access.guard_decision_v1();

alter table identity_access.auth01_binding_decisions enable row level security;
alter table identity_access.auth01_binding_decisions force row level security;
alter table identity_access.m019_scope_decisions enable row level security;
alter table identity_access.m019_scope_decisions force row level security;
alter table identity_access.consumer_access_decisions enable row level security;
alter table identity_access.consumer_access_decisions force row level security;
alter table identity_access.store_alias_decisions enable row level security;
alter table identity_access.store_alias_decisions force row level security;

-- Security invoker: service_role only. Does not mutate login/session/audit/business data.
create function public.store_operations_production_access_v1(p_subject_digest text)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare binding identity_access.auth01_binding_decisions%rowtype; employee uuid;
  resolved_role text; mode text; role_count integer; store_ids uuid[]; roles text[]; master jsonb;
begin
  if p_subject_digest is null or p_subject_digest !~ '^[a-f0-9]{64}$' then raise exception 'AUTH01_DENIED'; end if;
  select a.* into binding from identity_access.auth01_latest a
    join auth.users u on u.id=a.auth_user_id and u.deleted_at is null and not coalesce(u.is_anonymous,false)
      and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=statement_timestamp())
    join identity_access.canonical_employee_v1 e on e.employee_id=a.employee_id
    where a.subject_digest=p_subject_digest and a.provider='nov_hub' and a.issuer='nov_hub_production'
      and a.audience='nov_hub' and a.decision='grant'
      and a.granted_at<=statement_timestamp() and (a.expires_at is null or a.expires_at>statement_timestamp());
  if not found then raise exception 'AUTH01_DENIED'; end if;
  employee:=binding.employee_id;
  if (select count(*) from identity_access.auth01_latest a where a.decision='grant'
      and (a.expires_at is null or a.expires_at>statement_timestamp())
      and (a.employee_id=employee or a.subject_digest=p_subject_digest or a.auth_user_id=binding.auth_user_id))<>1 then
    raise exception 'AUTH01_AMBIGUOUS'; end if;
  if (select count(*) from public.employee_login_credentials c where c.employee_id=employee)<>1
    or not exists(select 1 from public.employee_login_credentials c where c.employee_id=employee and c.login_enabled
      and (c.locked_until is null or c.locked_until<=statement_timestamp())) then raise exception 'AUTH01_LOGIN_DISABLED'; end if;
  select array_agg(distinct case when r.role_key in ('executive','super_admin') then 'executive' else r.role_key end)
    into roles from public.employee_roles g join public.roles r on r.id=g.role_id and r.is_active
    where g.employee_id=employee and g.is_active and r.role_key in ('executive','super_admin','area_manager','store_manager')
      and (r.role_key not in ('executive','super_admin') or (g.scope_type in ('all','global') and g.scope_id is null));
  role_count:=coalesce(cardinality(roles),0);
  if role_count<>1 then raise exception 'ROLE_MISSING_OR_CONFLICTING'; end if;
  resolved_role:=roles[1];
  mode:=case resolved_role when 'executive' then 'all' when 'area_manager' then 'assigned' else 'own' end;
  if not exists(select 1 from identity_access.consumer_latest c where c.employee_id=employee
    and c.consumer_key='store_operations_v1' and c.decision='grant' and c.effective_from<=current_date
    and (c.effective_to is null or current_date<c.effective_to)) then raise exception 'CONSUMER_ACCESS_DENIED'; end if;
  if exists(select 1 from identity_access.m019_latest m where m.employee_id=employee and m.decision='grant'
    and m.effective_from<=current_date and (m.effective_to is null or current_date<m.effective_to)
    and m.scope_type<>mode) then raise exception 'M019_ROLE_SCOPE_MISMATCH'; end if;
  if (select count(*) from identity_access.canonical_store_v1)<>20
    or (select count(*) from identity_access.canonical_store_v1 where ownership='DIRECT')<>13
    or (select count(*) from identity_access.canonical_store_v1 where ownership='FC')<>7
    or (select count(distinct store_key) from identity_access.canonical_store_v1)<>20
    or exists(select 1 from identity_access.canonical_store_v1 where nullif(trim(store_key),'') is null
      or nullif(trim(store_name),'') is null or nullif(trim(corporation_name),'') is null) then
    raise exception 'OFFICIAL_STORE_POPULATION_INVALID'; end if;
  select array_agg(distinct s.store_id order by s.store_id) into store_ids
    from identity_access.canonical_store_v1 s
    join identity_access.m019_latest m on m.employee_id=employee and m.decision='grant' and m.scope_type=mode
      and m.effective_from<=current_date and (m.effective_to is null or current_date<m.effective_to)
    where mode='all' or (m.scope_id=s.store_id
      and exists(select 1 from public.employee_roles g join public.roles r on r.id=g.role_id and r.is_active
        where g.employee_id=employee and g.is_active and r.role_key=resolved_role
          and ((g.scope_type in ('all','global') and g.scope_id is null)
            or (g.scope_type in ('store','assigned','own') and g.scope_id=s.store_id))) and (
      (mode='own' and exists(select 1 from identity_access.canonical_employee_v1 e where e.employee_id=employee and e.own_store_id=s.store_id))
      or (mode='assigned' and exists(select 1 from public.employee_store_assignments a
        where a.id=m.source_assignment_id and a.employee_id=employee and a.store_id=s.store_id and a.is_active
          and a.assignment_type in ('primary','secondary','third') and a.effective_from<=current_date
          and (a.effective_to is null or current_date<=a.effective_to)))));
  if coalesce(cardinality(store_ids),0)=0 or (mode='own' and cardinality(store_ids)<>1)
    or (mode='all' and cardinality(store_ids)<>20) then raise exception 'M019_SCOPE_DENIED'; end if;
  -- Whole official master travels only between trusted servers; the public projection filters by scope.
  select jsonb_agg(jsonb_build_object('id',s.store_id,'store_id',s.store_key,'store_no',s.store_no,
    'store_name',s.store_name,'corporation_id',s.corporation_id,'store_type',s.ownership,'is_active',true)
    order by s.store_key) into master from identity_access.canonical_store_v1 s;
  return jsonb_build_object('contract','production_identity_access_v1','employeeId',employee,
    'roleKeys',jsonb_build_array(resolved_role),'scope',jsonb_build_object('mode',mode,'storeIds',to_jsonb(store_ids)),
    'masters',jsonb_build_object('stores',master,
      'corporations',(select jsonb_agg(jsonb_build_object('id',c.id,'corporation_name',c.corporation_name,'is_active',true))
        from public.corporations c where c.is_active and exists(select 1 from identity_access.canonical_store_v1 s where s.corporation_id=c.id)),
      'corporation_business_profiles',(select coalesce(jsonb_agg(jsonb_build_object('corporation_id',p.corporation_id,'fiscal_year_end_month',p.fiscal_year_end_month)),'[]'::jsonb)
        from public.corporation_business_profiles p where exists(select 1 from identity_access.canonical_store_v1 s where s.corporation_id=p.corporation_id))));
end $fn$;

revoke all on all tables in schema identity_access from public,anon,authenticated;
revoke all on all tables in schema identity_access from service_role;
revoke all on all functions in schema identity_access from public,anon,authenticated;
grant select on all tables in schema identity_access to service_role;
grant insert on identity_access.auth01_binding_decisions,identity_access.m019_scope_decisions,identity_access.consumer_access_decisions to service_role;
grant insert on identity_access.store_alias_decisions to service_role;
revoke update,delete,truncate on all tables in schema identity_access from service_role;
grant execute on function identity_access.guard_decision_v1() to service_role;
revoke all on function public.store_operations_production_access_v1(text) from public,anon,authenticated;
grant execute on function public.store_operations_production_access_v1(text) to service_role;
comment on function public.store_operations_production_access_v1(text) is
 'Server-only AUTH-01/M019 Production port. Subject digest must come from the verified native NOV HUB session, never browser fields. No business writes.';
commit;
