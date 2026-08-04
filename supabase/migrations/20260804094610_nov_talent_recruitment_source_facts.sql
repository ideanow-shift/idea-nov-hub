begin;

create table public.nov_talent_recruitment_source_facts_v1 (
  source_type text not null check (source_type in ('ENTRIES_27', 'OFFERS_27')),
  source_row_no integer not null check (source_row_no > 0),
  fact_code text not null check (fact_code in (
    'APPLICATION_RECEIVED', 'INTERVIEW_PLANNED', 'INTERVIEW_COMPLETED',
    'OFFERED', 'OFFER_ACCEPTED', 'WITHDRAWN', 'REJECTED'
  )),
  fact_date date,
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  imported_at timestamptz not null default now(),
  primary key (source_type, source_row_no, fact_code)
);

alter table public.nov_talent_recruitment_source_facts_v1 enable row level security;
revoke all on public.nov_talent_recruitment_source_facts_v1 from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.nov_talent_recruitment_source_facts_v1 to service_role;

comment on table public.nov_talent_recruitment_source_facts_v1 is
  'Staging-only aggregate recruitment facts from formal source sheets. Contains no candidate personal values and is available only to the server-side API.';

commit;
