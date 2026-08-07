-- NOV Talent Fair origin human review workflow.
-- Schema only: this migration intentionally creates no attribution candidates.

create table public.nov_talent_candidate_fair_attributions_v1 (
  attribution_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.nov_talent_candidates_v1(candidate_id) on delete restrict,
  fair_id uuid not null references public.nov_talent_fair_masters_v1(fair_id) on delete restrict,
  attribution_type text not null default 'ORIGIN' check (attribution_type in ('ORIGIN')),
  attribution_status text not null default 'PENDING' check (attribution_status in ('PENDING','CONFIRMED','REJECTED')),
  source_type text not null check (btrim(source_type) <> ''),
  source_reference text not null check (btrim(source_reference) <> '' and length(source_reference) <= 300),
  source_date date,
  evidence_reference text not null check (btrim(evidence_reference) <> '' and length(evidence_reference) <= 300),
  confidence_level text not null check (confidence_level in ('HIGH','MEDIUM','LOW')),
  confirmed_by uuid,
  confirmed_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  review_note text check (review_note is null or length(review_note) <= 1000),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  constraint nov_talent_fair_attribution_status_evidence_v1 check (
    (attribution_status = 'PENDING' and confirmed_by is null and confirmed_at is null and rejected_by is null and rejected_at is null)
    or (attribution_status = 'CONFIRMED' and confirmed_by is not null and confirmed_at is not null and rejected_by is null and rejected_at is null)
    or (attribution_status = 'REJECTED' and confirmed_by is null and confirmed_at is null and rejected_by is not null and rejected_at is not null)
  ),
  unique (candidate_id, fair_id, attribution_type)
);

create unique index nov_talent_one_confirmed_origin_per_candidate_v1
  on public.nov_talent_candidate_fair_attributions_v1 (candidate_id)
  where attribution_type = 'ORIGIN' and attribution_status = 'CONFIRMED';
create index nov_talent_fair_attribution_review_queue_v1
  on public.nov_talent_candidate_fair_attributions_v1 (attribution_status, created_at, attribution_id);

create table public.nov_talent_candidate_fair_attribution_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  attribution_id uuid not null references public.nov_talent_candidate_fair_attributions_v1(attribution_id) on delete restrict,
  previous_status text check (previous_status is null or previous_status in ('PENDING','CONFIRMED','REJECTED')),
  new_status text not null check (new_status in ('PENDING','CONFIRMED','REJECTED')),
  reviewer uuid not null,
  reviewer_role text not null check (btrim(reviewer_role) <> ''),
  reviewed_at timestamptz not null default now(),
  reason text not null check (btrim(reason) <> '' and length(reason) <= 500),
  evidence_reference text not null check (btrim(evidence_reference) <> '' and length(evidence_reference) <= 300),
  attribution_version integer not null check (attribution_version >= 1)
);

create index nov_talent_fair_attribution_audit_history_v1
  on public.nov_talent_candidate_fair_attribution_audit_v1 (attribution_id, reviewed_at, audit_id);

create or replace function nov_talent_internal.block_fair_attribution_audit_mutation_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '55000', message = 'fair_attribution_audit_append_only';
end $$;

create trigger block_nov_talent_fair_attribution_audit_mutation_v1
before update or delete on public.nov_talent_candidate_fair_attribution_audit_v1
for each row execute function nov_talent_internal.block_fair_attribution_audit_mutation_v1();

alter table public.nov_talent_candidate_fair_attributions_v1 enable row level security;
alter table public.nov_talent_candidate_fair_attributions_v1 force row level security;
alter table public.nov_talent_candidate_fair_attribution_audit_v1 enable row level security;
alter table public.nov_talent_candidate_fair_attribution_audit_v1 force row level security;

revoke all on public.nov_talent_candidate_fair_attributions_v1,
  public.nov_talent_candidate_fair_attribution_audit_v1 from public, anon, authenticated, service_role;
grant select, insert, update on public.nov_talent_candidate_fair_attributions_v1 to service_role;
grant select, insert on public.nov_talent_candidate_fair_attribution_audit_v1 to service_role;

create or replace function public.nov_talent_create_fair_attribution_candidate_v1(
  p_actor_employee_id uuid, p_actor_role text, p_candidate_id uuid, p_fair_id uuid,
  p_source_type text, p_source_reference text, p_source_date date,
  p_evidence_reference text, p_confidence_level text
) returns table(attribution_id uuid, attribution_version integer)
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_version integer;
begin
  if lower(p_actor_role) not in ('super_admin','backoffice','hr.admin') then raise exception 'forbidden'; end if;
  if p_actor_employee_id is null or nullif(btrim(p_source_type),'') is null
    or nullif(btrim(p_source_reference),'') is null or nullif(btrim(p_evidence_reference),'') is null
    or p_confidence_level not in ('HIGH','MEDIUM','LOW') then raise exception 'invalid request'; end if;
  if not exists (select 1 from public.nov_talent_candidates_v1 c where c.candidate_id=p_candidate_id and c.is_active) then raise exception 'candidate unavailable'; end if;
  if not exists (select 1 from public.nov_talent_fair_masters_v1 f where f.fair_id=p_fair_id and f.is_active) then raise exception 'fair unavailable'; end if;
  insert into public.nov_talent_candidate_fair_attributions_v1
    (candidate_id,fair_id,source_type,source_reference,source_date,evidence_reference,confidence_level,created_by,updated_by)
  values (p_candidate_id,p_fair_id,btrim(p_source_type),btrim(p_source_reference),p_source_date,
    btrim(p_evidence_reference),p_confidence_level,p_actor_employee_id,p_actor_employee_id)
  returning nov_talent_candidate_fair_attributions_v1.attribution_id,version into v_id,v_version;
  insert into public.nov_talent_candidate_fair_attribution_audit_v1
    (attribution_id,previous_status,new_status,reviewer,reviewer_role,reason,evidence_reference,attribution_version)
  values (v_id,null,'PENDING',p_actor_employee_id,lower(p_actor_role),'候補生成',btrim(p_evidence_reference),v_version);
  return query select v_id,v_version;
end $$;

create or replace function public.nov_talent_review_fair_attribution_v1(
  p_actor_employee_id uuid, p_actor_role text, p_attribution_id uuid,
  p_expected_version integer, p_decision text, p_reason text,
  p_evidence_reference text, p_review_note text
) returns table(attribution_id uuid, attribution_status text, attribution_version integer)
language plpgsql security definer set search_path = '' as $$
declare v_old public.nov_talent_candidate_fair_attributions_v1%rowtype; v_new public.nov_talent_candidate_fair_attributions_v1%rowtype;
begin
  if lower(p_actor_role) not in ('super_admin','backoffice','hr.admin') then raise exception 'forbidden'; end if;
  if p_actor_employee_id is null or p_decision not in ('PENDING','CONFIRMED','REJECTED')
    or nullif(btrim(p_reason),'') is null or nullif(btrim(p_evidence_reference),'') is null
    or p_expected_version < 1 then raise exception 'invalid request'; end if;
  select * into strict v_old from public.nov_talent_candidate_fair_attributions_v1 a
    where a.attribution_id=p_attribution_id for update;
  if v_old.version <> p_expected_version then raise exception using errcode='40001', message='fair_attribution_version_conflict'; end if;
  if p_decision='CONFIRMED' and exists (
    select 1 from public.nov_talent_candidate_fair_attributions_v1 a
    where a.candidate_id=v_old.candidate_id and a.attribution_type='ORIGIN'
      and a.attribution_status='CONFIRMED' and a.attribution_id<>v_old.attribution_id
  ) then raise exception using errcode='23505', message='candidate_confirmed_origin_conflict'; end if;
  update public.nov_talent_candidate_fair_attributions_v1 set
    attribution_status=p_decision,
    confirmed_by=case when p_decision='CONFIRMED' then p_actor_employee_id else null end,
    confirmed_at=case when p_decision='CONFIRMED' then now() else null end,
    rejected_by=case when p_decision='REJECTED' then p_actor_employee_id else null end,
    rejected_at=case when p_decision='REJECTED' then now() else null end,
    review_note=nullif(btrim(p_review_note),''), version=version+1, updated_at=now(), updated_by=p_actor_employee_id
  where nov_talent_candidate_fair_attributions_v1.attribution_id=p_attribution_id returning * into v_new;
  insert into public.nov_talent_candidate_fair_attribution_audit_v1
    (attribution_id,previous_status,new_status,reviewer,reviewer_role,reason,evidence_reference,attribution_version)
  values (v_new.attribution_id,v_old.attribution_status,v_new.attribution_status,p_actor_employee_id,
    lower(p_actor_role),btrim(p_reason),btrim(p_evidence_reference),v_new.version);
  return query select v_new.attribution_id,v_new.attribution_status,v_new.version;
end $$;

create or replace function public.nov_talent_list_fair_attribution_review_v1(p_actor_role text)
returns table(
  attribution_id uuid, candidate_id uuid, candidate_name text, school_name text, candidate_status text,
  fair_id uuid, fair_name text, fair_event_date date, original_trigger text,
  source_type text, source_reference text, source_date date, evidence_reference text,
  confidence_level text, attribution_status text, attribution_version integer, review_note text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if lower(p_actor_role) not in ('super_admin','backoffice','hr.admin') then raise exception 'forbidden'; end if;
  return query
    select a.attribution_id,c.candidate_id,c.student_name,c.school_name,c.current_status_code,
      f.fair_id,f.fair_name,f.event_date,c.acquisition_source,a.source_type,a.source_reference,a.source_date,
      a.evidence_reference,a.confidence_level,a.attribution_status,a.version,a.review_note
    from public.nov_talent_candidate_fair_attributions_v1 a
    join public.nov_talent_candidates_v1 c on c.candidate_id=a.candidate_id and c.is_active
    join public.nov_talent_fair_masters_v1 f on f.fair_id=a.fair_id and f.is_active
    order by case a.attribution_status when 'PENDING' then 0 when 'CONFIRMED' then 1 else 2 end,
      a.created_at,a.attribution_id;
end $$;

create or replace function public.nov_talent_list_fair_attribution_history_v1(p_actor_role text,p_attribution_id uuid)
returns table(previous_status text,new_status text,reviewer_role text,reviewed_at timestamptz,reason text,evidence_reference text,attribution_version integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if lower(p_actor_role) not in ('super_admin','backoffice','hr.admin') then raise exception 'forbidden'; end if;
  return query select h.previous_status,h.new_status,h.reviewer_role,h.reviewed_at,h.reason,h.evidence_reference,h.attribution_version
    from public.nov_talent_candidate_fair_attribution_audit_v1 h
    where h.attribution_id=p_attribution_id order by h.reviewed_at,h.audit_id;
end $$;

revoke all on function public.nov_talent_create_fair_attribution_candidate_v1(uuid,text,uuid,uuid,text,text,date,text,text) from public,anon,authenticated;
revoke all on function public.nov_talent_review_fair_attribution_v1(uuid,text,uuid,integer,text,text,text,text) from public,anon,authenticated;
revoke all on function public.nov_talent_list_fair_attribution_review_v1(text) from public,anon,authenticated;
revoke all on function public.nov_talent_list_fair_attribution_history_v1(text,uuid) from public,anon,authenticated;
grant execute on function public.nov_talent_create_fair_attribution_candidate_v1(uuid,text,uuid,uuid,text,text,date,text,text) to service_role;
grant execute on function public.nov_talent_review_fair_attribution_v1(uuid,text,uuid,integer,text,text,text,text) to service_role;
grant execute on function public.nov_talent_list_fair_attribution_review_v1(text) to service_role;
grant execute on function public.nov_talent_list_fair_attribution_history_v1(text,uuid) to service_role;

comment on table public.nov_talent_candidate_fair_attributions_v1 is 'Staging-only Candidate to Fair origin review canonical table. No automatic confirmation.';
comment on table public.nov_talent_candidate_fair_attribution_audit_v1 is 'Append-only human decision ledger for Fair origin reviews.';
