-- PR002 / ACF-08 / M019
-- Accounting Consumer release and least-privilege security finalization.

create table accounting.consumer_access_contracts (
  consumer_access_contract_id uuid primary key default gen_random_uuid(),
  access_key uuid not null,
  decision_sequence integer not null,
  auth_subject_id uuid not null,
  employee_id uuid not null references core.employee_identities(employee_id) on delete restrict,
  assignment_version_id uuid not null
    references core.employee_store_assignments(assignment_version_id) on delete restrict,
  scope_type text not null,
  corporation_id uuid not null references core.corporation_identities(corporation_id) on delete restrict,
  store_id uuid null references core.store_identities(store_id) on delete restrict,
  department_id uuid null references core.department_identities(department_id) on delete restrict,
  scenario_type text not null references accounting.scenario_contracts(scenario_type) on delete restrict,
  decision text not null,
  effective_at timestamptz not null,
  evidence_reference text not null,
  contract_version text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint consumer_access_contracts_sequence_check check (decision_sequence > 0),
  constraint consumer_access_contracts_scope_check check (
    (scope_type='corporation' and store_id is null and department_id is null)
    or (scope_type='store' and store_id is not null and department_id is null)
    or (scope_type='department' and store_id is null and department_id is not null)
  ),
  constraint consumer_access_contracts_decision_check check (decision in ('grant','revoke')),
  constraint consumer_access_contracts_evidence_check check (
    evidence_reference ~ '^(approval|catalog|contract|evidence):[A-Za-z0-9][A-Za-z0-9._:/-]{0,247}$'
  ),
  constraint consumer_access_contracts_version_check check (
    contract_version ~ '^[a-z][a-z0-9._:-]{0,79}$'
  ),
  constraint consumer_access_contracts_key_sequence_unique unique (access_key,decision_sequence)
);

create index consumer_access_contracts_subject_idx
  on accounting.consumer_access_contracts(auth_subject_id,access_key,decision_sequence desc);
create index consumer_access_contracts_employee_idx
  on accounting.consumer_access_contracts(employee_id);
create index consumer_access_contracts_assignment_idx
  on accounting.consumer_access_contracts(assignment_version_id);
create index consumer_access_contracts_scope_idx
  on accounting.consumer_access_contracts(corporation_id,scenario_type,scope_type,store_id,department_id);

create function accounting.guard_consumer_access_contract()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  prior accounting.consumer_access_contracts%rowtype;
  as_of_date date := new.effective_at::date;
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'BDF_M019_ACCESS_CONTRACT_APPEND_ONLY';
  end if;

  if not exists (
    select 1 from core.employee_identities i
    join core.employees e on e.employee_id=i.employee_id
    where i.employee_id=new.employee_id and i.identity_status='active'
      and e.status='active' and e.effective_from<=as_of_date
      and (e.effective_to is null or as_of_date<e.effective_to)
  ) then raise exception 'BDF_M019_EMPLOYEE_NOT_ACTIVE'; end if;

  if not exists (
    select 1 from core.employee_store_assignments a
    join core.assignment_identities i on i.assignment_id=a.assignment_id
    where a.assignment_version_id=new.assignment_version_id
      and a.employee_id=new.employee_id and a.status='active'
      and i.identity_status='active' and a.effective_from<=as_of_date
      and (a.effective_to is null or as_of_date<a.effective_to)
  ) then raise exception 'BDF_M019_CANONICAL_ASSIGNMENT_REQUIRED'; end if;

  if new.scope_type='store' and not exists (
    select 1 from core.employee_store_assignments a
    join core.store_identities s on s.store_id=a.store_id and s.identity_status='active'
    join core.corporation_store_relationships r on r.store_id=a.store_id
    where a.assignment_version_id=new.assignment_version_id and a.store_id=new.store_id
      and r.corporation_id=new.corporation_id and r.relationship_type='accounting'
      and r.effective_from<=as_of_date and (r.effective_to is null or as_of_date<r.effective_to)
  ) then raise exception 'BDF_M019_STORE_SCOPE_MISMATCH'; end if;

  if new.scope_type='corporation' and not exists (
    select 1 from core.employee_store_assignments a
    join core.corporation_store_relationships r on r.store_id=a.store_id
    where a.assignment_version_id=new.assignment_version_id
      and r.corporation_id=new.corporation_id and r.relationship_type='accounting'
      and r.effective_from<=as_of_date and (r.effective_to is null or as_of_date<r.effective_to)
  ) then raise exception 'BDF_M019_CORPORATION_SCOPE_MISMATCH'; end if;

  if new.scope_type='department' and not exists (
    select 1 from core.employees e
    join core.departments d on d.department_id=e.primary_department_id
    where e.employee_id=new.employee_id and d.department_id=new.department_id
      and d.corporation_id=new.corporation_id and e.status='active' and d.status='active'
      and e.effective_from<=as_of_date and (e.effective_to is null or as_of_date<e.effective_to)
      and d.effective_from<=as_of_date and (d.effective_to is null or as_of_date<d.effective_to)
  ) then raise exception 'BDF_M019_DEPARTMENT_SCOPE_MISMATCH'; end if;

  -- Serialize identity-binding decisions for one Auth subject. Different
  -- subjects use different keys and remain independently concurrent.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'bdf|m019|auth_subject|'||new.auth_subject_id::text,0
  ));

  select * into prior from accounting.consumer_access_contracts
  where access_key=new.access_key order by decision_sequence desc limit 1;
  if not found then
    if new.decision_sequence<>1 or new.decision<>'grant' then
      raise exception 'BDF_M019_ACCESS_CHAIN_MUST_START_GRANT';
    end if;
  else
    if new.decision_sequence<>prior.decision_sequence+1
      or new.decision=prior.decision
      or (to_jsonb(new)-array['consumer_access_contract_id','decision_sequence','decision','effective_at','evidence_reference','recorded_at'])
         is distinct from
         (to_jsonb(prior)-array['consumer_access_contract_id','decision_sequence','decision','effective_at','evidence_reference','recorded_at']) then
      raise exception 'BDF_M019_ACCESS_CHAIN_INVALID';
    end if;
  end if;

  if new.decision='grant' and exists (
    with latest as (
      select distinct on(access_key) auth_subject_id,employee_id,decision
      from accounting.consumer_access_contracts
      where effective_at<=new.effective_at
      order by access_key,decision_sequence desc
    ) select 1 from latest where auth_subject_id=new.auth_subject_id
      and decision='grant' and employee_id<>new.employee_id
  ) then raise exception 'BDF_M019_AUTH_SUBJECT_IDENTITY_CONFLICT'; end if;
  return new;
end
$function$;

create trigger guard_consumer_access_contract
before insert or update or delete on accounting.consumer_access_contracts
for each row execute function accounting.guard_consumer_access_contract();

create function accounting.current_consumer_access_contracts(
  p_auth_subject_id uuid,p_corporation_id uuid,p_accounting_period date,p_scenario_type text
) returns table(scope_type text,store_id uuid,department_id uuid)
language sql stable security invoker set search_path=''
as $function$
  with latest as (
    select distinct on(c.access_key) c.* from accounting.consumer_access_contracts c
    where c.effective_at<=statement_timestamp() order by c.access_key,c.decision_sequence desc
  )
  select c.scope_type,c.store_id,c.department_id
  from latest c
  join core.employee_identities ei on ei.employee_id=c.employee_id and ei.identity_status='active'
  join core.employees e on e.employee_id=c.employee_id and e.status='active'
    and e.effective_from<=p_accounting_period and (e.effective_to is null or p_accounting_period<e.effective_to)
  join core.employee_store_assignments a on a.assignment_version_id=c.assignment_version_id
    and a.employee_id=c.employee_id and a.status='active'
    and a.effective_from<=p_accounting_period and (a.effective_to is null or p_accounting_period<a.effective_to)
  where c.decision='grant' and c.auth_subject_id=p_auth_subject_id
    and c.corporation_id=p_corporation_id and c.scenario_type=p_scenario_type
    and (
      (c.scope_type='corporation' and exists(
        select 1 from core.corporation_store_relationships r where r.store_id=a.store_id
          and r.corporation_id=c.corporation_id and r.relationship_type='accounting'
          and r.effective_from<=p_accounting_period and (r.effective_to is null or p_accounting_period<r.effective_to)))
      or (c.scope_type='store' and c.store_id=a.store_id and exists(
        select 1 from core.corporation_store_relationships r where r.store_id=a.store_id
          and r.corporation_id=c.corporation_id and r.relationship_type='accounting'
          and r.effective_from<=p_accounting_period and (r.effective_to is null or p_accounting_period<r.effective_to)))
      or (c.scope_type='department' and e.primary_department_id=c.department_id and exists(
        select 1 from core.departments d where d.department_id=c.department_id
          and d.corporation_id=c.corporation_id and d.status='active'
          and d.effective_from<=p_accounting_period and (d.effective_to is null or p_accounting_period<d.effective_to)))
    );
$function$;

create function projection.read_accounting_consumer_v1(
  p_projection text,p_corporation_id uuid,p_accounting_period date,p_scenario_type text
) returns setof jsonb
language plpgsql stable security definer set search_path=''
as $function$
declare
  claims jsonb;
  subject_id uuid;
  jwt_role text;
  authorized boolean;
begin
  begin
    claims:=coalesce(nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
    subject_id:=coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),''),claims->>'sub')::uuid;
    jwt_role:=lower(coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role',true),''),claims->>'role',''));
  exception when others then raise exception 'BDF_M019_AUTHENTICATION_REQUIRED'; end;
  if jwt_role<>'authenticated' or subject_id is null then raise exception 'BDF_M019_AUTHENTICATION_REQUIRED'; end if;
  if p_projection not in ('publication_status','corporation_pl','corporation_bs','store_profit','corporation_comparison','cash_flow')
     or p_scenario_type not in ('actual','budget','forecast') then
    raise exception 'BDF_M019_CONSUMER_REQUEST_INVALID';
  end if;

  select exists(select 1 from accounting.current_consumer_access_contracts(
    subject_id,p_corporation_id,p_accounting_period,p_scenario_type
  )) into authorized;
  if not authorized then raise exception 'BDF_M019_CONSUMER_ACCESS_DENIED'; end if;

  if p_projection='publication_status' then
    return query with permitted as (
      select * from accounting.current_consumer_access_contracts(subject_id,p_corporation_id,p_accounting_period,p_scenario_type)
    ) select to_jsonb(v) from projection.accounting_publication_status_v1 v
      where v.corporation_id=p_corporation_id and v.accounting_period=p_accounting_period
        and v.scenario_type=p_scenario_type and exists(select 1 from permitted);
  elsif p_projection in ('corporation_pl','corporation_bs') then
    return query with permitted as (
      select * from accounting.current_consumer_access_contracts(subject_id,p_corporation_id,p_accounting_period,p_scenario_type)
    ), lines as (
      select * from projection.accounting_corporation_pl_v1 where p_projection='corporation_pl'
      union all select * from projection.accounting_corporation_bs_v1 where p_projection='corporation_bs'
    ) select to_jsonb(v) from lines v where v.corporation_id=p_corporation_id
      and v.accounting_period=p_accounting_period and v.scenario_type=p_scenario_type
      and exists(select 1 from permitted c where c.scope_type='corporation'
        or (c.scope_type='store' and c.store_id=v.store_id)
        or (c.scope_type='department' and c.department_id=v.department_id));
  elsif p_projection='store_profit' then
    return query with permitted as (
      select * from accounting.current_consumer_access_contracts(subject_id,p_corporation_id,p_accounting_period,p_scenario_type)
    ) select to_jsonb(v) from projection.accounting_store_profit_v1 v
      where v.corporation_id=p_corporation_id and v.accounting_period=p_accounting_period
        and v.scenario_type=p_scenario_type and exists(select 1 from permitted c
          where c.scope_type='corporation' or (c.scope_type='store' and c.store_id=v.store_id));
  elsif p_projection='corporation_comparison' then
    return query with permitted as (
      select * from accounting.current_consumer_access_contracts(subject_id,p_corporation_id,p_accounting_period,p_scenario_type)
      where scope_type='corporation'
    ) select to_jsonb(v) from projection.accounting_corporation_comparison_v1 v
      where v.corporation_id=p_corporation_id and v.accounting_period=p_accounting_period
        and v.scenario_type=p_scenario_type and exists(select 1 from permitted);
  else
    return query select to_jsonb(v) from projection.accounting_cash_flow_v1 v where false;
  end if;
end
$function$;

alter table accounting.consumer_access_contracts enable row level security;
alter table accounting.consumer_access_contracts force row level security;
revoke all on accounting.consumer_access_contracts from public,anon,authenticated,service_role;
revoke all on function accounting.guard_consumer_access_contract() from public,anon,authenticated,service_role;
revoke all on function accounting.current_consumer_access_contracts(uuid,uuid,date,text) from public,anon,authenticated,service_role;
revoke all on function projection.read_accounting_consumer_v1(text,uuid,date,text) from public,anon,authenticated,service_role;
grant usage on schema projection to authenticated;
grant execute on function projection.read_accounting_consumer_v1(text,uuid,date,text) to authenticated;
