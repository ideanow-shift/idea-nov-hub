-- Forward-only extension of the merged Recruiting Target Foundation (#102).
-- The v1 target tables and their history remain untouched.
create table public.nov_talent_recruiting_funnel_targets_v1 (
  target_id uuid primary key default gen_random_uuid(),
  recruiting_track text not null check (recruiting_track in ('NEW_GRAD','MID_CAREER')),
  graduation_year integer check (graduation_year between 2020 and 2100),
  target_metric text not null check (target_metric in ('CONTACT_COUNT','SALON_VISIT_COUNT','APPLICATION_COUNT','OFFERED_COUNT','OFFER_ACCEPTED_COUNT')),
  recruiting_period_code text not null check (recruiting_period_code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  recruiting_period_start date not null,
  recruiting_period_end date not null,
  scope_type text not null check (scope_type = 'COMPANY'),
  scope_id uuid,
  target_count integer not null check (target_count >= 0),
  version integer not null check (version >= 1),
  row_version integer not null default 1 check (row_version >= 1),
  record_state text not null check (record_state in ('DRAFT','APPROVED','SUPERSEDED')),
  effective_from date not null,
  effective_to date not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  approved_by uuid, approved_at timestamptz,
  superseded_by_target_id uuid references public.nov_talent_recruiting_funnel_targets_v1(target_id),
  superseded_by uuid, superseded_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint nov_talent_planning_target_track_shape check ((recruiting_track='NEW_GRAD' and graduation_year is not null) or (recruiting_track='MID_CAREER' and graduation_year is null)),
  constraint nov_talent_planning_target_period_order check (recruiting_period_start <= recruiting_period_end),
  constraint nov_talent_planning_target_effective_order check (effective_from <= effective_to),
  constraint nov_talent_planning_target_company_scope check (scope_id is null),
  constraint nov_talent_planning_target_approval_shape check (
    (record_state='DRAFT' and approved_by is null and approved_at is null and superseded_by is null and superseded_at is null)
    or (record_state='APPROVED' and approved_by is not null and approved_at is not null and superseded_by is null and superseded_at is null)
    or (record_state='SUPERSEDED' and approved_by is not null and approved_at is not null and superseded_by is not null and superseded_at is not null)),
  unique nulls not distinct (recruiting_track,graduation_year,target_metric,recruiting_period_code,scope_type,version)
);
create unique index nov_talent_planning_target_one_approved_v1 on public.nov_talent_recruiting_funnel_targets_v1
  (recruiting_track,coalesce(graduation_year,0),target_metric,recruiting_period_code,scope_type) where record_state='APPROVED';
create index nov_talent_planning_target_history_v1 on public.nov_talent_recruiting_funnel_targets_v1
  (recruiting_track,coalesce(graduation_year,0),target_metric,recruiting_period_code,scope_type,version desc);

create table public.nov_talent_recruiting_funnel_target_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(), target_id uuid not null references public.nov_talent_recruiting_funnel_targets_v1(target_id),
  event_type text not null check (event_type in ('DRAFT_CREATED','VERSION_DRAFTED','APPROVED','SUPERSEDED')),
  previous_state text check (previous_state is null or previous_state in ('DRAFT','APPROVED','SUPERSEDED')),
  new_state text not null check (new_state in ('DRAFT','APPROVED','SUPERSEDED')), target_version integer not null check(target_version>=1),
  actor_employee_id uuid not null, actor_role text not null check(actor_role in ('super_admin','hr.admin','backoffice')),
  occurred_at timestamptz not null default statement_timestamp()
);
create index nov_talent_planning_target_audit_target_v1 on public.nov_talent_recruiting_funnel_target_audit_v1(target_id,occurred_at,audit_id);

create table public.nov_talent_recruiting_budgets_v1 (
  budget_id uuid primary key default gen_random_uuid(), recruiting_track text not null check(recruiting_track in ('NEW_GRAD','MID_CAREER')),
  graduation_year integer check(graduation_year between 2020 and 2100), recruiting_period_code text not null check(recruiting_period_code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  recruiting_period_start date not null, recruiting_period_end date not null, scope_type text not null check(scope_type='COMPANY'), scope_id uuid,
  total_budget bigint not null check(total_budget>=0), currency text not null check(currency='JPY'), version integer not null check(version>=1),
  row_version integer not null default 1 check(row_version>=1), record_state text not null check(record_state in ('DRAFT','APPROVED','SUPERSEDED')),
  effective_from date not null, effective_to date not null, reason text not null check(char_length(btrim(reason)) between 1 and 500),
  approved_by uuid, approved_at timestamptz, superseded_by_budget_id uuid references public.nov_talent_recruiting_budgets_v1(budget_id),
  superseded_by uuid, superseded_at timestamptz, created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(),
  constraint nov_talent_planning_budget_track_shape check ((recruiting_track='NEW_GRAD' and graduation_year is not null) or (recruiting_track='MID_CAREER' and graduation_year is null)),
  constraint nov_talent_planning_budget_period_order check(recruiting_period_start<=recruiting_period_end),
  constraint nov_talent_planning_budget_effective_order check(effective_from<=effective_to), constraint nov_talent_planning_budget_company_scope check(scope_id is null),
  constraint nov_talent_planning_budget_approval_shape check(
    (record_state='DRAFT' and approved_by is null and approved_at is null and superseded_by is null and superseded_at is null)
    or (record_state='APPROVED' and approved_by is not null and approved_at is not null and superseded_by is null and superseded_at is null)
    or (record_state='SUPERSEDED' and approved_by is not null and approved_at is not null and superseded_by is not null and superseded_at is not null)),
  unique nulls not distinct(recruiting_track,graduation_year,recruiting_period_code,scope_type,version)
);
create unique index nov_talent_planning_budget_one_approved_v1 on public.nov_talent_recruiting_budgets_v1
  (recruiting_track,coalesce(graduation_year,0),recruiting_period_code,scope_type) where record_state='APPROVED';

create table public.nov_talent_recruiting_budget_lines_v1 (
  budget_line_id uuid primary key default gen_random_uuid(), budget_id uuid not null references public.nov_talent_recruiting_budgets_v1(budget_id),
  channel_code text not null check(channel_code in ('JOB_FAIR','SCHOOL_GUIDANCE','SCHOOL_VISIT','PAID_JOB_MEDIA','FREE_JOB_MEDIA','SNS','OWNED_WEB','REFERRAL','HELLO_WORK','REHIRE','DEALER_REFERRAL','OTHER')),
  amount bigint not null check(amount>=0), reason text not null check(char_length(btrim(reason)) between 1 and 500), created_at timestamptz not null default statement_timestamp(),
  unique(budget_id,channel_code)
);
create table public.nov_talent_recruiting_budget_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(), budget_id uuid not null references public.nov_talent_recruiting_budgets_v1(budget_id),
  event_type text not null check(event_type in ('DRAFT_CREATED','VERSION_DRAFTED','APPROVED','SUPERSEDED')),
  previous_state text check(previous_state is null or previous_state in ('DRAFT','APPROVED','SUPERSEDED')),
  new_state text not null check(new_state in ('DRAFT','APPROVED','SUPERSEDED')), budget_version integer not null check(budget_version>=1),
  actor_employee_id uuid not null, actor_role text not null check(actor_role in ('super_admin','hr.admin','backoffice')), occurred_at timestamptz not null default statement_timestamp()
);

alter table public.nov_talent_recruiting_funnel_targets_v1 enable row level security; alter table public.nov_talent_recruiting_funnel_targets_v1 force row level security;
alter table public.nov_talent_recruiting_funnel_target_audit_v1 enable row level security; alter table public.nov_talent_recruiting_funnel_target_audit_v1 force row level security;
alter table public.nov_talent_recruiting_budgets_v1 enable row level security; alter table public.nov_talent_recruiting_budgets_v1 force row level security;
alter table public.nov_talent_recruiting_budget_lines_v1 enable row level security; alter table public.nov_talent_recruiting_budget_lines_v1 force row level security;
alter table public.nov_talent_recruiting_budget_audit_v1 enable row level security; alter table public.nov_talent_recruiting_budget_audit_v1 force row level security;
revoke all on public.nov_talent_recruiting_funnel_targets_v1,public.nov_talent_recruiting_funnel_target_audit_v1,public.nov_talent_recruiting_budgets_v1,public.nov_talent_recruiting_budget_lines_v1,public.nov_talent_recruiting_budget_audit_v1 from public,anon,authenticated,service_role;
grant select on public.nov_talent_recruiting_funnel_targets_v1,public.nov_talent_recruiting_funnel_target_audit_v1,public.nov_talent_recruiting_budgets_v1,public.nov_talent_recruiting_budget_lines_v1,public.nov_talent_recruiting_budget_audit_v1 to service_role;

create function public.nov_talent_planning_immutable_v1() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception using errcode='55000',message='RECRUITING_PLANNING_DELETE_PROHIBITED'; end if;
  if old.record_state='APPROVED' then
    if new.record_state<>'SUPERSEDED'
      or (to_jsonb(new)-array['record_state','row_version','updated_at','superseded_by_target_id','superseded_by_budget_id','superseded_by','superseded_at'])
         is distinct from (to_jsonb(old)-array['record_state','row_version','updated_at','superseded_by_target_id','superseded_by_budget_id','superseded_by','superseded_at'])
    then raise exception using errcode='55000',message='APPROVED_RECRUITING_PLANNING_IMMUTABLE'; end if;
  elsif old.record_state<>'DRAFT' then raise exception using errcode='55000',message='RECRUITING_PLANNING_IMMUTABLE'; end if;
  return new;
end $$;
create trigger nov_talent_planning_target_immutable_v1 before update or delete on public.nov_talent_recruiting_funnel_targets_v1 for each row execute function public.nov_talent_planning_immutable_v1();
create trigger nov_talent_planning_budget_immutable_v1 before update or delete on public.nov_talent_recruiting_budgets_v1 for each row execute function public.nov_talent_planning_immutable_v1();
create function public.nov_talent_planning_append_only_v1() returns trigger language plpgsql set search_path='' as $$ begin raise exception using errcode='55000',message='RECRUITING_PLANNING_APPEND_ONLY'; end $$;
create trigger nov_talent_planning_target_audit_append_only_v1 before update or delete on public.nov_talent_recruiting_funnel_target_audit_v1 for each row execute function public.nov_talent_planning_append_only_v1();
create trigger nov_talent_planning_budget_line_append_only_v1 before update or delete on public.nov_talent_recruiting_budget_lines_v1 for each row execute function public.nov_talent_planning_append_only_v1();
create trigger nov_talent_planning_budget_audit_append_only_v1 before update or delete on public.nov_talent_recruiting_budget_audit_v1 for each row execute function public.nov_talent_planning_append_only_v1();

create function public.nov_talent_create_planning_target_draft_v1(p_actor_employee_id uuid,p_actor_role text,p_recruiting_track text,p_graduation_year integer,p_target_metric text,p_period_code text,p_period_start date,p_period_end date,p_target_count integer,p_effective_from date,p_effective_to date,p_reason text)
returns setof public.nov_talent_recruiting_funnel_targets_v1 language plpgsql security definer set search_path='' as $$
declare v public.nov_talent_recruiting_funnel_targets_v1; n integer;
begin
 if p_actor_employee_id is null or p_actor_role not in ('super_admin','hr.admin','backoffice') then raise exception using errcode='42501',message='RECRUITING_PLANNING_ROLE_FORBIDDEN'; end if;
 if p_recruiting_track not in ('NEW_GRAD','MID_CAREER') or p_target_metric not in ('CONTACT_COUNT','SALON_VISIT_COUNT','APPLICATION_COUNT','OFFERED_COUNT','OFFER_ACCEPTED_COUNT') then raise exception using errcode='22023',message='RECRUITING_PLANNING_TARGET_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',p_recruiting_track,coalesce(p_graduation_year,0),p_target_metric,p_period_code,'COMPANY'),0));
 select coalesce(max(version),0)+1 into n from public.nov_talent_recruiting_funnel_targets_v1 where recruiting_track=p_recruiting_track and graduation_year is not distinct from p_graduation_year and target_metric=p_target_metric and recruiting_period_code=p_period_code and scope_type='COMPANY';
 insert into public.nov_talent_recruiting_funnel_targets_v1(recruiting_track,graduation_year,target_metric,recruiting_period_code,recruiting_period_start,recruiting_period_end,scope_type,target_count,version,record_state,effective_from,effective_to,reason,created_by)
 values(p_recruiting_track,p_graduation_year,p_target_metric,p_period_code,p_period_start,p_period_end,'COMPANY',p_target_count,n,'DRAFT',p_effective_from,p_effective_to,btrim(p_reason),p_actor_employee_id) returning * into v;
 insert into public.nov_talent_recruiting_funnel_target_audit_v1(target_id,event_type,new_state,target_version,actor_employee_id,actor_role) values(v.target_id,case when n=1 then 'DRAFT_CREATED' else 'VERSION_DRAFTED' end,'DRAFT',n,p_actor_employee_id,p_actor_role); return next v;
end $$;

create function public.nov_talent_approve_planning_target_v1(p_actor_employee_id uuid,p_actor_role text,p_target_id uuid,p_expected_row_version integer)
returns setof public.nov_talent_recruiting_funnel_targets_v1 language plpgsql security definer set search_path='' as $$
declare v public.nov_talent_recruiting_funnel_targets_v1; oldv public.nov_talent_recruiting_funnel_targets_v1;
begin
 if p_actor_employee_id is null or p_actor_role not in ('super_admin','hr.admin') then raise exception using errcode='42501',message='RECRUITING_PLANNING_APPROVAL_FORBIDDEN'; end if;
 select * into v from public.nov_talent_recruiting_funnel_targets_v1 where target_id=p_target_id for update; if not found then raise exception using errcode='P0002',message='RECRUITING_PLANNING_TARGET_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',v.recruiting_track,coalesce(v.graduation_year,0),v.target_metric,v.recruiting_period_code,'COMPANY'),0));
 if v.record_state<>'DRAFT' or v.row_version<>p_expected_row_version then raise exception using errcode='40001',message='RECRUITING_PLANNING_STALE_VERSION'; end if;
 if exists(select 1 from public.nov_talent_recruiting_funnel_targets_v1 x where x.record_state='APPROVED' and x.target_id<>v.target_id and x.recruiting_track=v.recruiting_track and x.graduation_year is not distinct from v.graduation_year and x.target_metric=v.target_metric and daterange(x.recruiting_period_start,x.recruiting_period_end,'[]') && daterange(v.recruiting_period_start,v.recruiting_period_end,'[]') and x.recruiting_period_code<>v.recruiting_period_code) then raise exception using errcode='23P01',message='RECRUITING_PLANNING_PERIOD_OVERLAP'; end if;
 select * into oldv from public.nov_talent_recruiting_funnel_targets_v1 x where x.recruiting_track=v.recruiting_track and x.graduation_year is not distinct from v.graduation_year and x.target_metric=v.target_metric and x.recruiting_period_code=v.recruiting_period_code and x.scope_type='COMPANY' and x.record_state='APPROVED' for update;
 if found then update public.nov_talent_recruiting_funnel_targets_v1 set record_state='SUPERSEDED',superseded_by_target_id=v.target_id,superseded_by=p_actor_employee_id,superseded_at=statement_timestamp(),row_version=row_version+1,updated_at=statement_timestamp() where target_id=oldv.target_id; insert into public.nov_talent_recruiting_funnel_target_audit_v1(target_id,event_type,previous_state,new_state,target_version,actor_employee_id,actor_role) values(oldv.target_id,'SUPERSEDED','APPROVED','SUPERSEDED',oldv.version,p_actor_employee_id,p_actor_role); end if;
 update public.nov_talent_recruiting_funnel_targets_v1 set record_state='APPROVED',approved_by=p_actor_employee_id,approved_at=statement_timestamp(),row_version=row_version+1,updated_at=statement_timestamp() where target_id=v.target_id returning * into v;
 insert into public.nov_talent_recruiting_funnel_target_audit_v1(target_id,event_type,previous_state,new_state,target_version,actor_employee_id,actor_role) values(v.target_id,'APPROVED','DRAFT','APPROVED',v.version,p_actor_employee_id,p_actor_role); return next v;
end $$;

create function public.nov_talent_create_planning_budget_draft_v1(p_actor_employee_id uuid,p_actor_role text,p_recruiting_track text,p_graduation_year integer,p_period_code text,p_period_start date,p_period_end date,p_total_budget bigint,p_currency text,p_effective_from date,p_effective_to date,p_reason text,p_lines jsonb)
returns setof public.nov_talent_recruiting_budgets_v1 language plpgsql security definer set search_path='' as $$
declare v public.nov_talent_recruiting_budgets_v1; n integer; line jsonb;
begin
 if p_actor_employee_id is null or p_actor_role not in ('super_admin','hr.admin','backoffice') then raise exception using errcode='42501',message='RECRUITING_PLANNING_ROLE_FORBIDDEN'; end if;
 if p_recruiting_track not in ('NEW_GRAD','MID_CAREER') or p_currency<>'JPY' or jsonb_typeof(p_lines)<>'array' then raise exception using errcode='22023',message='RECRUITING_PLANNING_BUDGET_INVALID'; end if;
 if coalesce((select sum((x->>'amount')::bigint) from jsonb_array_elements(p_lines) x),0)>p_total_budget then raise exception using errcode='22023',message='RECRUITING_PLANNING_BUDGET_LINES_EXCEED_TOTAL'; end if;
 perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',p_recruiting_track,coalesce(p_graduation_year,0),p_period_code,'COMPANY','BUDGET'),0));
 select coalesce(max(version),0)+1 into n from public.nov_talent_recruiting_budgets_v1 where recruiting_track=p_recruiting_track and graduation_year is not distinct from p_graduation_year and recruiting_period_code=p_period_code and scope_type='COMPANY';
 insert into public.nov_talent_recruiting_budgets_v1(recruiting_track,graduation_year,recruiting_period_code,recruiting_period_start,recruiting_period_end,scope_type,total_budget,currency,version,record_state,effective_from,effective_to,reason,created_by)
 values(p_recruiting_track,p_graduation_year,p_period_code,p_period_start,p_period_end,'COMPANY',p_total_budget,p_currency,n,'DRAFT',p_effective_from,p_effective_to,btrim(p_reason),p_actor_employee_id) returning * into v;
 for line in select * from jsonb_array_elements(p_lines) loop insert into public.nov_talent_recruiting_budget_lines_v1(budget_id,channel_code,amount,reason) values(v.budget_id,line->>'channelCode',(line->>'amount')::bigint,btrim(line->>'reason')); end loop;
 insert into public.nov_talent_recruiting_budget_audit_v1(budget_id,event_type,new_state,budget_version,actor_employee_id,actor_role) values(v.budget_id,case when n=1 then 'DRAFT_CREATED' else 'VERSION_DRAFTED' end,'DRAFT',n,p_actor_employee_id,p_actor_role); return next v;
end $$;

create function public.nov_talent_approve_planning_budget_v1(p_actor_employee_id uuid,p_actor_role text,p_budget_id uuid,p_expected_row_version integer)
returns setof public.nov_talent_recruiting_budgets_v1 language plpgsql security definer set search_path='' as $$
declare v public.nov_talent_recruiting_budgets_v1; oldv public.nov_talent_recruiting_budgets_v1;
begin
 if p_actor_employee_id is null or p_actor_role not in ('super_admin','hr.admin') then raise exception using errcode='42501',message='RECRUITING_PLANNING_APPROVAL_FORBIDDEN'; end if;
 select * into v from public.nov_talent_recruiting_budgets_v1 where budget_id=p_budget_id for update; if not found then raise exception using errcode='P0002',message='RECRUITING_PLANNING_BUDGET_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',v.recruiting_track,coalesce(v.graduation_year,0),v.recruiting_period_code,'COMPANY','BUDGET'),0));
 if v.record_state<>'DRAFT' or v.row_version<>p_expected_row_version then raise exception using errcode='40001',message='RECRUITING_PLANNING_STALE_VERSION'; end if;
 if exists(select 1 from public.nov_talent_recruiting_budgets_v1 x where x.record_state='APPROVED' and x.budget_id<>v.budget_id and x.recruiting_track=v.recruiting_track and x.graduation_year is not distinct from v.graduation_year and daterange(x.recruiting_period_start,x.recruiting_period_end,'[]') && daterange(v.recruiting_period_start,v.recruiting_period_end,'[]') and x.recruiting_period_code<>v.recruiting_period_code) then raise exception using errcode='23P01',message='RECRUITING_PLANNING_PERIOD_OVERLAP'; end if;
 select * into oldv from public.nov_talent_recruiting_budgets_v1 x where x.recruiting_track=v.recruiting_track and x.graduation_year is not distinct from v.graduation_year and x.recruiting_period_code=v.recruiting_period_code and x.scope_type='COMPANY' and x.record_state='APPROVED' for update;
 if found then update public.nov_talent_recruiting_budgets_v1 set record_state='SUPERSEDED',superseded_by_budget_id=v.budget_id,superseded_by=p_actor_employee_id,superseded_at=statement_timestamp(),row_version=row_version+1,updated_at=statement_timestamp() where budget_id=oldv.budget_id; insert into public.nov_talent_recruiting_budget_audit_v1(budget_id,event_type,previous_state,new_state,budget_version,actor_employee_id,actor_role) values(oldv.budget_id,'SUPERSEDED','APPROVED','SUPERSEDED',oldv.version,p_actor_employee_id,p_actor_role); end if;
 update public.nov_talent_recruiting_budgets_v1 set record_state='APPROVED',approved_by=p_actor_employee_id,approved_at=statement_timestamp(),row_version=row_version+1,updated_at=statement_timestamp() where budget_id=v.budget_id returning * into v;
 insert into public.nov_talent_recruiting_budget_audit_v1(budget_id,event_type,previous_state,new_state,budget_version,actor_employee_id,actor_role) values(v.budget_id,'APPROVED','DRAFT','APPROVED',v.version,p_actor_employee_id,p_actor_role); return next v;
end $$;

revoke all on function public.nov_talent_create_planning_target_draft_v1(uuid,text,text,integer,text,text,date,date,integer,date,date,text) from public,anon,authenticated,service_role;
revoke all on function public.nov_talent_approve_planning_target_v1(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
revoke all on function public.nov_talent_create_planning_budget_draft_v1(uuid,text,text,integer,text,date,date,bigint,text,date,date,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.nov_talent_approve_planning_budget_v1(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.nov_talent_create_planning_target_draft_v1(uuid,text,text,integer,text,text,date,date,integer,date,date,text) to service_role;
grant execute on function public.nov_talent_approve_planning_target_v1(uuid,text,uuid,integer) to service_role;
grant execute on function public.nov_talent_create_planning_budget_draft_v1(uuid,text,text,integer,text,date,date,bigint,text,date,date,text,jsonb) to service_role;
grant execute on function public.nov_talent_approve_planning_budget_v1(uuid,text,uuid,integer) to service_role;
revoke all on function public.nov_talent_planning_immutable_v1(),public.nov_talent_planning_append_only_v1() from public,anon,authenticated,service_role;
