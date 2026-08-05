-- NOV Talent Fair Master schema completion.
-- Staging-first migration. Existing rows are never rewritten: an existing zero
-- remains zero because its historical meaning cannot be inferred safely.

alter table public.nov_talent_fair_masters_v1
  alter column participation_fee drop default,
  alter column participation_fee drop not null,
  alter column participant_count drop default,
  alter column participant_count drop not null,
  alter column contact_count drop default,
  alter column contact_count drop not null,
  alter column line_registration_count drop default,
  alter column line_registration_count drop not null,
  alter column salon_tour_count drop default,
  alter column salon_tour_count drop not null,
  alter column interview_count drop default,
  alter column interview_count drop not null,
  alter column offer_count drop default,
  alter column offer_count drop not null,
  alter column hire_count drop default,
  alter column hire_count drop not null,
  add column organizer_name text,
  add column event_format text,
  add column expected_contacts integer check (expected_contacts >= 0),
  add column total_attendance integer check (total_attendance >= 0),
  add column participating_salons integer check (participating_salons >= 0),
  add column note text;

comment on column public.nov_talent_fair_masters_v1.participation_fee is
  'Participation fee in JPY. NULL means unregistered or unknown; zero means confirmed zero.';
comment on column public.nov_talent_fair_masters_v1.participant_count is
  'Participant count. NULL means unregistered or unknown; zero means confirmed zero.';
comment on column public.nov_talent_fair_masters_v1.contact_count is
  'Contact count. NULL means unregistered or unknown; zero means confirmed zero.';
comment on column public.nov_talent_fair_masters_v1.line_registration_count is
  'LINE registration count. NULL means unregistered or unknown; zero means confirmed zero.';
comment on column public.nov_talent_fair_masters_v1.salon_tour_count is
  'Salon tour count. NULL means unregistered or unknown; zero means confirmed zero.';
comment on column public.nov_talent_fair_masters_v1.interview_count is
  'Interview count derived only from safely linked selection history. NULL means unavailable.';
comment on column public.nov_talent_fair_masters_v1.offer_count is
  'Offer count derived only from safely linked selection history. NULL means unavailable.';
comment on column public.nov_talent_fair_masters_v1.hire_count is
  'Hire count derived only from safely linked selection history. NULL means unavailable.';

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
         salon_tour_count,interview_count,offer_count,hire_count,organizer_name,event_format,expected_contacts,
         total_attendance,participating_salons,note,created_by,updated_by)
      values (btrim(p_payload->>'fairName'),(p_payload->>'eventDate')::date,
        nullif(btrim(p_payload->>'participationFee'),'')::integer,
        nullif(btrim(p_payload->>'venue'),''),nullif(btrim(p_payload->>'assignedTo'),''),
        nullif(btrim(p_payload->>'participantCount'),'')::integer,
        nullif(btrim(p_payload->>'contactCount'),'')::integer,
        nullif(btrim(p_payload->>'lineRegistrationCount'),'')::integer,
        nullif(btrim(p_payload->>'salonTourCount'),'')::integer,
        nullif(btrim(p_payload->>'interviewCount'),'')::integer,
        nullif(btrim(p_payload->>'offerCount'),'')::integer,
        nullif(btrim(p_payload->>'hireCount'),'')::integer,
        nullif(btrim(p_payload->>'organizerName'),''),nullif(btrim(p_payload->>'eventFormat'),''),
        nullif(btrim(p_payload->>'expectedContacts'),'')::integer,
        nullif(btrim(p_payload->>'totalAttendance'),'')::integer,
        nullif(btrim(p_payload->>'participatingSalons'),'')::integer,
        nullif(btrim(p_payload->>'note'),''),p_actor_employee_id,p_actor_employee_id)
      returning fair_id,version,to_jsonb(nov_talent_fair_masters_v1.*) into v_id,v_version,v_after;
    else
      select to_jsonb(f.*) into strict v_before from public.nov_talent_fair_masters_v1 f where f.fair_id=p_entity_id for update;
      if (v_before->>'version')::integer <> p_expected_version then raise exception 'version conflict'; end if;
      update public.nov_talent_fair_masters_v1 set
        fair_name=case when p_operation='UPDATE' and p_payload ? 'fairName' then btrim(p_payload->>'fairName') else fair_name end,
        event_date=case when p_operation='UPDATE' and p_payload ? 'eventDate' then (p_payload->>'eventDate')::date else event_date end,
        participation_fee=case when p_operation='UPDATE' and p_payload ? 'participationFee' then nullif(btrim(p_payload->>'participationFee'),'')::integer else participation_fee end,
        venue=case when p_operation='UPDATE' and p_payload ? 'venue' then nullif(btrim(p_payload->>'venue'),'') else venue end,
        assigned_to=case when p_operation='UPDATE' and p_payload ? 'assignedTo' then nullif(btrim(p_payload->>'assignedTo'),'') else assigned_to end,
        participant_count=case when p_operation='UPDATE' and p_payload ? 'participantCount' then nullif(btrim(p_payload->>'participantCount'),'')::integer else participant_count end,
        contact_count=case when p_operation='UPDATE' and p_payload ? 'contactCount' then nullif(btrim(p_payload->>'contactCount'),'')::integer else contact_count end,
        line_registration_count=case when p_operation='UPDATE' and p_payload ? 'lineRegistrationCount' then nullif(btrim(p_payload->>'lineRegistrationCount'),'')::integer else line_registration_count end,
        salon_tour_count=case when p_operation='UPDATE' and p_payload ? 'salonTourCount' then nullif(btrim(p_payload->>'salonTourCount'),'')::integer else salon_tour_count end,
        interview_count=case when p_operation='UPDATE' and p_payload ? 'interviewCount' then nullif(btrim(p_payload->>'interviewCount'),'')::integer else interview_count end,
        offer_count=case when p_operation='UPDATE' and p_payload ? 'offerCount' then nullif(btrim(p_payload->>'offerCount'),'')::integer else offer_count end,
        hire_count=case when p_operation='UPDATE' and p_payload ? 'hireCount' then nullif(btrim(p_payload->>'hireCount'),'')::integer else hire_count end,
        organizer_name=case when p_operation='UPDATE' and p_payload ? 'organizerName' then nullif(btrim(p_payload->>'organizerName'),'') else organizer_name end,
        event_format=case when p_operation='UPDATE' and p_payload ? 'eventFormat' then nullif(btrim(p_payload->>'eventFormat'),'') else event_format end,
        expected_contacts=case when p_operation='UPDATE' and p_payload ? 'expectedContacts' then nullif(btrim(p_payload->>'expectedContacts'),'')::integer else expected_contacts end,
        total_attendance=case when p_operation='UPDATE' and p_payload ? 'totalAttendance' then nullif(btrim(p_payload->>'totalAttendance'),'')::integer else total_attendance end,
        participating_salons=case when p_operation='UPDATE' and p_payload ? 'participatingSalons' then nullif(btrim(p_payload->>'participatingSalons'),'')::integer else participating_salons end,
        note=case when p_operation='UPDATE' and p_payload ? 'note' then nullif(btrim(p_payload->>'note'),'') else note end,
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

comment on table public.nov_talent_fair_masters_v1 is
  'Staging-only Fair Master for NOV Talent. Raw values distinguish unknown (NULL) from confirmed zero; rates and costs are derived.';
