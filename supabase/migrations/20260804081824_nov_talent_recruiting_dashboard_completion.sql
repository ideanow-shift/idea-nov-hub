begin;

-- NOV Talent Phase 2 dashboard facts. These tables are Staging-only and are
-- reachable only through the server-side NOV Talent Edge Function.
alter table public.nov_talent_candidates_v1
  drop constraint if exists nov_talent_candidates_v1_current_status_code_check;

update public.nov_talent_candidates_v1
set current_status_code = case current_status_code
  when 'AWAITING_INTERVIEW' then 'INTERVIEW_PLANNED'
  when 'DROPPED' then 'WITHDRAWN'
  else current_status_code
end
where current_status_code in ('AWAITING_INTERVIEW', 'DROPPED');

alter table public.nov_talent_candidates_v1
  add constraint nov_talent_candidates_v1_current_status_code_check check (
    current_status_code is null or current_status_code in (
      'LINE_REGISTERED', 'APPLICATION_RECEIVED',
      'SALON_TOUR_PLANNED', 'SALON_TOUR_COMPLETED',
      'INTERVIEW_PLANNED', 'INTERVIEW_COMPLETED',
      'UNDER_REVIEW', 'OFFERED', 'OFFER_ACCEPTED', 'EXPECTED_JOIN',
      'OFFERED_ELSEWHERE', 'WITHDRAWN', 'REJECTED'
    )
  );

create table public.nov_talent_recruitment_events_v1 (
  event_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.nov_talent_candidates_v1(candidate_id) on delete restrict,
  event_code text not null check (event_code in (
    'CONTACT_RECORDED', 'LINE_REGISTERED',
    'SALON_TOUR_PLANNED', 'SALON_TOUR_COMPLETED',
    'INTERVIEW_PLANNED', 'INTERVIEW_COMPLETED'
  )),
  event_date date not null,
  source_type text not null check (source_type in ('CONTACTS_27', 'CONTACTS_28')),
  source_row_no integer not null check (source_row_no > 0),
  source_field_code text not null check (char_length(source_field_code) between 1 and 80),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (candidate_id, event_code, event_date, source_field_code)
);

create index nov_talent_recruitment_events_v1_candidate
  on public.nov_talent_recruitment_events_v1 (candidate_id, event_date desc);
create index nov_talent_recruitment_events_v1_dashboard
  on public.nov_talent_recruitment_events_v1 (event_code, event_date);

create table public.nov_talent_selection_history_v1 (
  selection_history_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.nov_talent_candidates_v1(candidate_id) on delete restrict,
  selection_code text not null check (selection_code in (
    'APPLICATION_RECEIVED', 'INTERVIEW_PLANNED', 'INTERVIEW_COMPLETED',
    'UNDER_REVIEW', 'OFFERED', 'OFFER_ACCEPTED', 'WITHDRAWN', 'REJECTED'
  )),
  effective_date date not null,
  source_type text not null check (source_type in ('CONTACTS_27', 'CONTACTS_28')),
  source_row_no integer not null check (source_row_no > 0),
  source_field_code text not null check (char_length(source_field_code) between 1 and 80),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (candidate_id, selection_code, effective_date, source_field_code)
);

create index nov_talent_selection_history_v1_candidate
  on public.nov_talent_selection_history_v1 (candidate_id, effective_date desc);
create index nov_talent_selection_history_v1_dashboard
  on public.nov_talent_selection_history_v1 (selection_code, effective_date);

create table public.nov_talent_next_actions_v1 (
  next_action_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.nov_talent_candidates_v1(candidate_id) on delete restrict,
  action_code text not null check (action_code in (
    'FOLLOW_UP', 'SALON_TOUR_FOLLOW_UP', 'INTERVIEW_FOLLOW_UP', 'OFFER_FOLLOW_UP'
  )),
  due_date date not null,
  state text not null default 'OPEN' check (state in ('OPEN', 'COMPLETED', 'CANCELLED')),
  source_type text not null check (source_type in ('CONTACTS_27', 'CONTACTS_28', 'NOV_TALENT_UI')),
  source_row_no integer check (source_row_no is null or source_row_no > 0),
  source_field_code text not null check (char_length(source_field_code) between 1 and 80),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (candidate_id, action_code, due_date, source_field_code)
);

create index nov_talent_next_actions_v1_due
  on public.nov_talent_next_actions_v1 (state, due_date, candidate_id);

create table public.nov_talent_fair_metrics_v1 (
  fair_metric_id uuid primary key default gen_random_uuid(),
  graduation_year smallint not null check (graduation_year in (2027, 2028)),
  source_row_no integer not null check (source_row_no > 0),
  event_date date not null,
  contact_count integer check (contact_count is null or contact_count >= 0),
  line_registration_count integer check (line_registration_count is null or line_registration_count >= 0),
  salon_tour_count integer check (salon_tour_count is null or salon_tour_count >= 0),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (graduation_year, source_row_no)
);

alter table public.nov_talent_recruitment_events_v1 enable row level security;
alter table public.nov_talent_selection_history_v1 enable row level security;
alter table public.nov_talent_next_actions_v1 enable row level security;
alter table public.nov_talent_fair_metrics_v1 enable row level security;

revoke all on public.nov_talent_recruitment_events_v1 from public, anon, authenticated, service_role;
revoke all on public.nov_talent_selection_history_v1 from public, anon, authenticated, service_role;
revoke all on public.nov_talent_next_actions_v1 from public, anon, authenticated, service_role;
revoke all on public.nov_talent_fair_metrics_v1 from public, anon, authenticated, service_role;
grant select, insert on public.nov_talent_recruitment_events_v1 to service_role;
grant select, insert on public.nov_talent_selection_history_v1 to service_role;
grant select, insert, update on public.nov_talent_next_actions_v1 to service_role;
grant select, insert on public.nov_talent_fair_metrics_v1 to service_role;

comment on table public.nov_talent_recruitment_events_v1 is 'Staging-only normalized recruitment event facts for NOV Talent dashboard and Candidate history.';
comment on table public.nov_talent_selection_history_v1 is 'Staging-only normalized selection history facts for NOV Talent dashboard and Candidate history.';
comment on table public.nov_talent_next_actions_v1 is 'Staging-only due actions for the maximum-five Today action board.';
comment on table public.nov_talent_fair_metrics_v1 is 'Staging-only aggregate fair facts. No participant names or contact values are stored.';

commit;
