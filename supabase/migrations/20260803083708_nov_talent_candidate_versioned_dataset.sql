begin;

-- Candidate-only, versioned staging datasets. Event/contact and selection
-- history remain outside this migration by contract.
create schema if not exists nov_talent_internal;
revoke all on schema nov_talent_internal from public, anon, authenticated;
grant usage on schema nov_talent_internal to service_role;

create table public.nov_talent_candidate_datasets_v1 (
  dataset_id uuid primary key default gen_random_uuid(),
  snapshot_id text not null unique
    check (char_length(snapshot_id) between 1 and 160),
  artifact_hash text not null
    check (artifact_hash ~ '^[0-9a-f]{64}$'),
  source_hashes jsonb not null
    check (
      jsonb_typeof(source_hashes) = 'object'
      and source_hashes ? 'OFFICIAL_SOURCE_27_CONTACTS'
      and source_hashes ? 'OFFICIAL_SOURCE_28_CONTACTS'
      and (source_hashes ->> 'OFFICIAL_SOURCE_27_CONTACTS') ~ '^[0-9a-f]{64}$'
      and (source_hashes ->> 'OFFICIAL_SOURCE_28_CONTACTS') ~ '^[0-9a-f]{64}$'
    ),
  schema_version text not null
    check (char_length(schema_version) between 1 and 40),
  data_dictionary_version text not null
    check (char_length(data_dictionary_version) between 1 and 40),
  state text not null default 'BUILDING'
    check (state in ('BUILDING', 'READY', 'ACTIVE', 'RETIRED')),
  expected_candidate_count integer not null
    check (expected_candidate_count between 1 and 100000),
  expected_2027_count integer not null
    check (expected_2027_count between 0 and expected_candidate_count),
  expected_2028_count integer not null
    check (expected_2028_count between 0 and expected_candidate_count),
  excluded_template_count integer not null
    check (excluded_template_count >= 0),
  actual_candidate_count integer not null default 0
    check (actual_candidate_count >= 0),
  actual_2027_count integer not null default 0
    check (actual_2027_count >= 0),
  actual_2028_count integer not null default 0
    check (actual_2028_count >= 0),
  human_review_evidence_count integer not null
    check (human_review_evidence_count >= 0),
  keep_separate_group_count integer not null
    check (keep_separate_group_count >= 0),
  previous_dataset_id uuid
    references public.nov_talent_candidate_datasets_v1(dataset_id) on delete restrict,
  created_by_employee_id uuid not null,
  sealed_by_employee_id uuid,
  activated_by_employee_id uuid,
  created_at timestamptz not null default now(),
  sealed_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  check (expected_2027_count + expected_2028_count = expected_candidate_count),
  check (actual_2027_count + actual_2028_count = actual_candidate_count),
  check (previous_dataset_id is null or previous_dataset_id <> dataset_id),
  check (
    (state = 'BUILDING' and sealed_at is null and activated_at is null and retired_at is null)
    or (state = 'READY' and sealed_at is not null and activated_at is null and retired_at is null)
    or (state = 'ACTIVE' and sealed_at is not null and activated_at is not null and retired_at is null)
    or (state = 'RETIRED' and sealed_at is not null and activated_at is not null and retired_at is not null)
  )
);

create unique index nov_talent_candidate_datasets_v1_active_exact1
  on public.nov_talent_candidate_datasets_v1 ((state))
  where state = 'ACTIVE';

create table public.nov_talent_candidate_dataset_records_v1 (
  dataset_id uuid not null
    references public.nov_talent_candidate_datasets_v1(dataset_id) on delete restrict,
  candidate_id uuid not null,
  candidate_key_hash text not null
    check (candidate_key_hash ~ '^[0-9a-f]{64}$'),
  source_reference_hash text not null
    check (source_reference_hash ~ '^[0-9a-f]{64}$'),
  graduation_year smallint not null
    check (graduation_year in (2027, 2028)),
  source_type text not null
    check (source_type in ('CONTACTS_27', 'CONTACTS_28')),
  source_row_no integer not null
    check (source_row_no > 0),
  student_name text check (student_name is null or char_length(student_name) <= 120),
  student_name_kana text check (student_name_kana is null or char_length(student_name_kana) <= 120),
  school_name text check (school_name is null or char_length(school_name) <= 180),
  faculty_name text check (faculty_name is null or char_length(faculty_name) <= 180),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (
    email is null
    or (
      char_length(email) <= 254
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  line_identifier text check (line_identifier is null or char_length(line_identifier) <= 160),
  source_lineage jsonb not null
    check (jsonb_typeof(source_lineage) = 'object'),
  created_at timestamptz not null default now(),
  primary key (dataset_id, candidate_id),
  unique (dataset_id, candidate_key_hash),
  unique (dataset_id, source_reference_hash)
);

create index nov_talent_candidate_dataset_records_v1_search
  on public.nov_talent_candidate_dataset_records_v1
  (dataset_id, graduation_year, school_name, student_name);

alter table public.nov_talent_candidate_datasets_v1 enable row level security;
alter table public.nov_talent_candidate_dataset_records_v1 enable row level security;

revoke all on table public.nov_talent_candidate_datasets_v1
  from public, anon, authenticated;
revoke all on table public.nov_talent_candidate_dataset_records_v1
  from public, anon, authenticated;

-- The import runner may create BUILDING datasets and insert Candidate rows.
-- State transitions stay function-only.
grant select, insert on table public.nov_talent_candidate_datasets_v1
  to service_role;
grant select, insert on table public.nov_talent_candidate_dataset_records_v1
  to service_role;

create or replace function nov_talent_internal.guard_candidate_dataset_insert_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.state <> 'BUILDING'
    or new.actual_candidate_count <> 0
    or new.actual_2027_count <> 0
    or new.actual_2028_count <> 0
    or new.previous_dataset_id is not null
    or new.sealed_by_employee_id is not null
    or new.activated_by_employee_id is not null
    or new.sealed_at is not null
    or new.activated_at is not null
    or new.retired_at is not null
  then
    raise exception using errcode = '22023', message = 'candidate_dataset_insert_must_be_building';
  end if;

  return new;
end
$function$;

create trigger guard_nov_talent_candidate_dataset_insert_v1
before insert on public.nov_talent_candidate_datasets_v1
for each row execute function nov_talent_internal.guard_candidate_dataset_insert_v1();

create or replace function nov_talent_internal.guard_candidate_dataset_record_insert_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_state text;
begin
  select d.state
  into strict v_state
  from public.nov_talent_candidate_datasets_v1 d
  where d.dataset_id = new.dataset_id
  for share;

  if v_state <> 'BUILDING' then
    raise exception using errcode = '55000', message = 'candidate_dataset_not_building';
  end if;

  return new;
exception
  when no_data_found then
    raise exception using errcode = '23503', message = 'candidate_dataset_not_found';
end
$function$;

create trigger guard_nov_talent_candidate_dataset_record_insert_v1
before insert on public.nov_talent_candidate_dataset_records_v1
for each row execute function nov_talent_internal.guard_candidate_dataset_record_insert_v1();

create or replace function nov_talent_internal.seal_candidate_dataset_v1(
  p_actor_employee_id uuid,
  p_dataset_id uuid
)
returns table(
  dataset_id uuid,
  candidate_count integer,
  candidate_2027_count integer,
  candidate_2028_count integer,
  dataset_state text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_dataset public.nov_talent_candidate_datasets_v1%rowtype;
  v_total integer;
  v_2027 integer;
  v_2028 integer;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_actor_employee_id);

  select d.*
  into strict v_dataset
  from public.nov_talent_candidate_datasets_v1 d
  where d.dataset_id = p_dataset_id
  for update;

  if v_dataset.state <> 'BUILDING' then
    raise exception using errcode = '55000', message = 'candidate_dataset_not_building';
  end if;

  select
    count(*)::integer,
    count(*) filter (where r.graduation_year = 2027)::integer,
    count(*) filter (where r.graduation_year = 2028)::integer
  into v_total, v_2027, v_2028
  from public.nov_talent_candidate_dataset_records_v1 r
  where r.dataset_id = p_dataset_id;

  if v_total <> v_dataset.expected_candidate_count
    or v_2027 <> v_dataset.expected_2027_count
    or v_2028 <> v_dataset.expected_2028_count
  then
    raise exception using errcode = '22000', message = 'candidate_dataset_count_mismatch';
  end if;

  update public.nov_talent_candidate_datasets_v1 d
  set state = 'READY',
      actual_candidate_count = v_total,
      actual_2027_count = v_2027,
      actual_2028_count = v_2028,
      sealed_by_employee_id = p_actor_employee_id,
      sealed_at = now()
  where d.dataset_id = p_dataset_id;

  return query
  select p_dataset_id, v_total, v_2027, v_2028, 'READY'::text;
exception
  when no_data_found then
    raise exception using errcode = '22023', message = 'candidate_dataset_not_found';
end
$function$;

create or replace function nov_talent_internal.activate_candidate_dataset_v1(
  p_actor_employee_id uuid,
  p_dataset_id uuid
)
returns table(
  activated_dataset_id uuid,
  previous_dataset_id uuid,
  candidate_count integer,
  candidate_2027_count integer,
  candidate_2028_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_dataset public.nov_talent_candidate_datasets_v1%rowtype;
  v_previous_dataset_id uuid;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_actor_employee_id);

  -- Serialize activation and keep the exact-one ACTIVE invariant stable.
  lock table public.nov_talent_candidate_datasets_v1 in share row exclusive mode;

  select d.*
  into strict v_dataset
  from public.nov_talent_candidate_datasets_v1 d
  where d.dataset_id = p_dataset_id
  for update;

  if v_dataset.state <> 'READY'
    or v_dataset.actual_candidate_count <> v_dataset.expected_candidate_count
    or v_dataset.actual_2027_count <> v_dataset.expected_2027_count
    or v_dataset.actual_2028_count <> v_dataset.expected_2028_count
  then
    raise exception using errcode = '55000', message = 'candidate_dataset_not_ready';
  end if;

  select d.dataset_id
  into v_previous_dataset_id
  from public.nov_talent_candidate_datasets_v1 d
  where d.state = 'ACTIVE'
  for update;

  if v_previous_dataset_id is not null then
    update public.nov_talent_candidate_datasets_v1 d
    set state = 'RETIRED',
        retired_at = now()
    where d.dataset_id = v_previous_dataset_id;
  end if;

  update public.nov_talent_candidate_datasets_v1 d
  set state = 'ACTIVE',
      previous_dataset_id = v_previous_dataset_id,
      activated_by_employee_id = p_actor_employee_id,
      activated_at = now(),
      retired_at = null
  where d.dataset_id = p_dataset_id;

  return query
  select
    p_dataset_id,
    v_previous_dataset_id,
    v_dataset.actual_candidate_count,
    v_dataset.actual_2027_count,
    v_dataset.actual_2028_count;
exception
  when no_data_found then
    raise exception using errcode = '22023', message = 'candidate_dataset_not_found';
end
$function$;

create or replace function nov_talent_internal.restore_previous_candidate_dataset_v1(
  p_actor_employee_id uuid,
  p_current_dataset_id uuid
)
returns table(
  restored_dataset_id uuid,
  retired_dataset_id uuid,
  candidate_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current public.nov_talent_candidate_datasets_v1%rowtype;
  v_previous public.nov_talent_candidate_datasets_v1%rowtype;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_actor_employee_id);

  lock table public.nov_talent_candidate_datasets_v1 in share row exclusive mode;

  select d.*
  into strict v_current
  from public.nov_talent_candidate_datasets_v1 d
  where d.dataset_id = p_current_dataset_id
    and d.state = 'ACTIVE'
  for update;

  if v_current.previous_dataset_id is null then
    raise exception using errcode = '55000', message = 'previous_candidate_dataset_not_available';
  end if;

  select d.*
  into strict v_previous
  from public.nov_talent_candidate_datasets_v1 d
  where d.dataset_id = v_current.previous_dataset_id
    and d.state = 'RETIRED'
  for update;

  update public.nov_talent_candidate_datasets_v1 d
  set state = 'RETIRED',
      retired_at = now()
  where d.dataset_id = v_current.dataset_id;

  update public.nov_talent_candidate_datasets_v1 d
  set state = 'ACTIVE',
      activated_by_employee_id = p_actor_employee_id,
      activated_at = now(),
      retired_at = null
  where d.dataset_id = v_previous.dataset_id;

  return query
  select v_previous.dataset_id, v_current.dataset_id, v_previous.actual_candidate_count;
exception
  when no_data_found then
    raise exception using errcode = '55000', message = 'candidate_dataset_restore_not_exact1';
end
$function$;

revoke all on function nov_talent_internal.guard_candidate_dataset_record_insert_v1()
  from public, anon, authenticated;
revoke all on function nov_talent_internal.guard_candidate_dataset_insert_v1()
  from public, anon, authenticated;
revoke all on function nov_talent_internal.seal_candidate_dataset_v1(uuid, uuid)
  from public, anon, authenticated;
revoke all on function nov_talent_internal.activate_candidate_dataset_v1(uuid, uuid)
  from public, anon, authenticated;
revoke all on function nov_talent_internal.restore_previous_candidate_dataset_v1(uuid, uuid)
  from public, anon, authenticated;

grant execute on function nov_talent_internal.seal_candidate_dataset_v1(uuid, uuid)
  to service_role;
grant execute on function nov_talent_internal.activate_candidate_dataset_v1(uuid, uuid)
  to service_role;
grant execute on function nov_talent_internal.restore_previous_candidate_dataset_v1(uuid, uuid)
  to service_role;

comment on table public.nov_talent_candidate_datasets_v1 is
  'Candidate-only versioned staging datasets. No Event, Selection, Production, canonical, NOV People, Employee Core, or LINE history scope.';
comment on table public.nov_talent_candidate_dataset_records_v1 is
  'Immutable Candidate records belonging to a BUILDING/READY/ACTIVE/RETIRED staging dataset.';

commit;
