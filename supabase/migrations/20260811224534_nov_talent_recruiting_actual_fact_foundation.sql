-- SOURCE-ONLY MIGRATION CANDIDATE. DO NOT APPLY WITHOUT A SEPARATE OWNER GATE.
-- Additive foundations for official recruiting actuals. No legacy business row is changed.
begin;

create table public.nov_talent_recruiting_engagement_facts_v1 (
  engagement_fact_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.nov_talent_candidates_v1(candidate_id) on delete restrict,
  engagement_type text not null check (engagement_type in ('CONTACT','SALON_VISIT')),
  occurred_at timestamptz not null,
  store_id uuid,
  engagement_status text not null check (engagement_status in ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
  source_type text not null check (char_length(btrim(source_type)) between 1 and 80),
  source_reference text not null check (char_length(btrim(source_reference)) between 1 and 200),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  actor_employee_id uuid not null,
  correction_of_fact_id uuid unique references public.nov_talent_recruiting_engagement_facts_v1(engagement_fact_id) on delete restrict,
  correction_reason text,
  created_at timestamptz not null default statement_timestamp(),
  constraint nov_talent_engagement_shape_v1 check (
    (engagement_type='CONTACT' and engagement_status in ('COMPLETED','CANCELLED') and store_id is null)
    or (engagement_type='SALON_VISIT' and store_id is not null)
  ),
  constraint nov_talent_engagement_correction_shape_v1 check (
    (correction_of_fact_id is null and correction_reason is null)
    or (correction_of_fact_id is not null and char_length(btrim(correction_reason)) between 1 and 500)
  ),
  unique (source_type, source_reference, source_fingerprint)
);
create index nov_talent_engagement_actual_v1 on public.nov_talent_recruiting_engagement_facts_v1
  (engagement_type, engagement_status, occurred_at, candidate_id);

create table public.nov_talent_recruiting_engagement_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  engagement_fact_id uuid not null references public.nov_talent_recruiting_engagement_facts_v1(engagement_fact_id) on delete restrict,
  event_type text not null check (event_type in ('FACT_APPENDED','CORRECTION_APPENDED','CANCELLATION_APPENDED')),
  actor_employee_id uuid not null,
  actor_role text not null check (actor_role in ('super_admin','hr.admin','backoffice')),
  occurred_at timestamptz not null default statement_timestamp()
);

create table public.nov_talent_selection_coverage_releases_v1 (
  coverage_release_id uuid primary key default gen_random_uuid(),
  recruiting_track text not null check (recruiting_track in ('NEW_GRAD','MID_CAREER')),
  graduation_year integer check (graduation_year between 2020 and 2100),
  recruiting_period_start date not null,
  recruiting_period_end date not null,
  selection_code text not null check (selection_code in ('APPLICATION_RECEIVED','OFFERED','OFFER_ACCEPTED')),
  coverage_state text not null check (coverage_state in ('DRAFT','REVIEWED','COMPLETE','SUPERSEDED')),
  version integer not null check (version >= 1),
  source_boundary text not null check (char_length(btrim(source_boundary)) between 1 and 1000),
  source_row_count integer not null check (source_row_count >= 0),
  source_digest text not null check (source_digest ~ '^[0-9a-f]{64}$'),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  supersedes_release_id uuid references public.nov_talent_selection_coverage_releases_v1(coverage_release_id) on delete restrict,
  superseded_by_release_id uuid references public.nov_talent_selection_coverage_releases_v1(coverage_release_id) on delete restrict,
  superseded_by uuid,
  superseded_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint nov_talent_selection_coverage_track_shape_v1 check (
    (recruiting_track='NEW_GRAD' and graduation_year is not null)
    or (recruiting_track='MID_CAREER' and graduation_year is null)
  ),
  constraint nov_talent_selection_coverage_period_v1 check (recruiting_period_start <= recruiting_period_end),
  constraint nov_talent_selection_coverage_state_shape_v1 check (
    (coverage_state='DRAFT' and reviewed_by is null and reviewed_at is null and approved_by is null and approved_at is null)
    or (coverage_state='REVIEWED' and reviewed_by is not null and reviewed_at is not null and approved_by is null and approved_at is null)
    or (coverage_state='COMPLETE' and reviewed_by is not null and reviewed_at is not null and approved_by is not null and approved_at is not null and superseded_by is null and superseded_at is null)
    or (coverage_state='SUPERSEDED' and reviewed_by is not null and reviewed_at is not null and approved_by is not null and approved_at is not null and superseded_by_release_id is not null and superseded_by is not null and superseded_at is not null)
  ),
  unique nulls not distinct (recruiting_track, graduation_year, recruiting_period_start, recruiting_period_end, selection_code, version)
);
create unique index nov_talent_selection_coverage_one_complete_v1
  on public.nov_talent_selection_coverage_releases_v1
  (recruiting_track, coalesce(graduation_year,0), recruiting_period_start, recruiting_period_end, selection_code)
  where coverage_state='COMPLETE';

create table public.nov_talent_selection_coverage_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  coverage_release_id uuid not null references public.nov_talent_selection_coverage_releases_v1(coverage_release_id) on delete restrict,
  previous_state text,
  new_state text not null check (new_state in ('DRAFT','REVIEWED','COMPLETE','SUPERSEDED')),
  actor_employee_id uuid not null,
  actor_role text not null check (actor_role in ('super_admin','hr.admin','backoffice')),
  occurred_at timestamptz not null default statement_timestamp()
);

create table public.nov_talent_recruiting_spend_facts_v1 (
  spend_fact_id uuid primary key default gen_random_uuid(),
  recruiting_track text not null check (recruiting_track in ('NEW_GRAD','MID_CAREER')),
  graduation_year integer check (graduation_year between 2020 and 2100),
  recruiting_period_start date not null,
  recruiting_period_end date not null,
  company_id uuid not null,
  cost_category text not null check (cost_category in ('JOB_FAIR','JOB_MEDIA','SCHOOL_RELATED','RECRUITING_ADVERTISING','RECRUITING_LABOR','OTHER')),
  channel_code text check (channel_code is null or channel_code in ('JOB_FAIR','SCHOOL_GUIDANCE','SCHOOL_VISIT','PAID_JOB_MEDIA','FREE_JOB_MEDIA','SNS','OWNED_WEB','REFERRAL','HELLO_WORK','REHIRE','DEALER_REFERRAL','OTHER')),
  amount bigint not null check (amount >= 0),
  currency text not null check (currency='JPY'),
  occurred_at date not null,
  spend_status text not null check (spend_status in ('PROVISIONAL','CONFIRMED','VOIDED')),
  source_type text not null check (char_length(btrim(source_type)) between 1 and 80),
  source_reference text not null check (char_length(btrim(source_reference)) between 1 and 200),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  version integer not null default 1 check (version >= 1),
  actor_employee_id uuid not null,
  correction_of_fact_id uuid unique references public.nov_talent_recruiting_spend_facts_v1(spend_fact_id) on delete restrict,
  correction_reason text,
  created_at timestamptz not null default statement_timestamp(),
  constraint nov_talent_spend_track_shape_v1 check (
    (recruiting_track='NEW_GRAD' and graduation_year is not null)
    or (recruiting_track='MID_CAREER' and graduation_year is null)
  ),
  constraint nov_talent_spend_period_v1 check (recruiting_period_start <= recruiting_period_end and occurred_at between recruiting_period_start and recruiting_period_end),
  constraint nov_talent_spend_correction_shape_v1 check (
    (correction_of_fact_id is null and correction_reason is null)
    or (correction_of_fact_id is not null and char_length(btrim(correction_reason)) between 1 and 500)
  ),
  unique (source_type, source_reference, source_fingerprint)
);
create index nov_talent_spend_actual_v1 on public.nov_talent_recruiting_spend_facts_v1
  (recruiting_track, coalesce(graduation_year,0), recruiting_period_start, recruiting_period_end, spend_status, occurred_at);

create table public.nov_talent_recruiting_spend_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  spend_fact_id uuid not null references public.nov_talent_recruiting_spend_facts_v1(spend_fact_id) on delete restrict,
  event_type text not null check (event_type in ('FACT_APPENDED','CORRECTION_APPENDED','VOID_APPENDED')),
  actor_employee_id uuid not null,
  actor_role text not null check (actor_role in ('super_admin','hr.admin','backoffice')),
  occurred_at timestamptz not null default statement_timestamp()
);

create function public.nov_talent_actual_fact_append_only_v1() returns trigger
language plpgsql set search_path='' as $$ begin
  raise exception using errcode='55000', message='RECRUITING_ACTUAL_FACT_APPEND_ONLY';
end $$;

create trigger nov_talent_engagement_fact_append_only_v1 before update or delete on public.nov_talent_recruiting_engagement_facts_v1 for each row execute function public.nov_talent_actual_fact_append_only_v1();
create trigger nov_talent_engagement_audit_append_only_v1 before update or delete on public.nov_talent_recruiting_engagement_audit_v1 for each row execute function public.nov_talent_actual_fact_append_only_v1();
create function public.nov_talent_selection_coverage_immutable_v1() returns trigger language plpgsql set search_path='' as $$ begin
  if tg_op='DELETE' then raise exception using errcode='55000',message='SELECTION_COVERAGE_DELETE_PROHIBITED'; end if;
  if old.coverage_state='COMPLETE' and new.coverage_state='SUPERSEDED'
    and (to_jsonb(new)-array['coverage_state','superseded_by_release_id','superseded_by','superseded_at'])
      = (to_jsonb(old)-array['coverage_state','superseded_by_release_id','superseded_by','superseded_at']) then return new; end if;
  raise exception using errcode='55000',message='SELECTION_COVERAGE_RELEASE_IMMUTABLE';
end $$;
create trigger nov_talent_selection_coverage_immutable_v1 before update or delete on public.nov_talent_selection_coverage_releases_v1 for each row execute function public.nov_talent_selection_coverage_immutable_v1();
create trigger nov_talent_selection_coverage_audit_append_only_v1 before update or delete on public.nov_talent_selection_coverage_audit_v1 for each row execute function public.nov_talent_actual_fact_append_only_v1();
create trigger nov_talent_spend_fact_append_only_v1 before update or delete on public.nov_talent_recruiting_spend_facts_v1 for each row execute function public.nov_talent_actual_fact_append_only_v1();
create trigger nov_talent_spend_audit_append_only_v1 before update or delete on public.nov_talent_recruiting_spend_audit_v1 for each row execute function public.nov_talent_actual_fact_append_only_v1();

create function public.nov_talent_append_recruiting_engagement_fact_v1(
  p_actor_employee_id uuid,p_actor_role text,p_candidate_id uuid,p_engagement_type text,p_occurred_at timestamptz,p_store_id uuid,p_status text,
  p_source_type text,p_source_reference text,p_source_fingerprint text,p_correction_of uuid default null,p_correction_reason text default null
) returns setof public.nov_talent_recruiting_engagement_facts_v1 language plpgsql security definer set search_path='' as $$
declare v public.nov_talent_recruiting_engagement_facts_v1;
begin
  if p_actor_employee_id is null or p_actor_role not in ('super_admin','hr.admin','backoffice') then raise exception using errcode='42501',message='RECRUITING_ACTUAL_ROLE_FORBIDDEN'; end if;
  if not exists(select 1 from public.nov_talent_candidates_v1 where candidate_id=p_candidate_id) then raise exception using errcode='23503',message='RECRUITING_ACTUAL_CANDIDATE_NOT_FOUND'; end if;
  if p_correction_of is not null then perform 1 from public.nov_talent_recruiting_engagement_facts_v1 where engagement_fact_id=p_correction_of for update; if not found then raise exception using errcode='P0002',message='RECRUITING_ENGAGEMENT_ORIGINAL_NOT_FOUND'; end if; end if;
  insert into public.nov_talent_recruiting_engagement_facts_v1(candidate_id,engagement_type,occurred_at,store_id,engagement_status,source_type,source_reference,source_fingerprint,actor_employee_id,correction_of_fact_id,correction_reason)
  values(p_candidate_id,p_engagement_type,p_occurred_at,p_store_id,p_status,btrim(p_source_type),btrim(p_source_reference),p_source_fingerprint,p_actor_employee_id,p_correction_of,case when p_correction_reason is null then null else btrim(p_correction_reason) end) returning * into v;
  insert into public.nov_talent_recruiting_engagement_audit_v1(engagement_fact_id,event_type,actor_employee_id,actor_role)
  values(v.engagement_fact_id,case when p_correction_of is null then 'FACT_APPENDED' when p_status='CANCELLED' then 'CANCELLATION_APPENDED' else 'CORRECTION_APPENDED' end,p_actor_employee_id,p_actor_role);
  return next v;
end $$;

create function public.nov_talent_append_recruiting_spend_fact_v1(
  p_actor_employee_id uuid,p_actor_role text,p_recruiting_track text,p_graduation_year integer,p_period_start date,p_period_end date,p_company_id uuid,
  p_cost_category text,p_channel_code text,p_amount bigint,p_occurred_at date,p_status text,p_source_type text,p_source_reference text,p_source_fingerprint text,
  p_correction_of uuid default null,p_correction_reason text default null
) returns setof public.nov_talent_recruiting_spend_facts_v1 language plpgsql security definer set search_path='' as $$
declare v public.nov_talent_recruiting_spend_facts_v1; n integer;
begin
  if p_actor_employee_id is null or p_actor_role not in ('super_admin','hr.admin','backoffice') then raise exception using errcode='42501',message='RECRUITING_ACTUAL_ROLE_FORBIDDEN'; end if;
  if p_correction_of is not null then select version+1 into n from public.nov_talent_recruiting_spend_facts_v1 where spend_fact_id=p_correction_of for update; if not found then raise exception using errcode='P0002',message='RECRUITING_SPEND_ORIGINAL_NOT_FOUND'; end if; else n:=1; end if;
  insert into public.nov_talent_recruiting_spend_facts_v1(recruiting_track,graduation_year,recruiting_period_start,recruiting_period_end,company_id,cost_category,channel_code,amount,currency,occurred_at,spend_status,source_type,source_reference,source_fingerprint,version,actor_employee_id,correction_of_fact_id,correction_reason)
  values(p_recruiting_track,p_graduation_year,p_period_start,p_period_end,p_company_id,p_cost_category,p_channel_code,p_amount,'JPY',p_occurred_at,p_status,btrim(p_source_type),btrim(p_source_reference),p_source_fingerprint,n,p_actor_employee_id,p_correction_of,case when p_correction_reason is null then null else btrim(p_correction_reason) end) returning * into v;
  insert into public.nov_talent_recruiting_spend_audit_v1(spend_fact_id,event_type,actor_employee_id,actor_role)
  values(v.spend_fact_id,case when p_correction_of is null then 'FACT_APPENDED' when p_status='VOIDED' then 'VOID_APPENDED' else 'CORRECTION_APPENDED' end,p_actor_employee_id,p_actor_role);
  return next v;
end $$;

alter table public.nov_talent_recruiting_engagement_facts_v1 enable row level security; alter table public.nov_talent_recruiting_engagement_facts_v1 force row level security;
alter table public.nov_talent_recruiting_engagement_audit_v1 enable row level security; alter table public.nov_talent_recruiting_engagement_audit_v1 force row level security;
alter table public.nov_talent_selection_coverage_releases_v1 enable row level security; alter table public.nov_talent_selection_coverage_releases_v1 force row level security;
alter table public.nov_talent_selection_coverage_audit_v1 enable row level security; alter table public.nov_talent_selection_coverage_audit_v1 force row level security;
alter table public.nov_talent_recruiting_spend_facts_v1 enable row level security; alter table public.nov_talent_recruiting_spend_facts_v1 force row level security;
alter table public.nov_talent_recruiting_spend_audit_v1 enable row level security; alter table public.nov_talent_recruiting_spend_audit_v1 force row level security;

revoke all on public.nov_talent_recruiting_engagement_facts_v1,public.nov_talent_recruiting_engagement_audit_v1,public.nov_talent_selection_coverage_releases_v1,public.nov_talent_selection_coverage_audit_v1,public.nov_talent_recruiting_spend_facts_v1,public.nov_talent_recruiting_spend_audit_v1 from public,anon,authenticated,service_role;
grant select on public.nov_talent_recruiting_engagement_facts_v1,public.nov_talent_recruiting_engagement_audit_v1,public.nov_talent_selection_coverage_releases_v1,public.nov_talent_selection_coverage_audit_v1,public.nov_talent_recruiting_spend_facts_v1,public.nov_talent_recruiting_spend_audit_v1 to service_role;
revoke all on function public.nov_talent_append_recruiting_engagement_fact_v1(uuid,text,uuid,text,timestamptz,uuid,text,text,text,text,uuid,text),public.nov_talent_append_recruiting_spend_fact_v1(uuid,text,text,integer,date,date,uuid,text,text,bigint,date,text,text,text,text,uuid,text),public.nov_talent_actual_fact_append_only_v1(),public.nov_talent_selection_coverage_immutable_v1() from public,anon,authenticated,service_role;
grant execute on function public.nov_talent_append_recruiting_engagement_fact_v1(uuid,text,uuid,text,timestamptz,uuid,text,text,text,text,uuid,text),public.nov_talent_append_recruiting_spend_fact_v1(uuid,text,text,integer,date,date,uuid,text,text,bigint,date,text,text,text,text,uuid,text) to service_role;

comment on table public.nov_talent_recruiting_engagement_facts_v1 is 'Canonical candidate-bound recruiting engagement facts. Legacy recruitment events are not backfilled automatically.';
comment on table public.nov_talent_selection_coverage_releases_v1 is 'Human-approved operational completeness boundary for official selection history actuals.';
comment on table public.nov_talent_recruiting_spend_facts_v1 is 'Canonical recruiting spend facts; only effective CONFIRMED rows contribute to official actual spend.';

commit;
