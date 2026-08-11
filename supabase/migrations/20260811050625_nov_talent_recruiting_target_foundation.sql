create table public.nov_talent_recruiting_targets_v1 (
  target_id uuid primary key default gen_random_uuid(),
  graduation_year integer not null check (graduation_year between 2020 and 2100),
  target_type text not null check (target_type in ('OFFERED', 'OFFER_ACCEPTED')),
  target_period_code text not null check (target_period_code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  target_period_start date not null,
  target_period_end date not null,
  scope_type text not null check (scope_type = 'COMPANY'),
  scope_id uuid,
  target_count integer not null check (target_count >= 0),
  version integer not null check (version >= 1),
  row_version integer not null default 1 check (row_version >= 1),
  record_state text not null check (record_state in ('DRAFT', 'APPROVED', 'SUPERSEDED')),
  effective_from date not null,
  effective_to date not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  approved_by uuid,
  approved_at timestamptz,
  superseded_by_target_id uuid references public.nov_talent_recruiting_targets_v1(target_id),
  superseded_by uuid,
  superseded_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint nov_talent_recruiting_targets_period_order check (target_period_start <= target_period_end),
  constraint nov_talent_recruiting_targets_effective_order check (effective_from <= effective_to),
  constraint nov_talent_recruiting_targets_company_scope check (scope_id is null),
  constraint nov_talent_recruiting_targets_approval_shape check (
    (record_state = 'DRAFT' and approved_by is null and approved_at is null and superseded_by is null and superseded_at is null)
    or (record_state = 'APPROVED' and approved_by is not null and approved_at is not null and superseded_by is null and superseded_at is null)
    or (record_state = 'SUPERSEDED' and approved_by is not null and approved_at is not null and superseded_by is not null and superseded_at is not null)
  ),
  unique (graduation_year, target_type, target_period_code, scope_type, version)
);

create unique index nov_talent_recruiting_targets_one_approved_v1
  on public.nov_talent_recruiting_targets_v1 (graduation_year, target_type, target_period_code, scope_type)
  where record_state = 'APPROVED';
create index nov_talent_recruiting_targets_history_v1
  on public.nov_talent_recruiting_targets_v1 (graduation_year, target_type, target_period_code, scope_type, version desc);

create table public.nov_talent_recruiting_target_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.nov_talent_recruiting_targets_v1(target_id),
  event_type text not null check (event_type in ('DRAFT_CREATED', 'VERSION_DRAFTED', 'APPROVED', 'SUPERSEDED')),
  previous_state text check (previous_state is null or previous_state in ('DRAFT', 'APPROVED', 'SUPERSEDED')),
  new_state text not null check (new_state in ('DRAFT', 'APPROVED', 'SUPERSEDED')),
  target_version integer not null check (target_version >= 1),
  actor_employee_id uuid not null,
  actor_role text not null check (actor_role in ('super_admin', 'hr.admin', 'backoffice')),
  occurred_at timestamptz not null default statement_timestamp()
);
create index nov_talent_recruiting_target_audit_target_v1
  on public.nov_talent_recruiting_target_audit_v1 (target_id, occurred_at, audit_id);

alter table public.nov_talent_recruiting_targets_v1 enable row level security;
alter table public.nov_talent_recruiting_targets_v1 force row level security;
alter table public.nov_talent_recruiting_target_audit_v1 enable row level security;
alter table public.nov_talent_recruiting_target_audit_v1 force row level security;
revoke all on public.nov_talent_recruiting_targets_v1 from public, anon, authenticated, service_role;
revoke all on public.nov_talent_recruiting_target_audit_v1 from public, anon, authenticated, service_role;
grant select on public.nov_talent_recruiting_targets_v1 to service_role;
grant select on public.nov_talent_recruiting_target_audit_v1 to service_role;

create or replace function public.nov_talent_recruiting_target_immutable_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception using errcode='55000', message='RECRUITING_TARGET_DELETE_PROHIBITED'; end if;
  if old.record_state = 'APPROVED' then
    if new.record_state <> 'SUPERSEDED'
      or row(new.graduation_year,new.target_type,new.target_period_code,new.target_period_start,new.target_period_end,new.scope_type,new.scope_id,new.target_count,new.version,new.effective_from,new.effective_to,new.reason,new.approved_by,new.approved_at,new.created_by,new.created_at)
         is distinct from row(old.graduation_year,old.target_type,old.target_period_code,old.target_period_start,old.target_period_end,old.scope_type,old.scope_id,old.target_count,old.version,old.effective_from,old.effective_to,old.reason,old.approved_by,old.approved_at,old.created_by,old.created_at)
    then raise exception using errcode='55000', message='APPROVED_RECRUITING_TARGET_IMMUTABLE'; end if;
  elsif old.record_state <> 'DRAFT' then
    raise exception using errcode='55000', message='RECRUITING_TARGET_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger nov_talent_recruiting_target_immutable_v1 before update or delete on public.nov_talent_recruiting_targets_v1
for each row execute function public.nov_talent_recruiting_target_immutable_v1();

create or replace function public.nov_talent_recruiting_target_audit_immutable_v1()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception using errcode='55000', message='RECRUITING_TARGET_AUDIT_APPEND_ONLY'; end $$;
create trigger nov_talent_recruiting_target_audit_immutable_v1 before update or delete on public.nov_talent_recruiting_target_audit_v1
for each row execute function public.nov_talent_recruiting_target_audit_immutable_v1();

create or replace function public.nov_talent_create_recruiting_target_draft_v1(
  p_actor_employee_id uuid, p_actor_role text, p_graduation_year integer, p_target_type text,
  p_target_period_code text, p_target_period_start date, p_target_period_end date,
  p_scope_type text, p_target_count integer, p_effective_from date, p_effective_to date, p_reason text
) returns setof public.nov_talent_recruiting_targets_v1 language plpgsql security definer set search_path = '' as $$
declare v_target public.nov_talent_recruiting_targets_v1; v_version integer;
begin
  if p_actor_employee_id is null or p_actor_role not in ('super_admin','hr.admin','backoffice') then raise exception using errcode='42501',message='RECRUITING_TARGET_ROLE_FORBIDDEN'; end if;
  if p_scope_type <> 'COMPANY' or p_target_type not in ('OFFERED','OFFER_ACCEPTED') then raise exception using errcode='22023',message='RECRUITING_TARGET_PHASE1_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',p_graduation_year,p_target_type,p_target_period_code,p_scope_type),0));
  select coalesce(max(t.version),0)+1 into v_version from public.nov_talent_recruiting_targets_v1 t where t.graduation_year=p_graduation_year and t.target_type=p_target_type and t.target_period_code=p_target_period_code and t.scope_type=p_scope_type;
  insert into public.nov_talent_recruiting_targets_v1(graduation_year,target_type,target_period_code,target_period_start,target_period_end,scope_type,target_count,version,record_state,effective_from,effective_to,reason,created_by)
  values(p_graduation_year,p_target_type,p_target_period_code,p_target_period_start,p_target_period_end,p_scope_type,p_target_count,v_version,'DRAFT',p_effective_from,p_effective_to,btrim(p_reason),p_actor_employee_id) returning * into v_target;
  insert into public.nov_talent_recruiting_target_audit_v1(target_id,event_type,previous_state,new_state,target_version,actor_employee_id,actor_role)
  values(v_target.target_id,case when v_version=1 then 'DRAFT_CREATED' else 'VERSION_DRAFTED' end,null,'DRAFT',v_version,p_actor_employee_id,p_actor_role);
  return next v_target;
end $$;

create or replace function public.nov_talent_approve_recruiting_target_v1(
  p_actor_employee_id uuid, p_actor_role text, p_target_id uuid, p_expected_row_version integer
) returns setof public.nov_talent_recruiting_targets_v1 language plpgsql security definer set search_path = '' as $$
declare v_target public.nov_talent_recruiting_targets_v1; v_old public.nov_talent_recruiting_targets_v1;
begin
  if p_actor_employee_id is null or p_actor_role not in ('super_admin','hr.admin') then raise exception using errcode='42501',message='RECRUITING_TARGET_APPROVAL_FORBIDDEN'; end if;
  select * into v_target from public.nov_talent_recruiting_targets_v1 where target_id=p_target_id for update;
  if not found then raise exception using errcode='P0002',message='RECRUITING_TARGET_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',v_target.graduation_year,v_target.target_type,v_target.scope_type),0));
  if v_target.record_state <> 'DRAFT' then raise exception using errcode='55000',message='RECRUITING_TARGET_NOT_DRAFT'; end if;
  if v_target.row_version <> p_expected_row_version then raise exception using errcode='40001',message='RECRUITING_TARGET_STALE_VERSION'; end if;
  if exists(select 1 from public.nov_talent_recruiting_targets_v1 t where t.record_state='APPROVED' and t.target_id<>v_target.target_id and t.graduation_year=v_target.graduation_year and t.target_type=v_target.target_type and t.scope_type=v_target.scope_type and daterange(t.target_period_start,t.target_period_end,'[]') && daterange(v_target.target_period_start,v_target.target_period_end,'[]') and t.target_period_code<>v_target.target_period_code)
  then raise exception using errcode='23P01',message='RECRUITING_TARGET_PERIOD_OVERLAP'; end if;
  select * into v_old from public.nov_talent_recruiting_targets_v1 t where t.graduation_year=v_target.graduation_year and t.target_type=v_target.target_type and t.target_period_code=v_target.target_period_code and t.scope_type=v_target.scope_type and t.record_state='APPROVED' for update;
  if found then
    update public.nov_talent_recruiting_targets_v1 set record_state='SUPERSEDED',superseded_by_target_id=v_target.target_id,superseded_by=p_actor_employee_id,superseded_at=statement_timestamp(),row_version=row_version+1,updated_at=statement_timestamp() where target_id=v_old.target_id;
    insert into public.nov_talent_recruiting_target_audit_v1(target_id,event_type,previous_state,new_state,target_version,actor_employee_id,actor_role) values(v_old.target_id,'SUPERSEDED','APPROVED','SUPERSEDED',v_old.version,p_actor_employee_id,p_actor_role);
  end if;
  update public.nov_talent_recruiting_targets_v1 set record_state='APPROVED',approved_by=p_actor_employee_id,approved_at=statement_timestamp(),row_version=row_version+1,updated_at=statement_timestamp() where target_id=v_target.target_id returning * into v_target;
  insert into public.nov_talent_recruiting_target_audit_v1(target_id,event_type,previous_state,new_state,target_version,actor_employee_id,actor_role) values(v_target.target_id,'APPROVED','DRAFT','APPROVED',v_target.version,p_actor_employee_id,p_actor_role);
  return next v_target;
end $$;

create or replace function public.nov_talent_supersede_recruiting_target_v1(
  p_actor_employee_id uuid, p_actor_role text, p_target_id uuid, p_expected_row_version integer
) returns setof public.nov_talent_recruiting_targets_v1 language plpgsql security definer set search_path = '' as $$
declare v_target public.nov_talent_recruiting_targets_v1;
begin
  if p_actor_employee_id is null or p_actor_role not in ('super_admin','hr.admin') then raise exception using errcode='42501',message='RECRUITING_TARGET_APPROVAL_FORBIDDEN'; end if;
  select * into v_target from public.nov_talent_recruiting_targets_v1 where target_id=p_target_id for update;
  if not found then raise exception using errcode='P0002',message='RECRUITING_TARGET_NOT_FOUND'; end if;
  if v_target.record_state<>'APPROVED' then raise exception using errcode='55000',message='RECRUITING_TARGET_NOT_APPROVED'; end if;
  if v_target.row_version<>p_expected_row_version then raise exception using errcode='40001',message='RECRUITING_TARGET_STALE_VERSION'; end if;
  update public.nov_talent_recruiting_targets_v1 set record_state='SUPERSEDED',superseded_by=p_actor_employee_id,superseded_at=statement_timestamp(),row_version=row_version+1,updated_at=statement_timestamp() where target_id=p_target_id returning * into v_target;
  insert into public.nov_talent_recruiting_target_audit_v1(target_id,event_type,previous_state,new_state,target_version,actor_employee_id,actor_role) values(v_target.target_id,'SUPERSEDED','APPROVED','SUPERSEDED',v_target.version,p_actor_employee_id,p_actor_role);
  return next v_target;
end $$;

revoke all on function public.nov_talent_create_recruiting_target_draft_v1(uuid,text,integer,text,text,date,date,text,integer,date,date,text) from public,anon,authenticated,service_role;
revoke all on function public.nov_talent_approve_recruiting_target_v1(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
revoke all on function public.nov_talent_supersede_recruiting_target_v1(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
revoke all on function public.nov_talent_recruiting_target_immutable_v1() from public,anon,authenticated,service_role;
revoke all on function public.nov_talent_recruiting_target_audit_immutable_v1() from public,anon,authenticated,service_role;
grant execute on function public.nov_talent_create_recruiting_target_draft_v1(uuid,text,integer,text,text,date,date,text,integer,date,date,text) to service_role;
grant execute on function public.nov_talent_approve_recruiting_target_v1(uuid,text,uuid,integer) to service_role;
grant execute on function public.nov_talent_supersede_recruiting_target_v1(uuid,text,uuid,integer) to service_role;
