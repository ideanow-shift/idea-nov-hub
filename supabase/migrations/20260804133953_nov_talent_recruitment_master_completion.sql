-- NOV Talent recruitment masters. Staging-only; browsers never receive table grants.
create table public.nov_talent_school_masters_v1 (
  school_id uuid primary key default gen_random_uuid(),
  school_name text not null check (btrim(school_name) <> ''),
  normalized_name text not null unique check (btrim(normalized_name) <> ''),
  faculty_name text,
  assigned_to text,
  version integer not null default 1 check (version >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  inactive_reason text
);

create table public.nov_talent_fair_masters_v1 (
  fair_id uuid primary key default gen_random_uuid(),
  fair_name text not null check (btrim(fair_name) <> ''),
  event_date date not null,
  participation_fee integer not null default 0 check (participation_fee >= 0),
  venue text,
  assigned_to text,
  participant_count integer not null default 0 check (participant_count >= 0),
  contact_count integer not null default 0 check (contact_count >= 0),
  line_registration_count integer not null default 0 check (line_registration_count >= 0),
  salon_tour_count integer not null default 0 check (salon_tour_count >= 0),
  interview_count integer not null default 0 check (interview_count >= 0),
  offer_count integer not null default 0 check (offer_count >= 0),
  hire_count integer not null default 0 check (hire_count >= 0),
  version integer not null default 1 check (version >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  inactive_reason text,
  unique (fair_name, event_date)
);

alter table public.nov_talent_candidates_v1
  add column school_id uuid references public.nov_talent_school_masters_v1(school_id) on delete restrict,
  add column fair_id uuid references public.nov_talent_fair_masters_v1(fair_id) on delete restrict;

create table public.nov_talent_recruitment_master_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('SCHOOL','FAIR')),
  entity_id uuid not null,
  action text not null check (action in ('CREATE','UPDATE','DEACTIVATE','RESTORE')),
  changed_fields text[] not null default '{}',
  entity_version integer not null,
  actor_employee_id uuid not null,
  actor_role text not null,
  reason text not null check (btrim(reason) <> ''),
  occurred_at timestamptz not null default now()
);

alter table public.nov_talent_school_masters_v1 enable row level security;
alter table public.nov_talent_fair_masters_v1 enable row level security;
alter table public.nov_talent_recruitment_master_audit_v1 enable row level security;
revoke all on public.nov_talent_school_masters_v1, public.nov_talent_fair_masters_v1,
  public.nov_talent_recruitment_master_audit_v1 from public, anon, authenticated, service_role;
grant select, insert, update on public.nov_talent_school_masters_v1, public.nov_talent_fair_masters_v1 to service_role;
grant select, insert on public.nov_talent_recruitment_master_audit_v1 to service_role;

-- Deterministic initial School Master from the active Candidate dataset. No guessed values.
insert into public.nov_talent_school_masters_v1
  (school_name, normalized_name, created_by, updated_by)
select min(btrim(school_name)), lower(regexp_replace(btrim(school_name), '[[:space:]　]+', '', 'g')),
  '00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid
from public.nov_talent_candidates_v1
where is_active and nullif(btrim(school_name), '') is not null
group by lower(regexp_replace(btrim(school_name), '[[:space:]　]+', '', 'g'))
on conflict (normalized_name) do nothing;

update public.nov_talent_candidates_v1 c
set school_id = s.school_id
from public.nov_talent_school_masters_v1 s
where c.school_id is null
  and s.normalized_name = lower(regexp_replace(btrim(c.school_name), '[[:space:]　]+', '', 'g'));

create or replace function public.nov_talent_mutate_recruitment_master_v1(
  p_actor_employee_id uuid, p_actor_role text, p_reason text, p_entity_type text,
  p_operation text, p_entity_id uuid, p_expected_version integer, p_payload jsonb
) returns table(entity_id uuid, entity_version integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_version integer; v_before jsonb; v_after jsonb; v_changed text[];
begin
  if lower(p_actor_role) not in ('super_admin','backoffice','hr.admin','hr.staff') then raise exception 'forbidden'; end if;
  if p_entity_type not in ('SCHOOL','FAIR') or p_operation not in ('CREATE','UPDATE','DEACTIVATE','RESTORE')
    or nullif(btrim(p_reason),'') is null then raise exception 'invalid request'; end if;
  if p_entity_type='SCHOOL' then
    if p_operation='CREATE' then
      insert into public.nov_talent_school_masters_v1
        (school_name,normalized_name,faculty_name,assigned_to,created_by,updated_by)
      values (btrim(p_payload->>'schoolName'),lower(regexp_replace(btrim(p_payload->>'schoolName'),'[[:space:]　]+','','g')),
        nullif(btrim(p_payload->>'facultyName'),''),nullif(btrim(p_payload->>'assignedTo'),''),p_actor_employee_id,p_actor_employee_id)
      returning school_id,version,to_jsonb(nov_talent_school_masters_v1.*) into v_id,v_version,v_after;
    else
      select to_jsonb(s.*) into strict v_before from public.nov_talent_school_masters_v1 s where s.school_id=p_entity_id for update;
      if (v_before->>'version')::integer <> p_expected_version then raise exception 'version conflict'; end if;
      update public.nov_talent_school_masters_v1 set
        school_name=case when p_operation='UPDATE' then btrim(p_payload->>'schoolName') else school_name end,
        normalized_name=case when p_operation='UPDATE' then lower(regexp_replace(btrim(p_payload->>'schoolName'),'[[:space:]　]+','','g')) else normalized_name end,
        faculty_name=case when p_operation='UPDATE' then nullif(btrim(p_payload->>'facultyName'),'') else faculty_name end,
        assigned_to=case when p_operation='UPDATE' then nullif(btrim(p_payload->>'assignedTo'),'') else assigned_to end,
        is_active=case when p_operation='DEACTIVATE' then false when p_operation='RESTORE' then true else is_active end,
        inactive_reason=case when p_operation='DEACTIVATE' then p_reason when p_operation='RESTORE' then null else inactive_reason end,
        version=version+1,updated_at=now(),updated_by=p_actor_employee_id where school_id=p_entity_id
      returning school_id,version,to_jsonb(nov_talent_school_masters_v1.*) into v_id,v_version,v_after;
    end if;
  else
    if p_operation='CREATE' then
      insert into public.nov_talent_fair_masters_v1
        (fair_name,event_date,participation_fee,venue,assigned_to,participant_count,contact_count,line_registration_count,
         salon_tour_count,interview_count,offer_count,hire_count,created_by,updated_by)
      values (btrim(p_payload->>'fairName'),(p_payload->>'eventDate')::date,coalesce((p_payload->>'participationFee')::integer,0),
        nullif(btrim(p_payload->>'venue'),''),nullif(btrim(p_payload->>'assignedTo'),''),coalesce((p_payload->>'participantCount')::integer,0),
        coalesce((p_payload->>'contactCount')::integer,0),coalesce((p_payload->>'lineRegistrationCount')::integer,0),
        coalesce((p_payload->>'salonTourCount')::integer,0),coalesce((p_payload->>'interviewCount')::integer,0),
        coalesce((p_payload->>'offerCount')::integer,0),coalesce((p_payload->>'hireCount')::integer,0),p_actor_employee_id,p_actor_employee_id)
      returning fair_id,version,to_jsonb(nov_talent_fair_masters_v1.*) into v_id,v_version,v_after;
    else
      select to_jsonb(f.*) into strict v_before from public.nov_talent_fair_masters_v1 f where f.fair_id=p_entity_id for update;
      if (v_before->>'version')::integer <> p_expected_version then raise exception 'version conflict'; end if;
      update public.nov_talent_fair_masters_v1 set
        fair_name=case when p_operation='UPDATE' then btrim(p_payload->>'fairName') else fair_name end,
        event_date=case when p_operation='UPDATE' then (p_payload->>'eventDate')::date else event_date end,
        participation_fee=case when p_operation='UPDATE' then coalesce((p_payload->>'participationFee')::integer,0) else participation_fee end,
        venue=case when p_operation='UPDATE' then nullif(btrim(p_payload->>'venue'),'') else venue end,
        assigned_to=case when p_operation='UPDATE' then nullif(btrim(p_payload->>'assignedTo'),'') else assigned_to end,
        participant_count=case when p_operation='UPDATE' then coalesce((p_payload->>'participantCount')::integer,0) else participant_count end,
        contact_count=case when p_operation='UPDATE' then coalesce((p_payload->>'contactCount')::integer,0) else contact_count end,
        line_registration_count=case when p_operation='UPDATE' then coalesce((p_payload->>'lineRegistrationCount')::integer,0) else line_registration_count end,
        salon_tour_count=case when p_operation='UPDATE' then coalesce((p_payload->>'salonTourCount')::integer,0) else salon_tour_count end,
        interview_count=case when p_operation='UPDATE' then coalesce((p_payload->>'interviewCount')::integer,0) else interview_count end,
        offer_count=case when p_operation='UPDATE' then coalesce((p_payload->>'offerCount')::integer,0) else offer_count end,
        hire_count=case when p_operation='UPDATE' then coalesce((p_payload->>'hireCount')::integer,0) else hire_count end,
        is_active=case when p_operation='DEACTIVATE' then false when p_operation='RESTORE' then true else is_active end,
        inactive_reason=case when p_operation='DEACTIVATE' then p_reason when p_operation='RESTORE' then null else inactive_reason end,
        version=version+1,updated_at=now(),updated_by=p_actor_employee_id where fair_id=p_entity_id
      returning fair_id,version,to_jsonb(nov_talent_fair_masters_v1.*) into v_id,v_version,v_after;
    end if;
  end if;
  v_changed := case when p_operation='CREATE' then array['created'] when p_operation in ('DEACTIVATE','RESTORE') then array['is_active'] else array['master_fields'] end;
  insert into public.nov_talent_recruitment_master_audit_v1
    (entity_type,entity_id,action,changed_fields,entity_version,actor_employee_id,actor_role,reason)
  values (p_entity_type,v_id,p_operation,v_changed,v_version,p_actor_employee_id,lower(p_actor_role),p_reason);
  return query select v_id,v_version;
end $$;

revoke all on function public.nov_talent_mutate_recruitment_master_v1(uuid,text,text,text,text,uuid,integer,jsonb)
  from public, anon, authenticated;
grant execute on function public.nov_talent_mutate_recruitment_master_v1(uuid,text,text,text,text,uuid,integer,jsonb) to service_role;

create or replace function public.nov_talent_set_candidate_master_links_v1(
  p_actor_employee_id uuid, p_actor_role text, p_reason text, p_candidate_id uuid,
  p_expected_version integer, p_school_id uuid, p_fair_id uuid
) returns table(candidate_id uuid, candidate_version integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old public.nov_talent_candidates_v1%rowtype; v_new public.nov_talent_candidates_v1%rowtype;
begin
  if lower(p_actor_role) not in ('super_admin','backoffice','hr.admin','hr.staff') or nullif(btrim(p_reason),'') is null then raise exception 'forbidden'; end if;
  select * into strict v_old from public.nov_talent_candidates_v1 c where c.candidate_id=p_candidate_id and c.is_active for update;
  if v_old.version <> p_expected_version then raise exception using errcode='40001', message='candidate_version_conflict'; end if;
  if p_school_id is not null and not exists (select 1 from public.nov_talent_school_masters_v1 where school_id=p_school_id and is_active) then raise exception 'invalid school'; end if;
  if p_fair_id is not null and not exists (select 1 from public.nov_talent_fair_masters_v1 where fair_id=p_fair_id and is_active) then raise exception 'invalid fair'; end if;
  update public.nov_talent_candidates_v1 set school_id=p_school_id, fair_id=p_fair_id, version=version+1,
    updated_at=now(), updated_by_employee_id=p_actor_employee_id where nov_talent_candidates_v1.candidate_id=p_candidate_id returning * into v_new;
  insert into public.nov_talent_candidate_audit_log_v1
    (candidate_id,action,changed_fields,before_values,after_values,actor_employee_id,actor_role,reason,candidate_version)
  values (p_candidate_id,'UPDATE',array['schoolId','fairId'],jsonb_build_object('schoolId',v_old.school_id,'fairId',v_old.fair_id),
    jsonb_build_object('schoolId',v_new.school_id,'fairId',v_new.fair_id),p_actor_employee_id,lower(p_actor_role),p_reason,v_new.version);
  return query select p_candidate_id,v_new.version;
end $$;
revoke all on function public.nov_talent_set_candidate_master_links_v1(uuid,text,text,uuid,integer,uuid,uuid) from public,anon,authenticated;
grant execute on function public.nov_talent_set_candidate_master_links_v1(uuid,text,text,uuid,integer,uuid,uuid) to service_role;

comment on table public.nov_talent_school_masters_v1 is 'Staging-only School Master for NOV Talent. Server-side API access only.';
comment on table public.nov_talent_fair_masters_v1 is 'Staging-only Fair Master for NOV Talent. Rates and cost are derived from stored counts.';
comment on table public.nov_talent_recruitment_master_audit_v1 is 'Append-only audit for School and Fair Master changes.';
