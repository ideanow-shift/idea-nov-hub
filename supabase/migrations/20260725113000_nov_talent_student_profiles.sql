begin;

create table if not exists public.nov_talent_student_profiles_v1 (
  application_id uuid primary key
    references public.nov_talent_applications_v1(application_id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 120),
  kana text check (kana is null or char_length(kana) <= 120),
  school text check (school is null or char_length(school) <= 180),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or char_length(email) <= 254),
  preferred_store text check (preferred_store is null or char_length(preferred_store) <= 120),
  current_status text not null check (current_status in (
    'CONTACT', 'LINE_REGISTERED', 'SALON_TOUR', 'INTERVIEW',
    'PASSED', 'OFFER', 'EXPECTED_JOIN', 'WITHDRAWN'
  )),
  next_action_at date,
  version integer not null default 1 check (version >= 1),
  updated_by_employee_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nov_talent_student_profile_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.nov_talent_applications_v1(application_id) on delete restrict,
  action text not null check (action in ('CREATE', 'UPDATE')),
  changed_fields text[] not null check (cardinality(changed_fields) between 1 and 8),
  actor_employee_id uuid not null,
  profile_version integer not null check (profile_version >= 1),
  occurred_at timestamptz not null default now()
);

revoke all on table public.nov_talent_student_profiles_v1
  from public, anon, authenticated;
revoke all on table public.nov_talent_student_profile_audit_v1
  from public, anon, authenticated;

create or replace function public.save_nov_talent_student_profile_v1(
  p_actor_employee_id uuid,
  p_application_no text,
  p_expected_version integer,
  p_display_name text,
  p_kana text,
  p_school text,
  p_phone text,
  p_email text,
  p_preferred_store text,
  p_current_status text,
  p_next_action_at date
)
returns table(
  application_no text,
  profile_version integer,
  operation text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_application_id uuid;
  v_application_no text;
  v_existing public.nov_talent_student_profiles_v1%rowtype;
  v_changed_fields text[] := '{}'::text[];
  v_operation text;
  v_version integer;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_actor_employee_id);

  p_application_no := nullif(btrim(p_application_no), '');
  p_display_name := nullif(btrim(p_display_name), '');
  p_kana := nullif(btrim(p_kana), '');
  p_school := nullif(btrim(p_school), '');
  p_phone := nullif(btrim(p_phone), '');
  p_email := nullif(btrim(p_email), '');
  p_preferred_store := nullif(btrim(p_preferred_store), '');

  if p_display_name is null
    or char_length(p_display_name) > 120
    or (p_kana is not null and char_length(p_kana) > 120)
    or (p_school is not null and char_length(p_school) > 180)
    or (p_phone is not null and char_length(p_phone) > 40)
    or (p_email is not null and (
      char_length(p_email) > 254
      or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ))
    or (p_preferred_store is not null and char_length(p_preferred_store) > 120)
    or p_current_status not in (
      'CONTACT', 'LINE_REGISTERED', 'SALON_TOUR', 'INTERVIEW',
      'PASSED', 'OFFER', 'EXPECTED_JOIN', 'WITHDRAWN'
    )
    or p_expected_version is null
    or p_expected_version < 0
  then
    raise exception using errcode = '22023', message = 'invalid_student_profile';
  end if;

  if p_application_no is null then
    if p_expected_version <> 0 then
      raise exception using errcode = '22023', message = 'invalid_create_version';
    end if;
    insert into public.nov_talent_applications_v1 default values
    returning application_id, application_no
    into v_application_id, v_application_no;
  else
    if p_application_no !~ '^NT-[0-9]{4}-[0-9]{6}$' then
      raise exception using errcode = '22023', message = 'invalid_application_no';
    end if;
    select a.application_id, a.application_no
    into strict v_application_id, v_application_no
    from public.nov_talent_applications_v1 a
    where a.application_no = p_application_no;
  end if;

  select p.*
  into v_existing
  from public.nov_talent_student_profiles_v1 p
  where p.application_id = v_application_id
  for update;

  if not found then
    if p_expected_version <> 0 then
      raise exception using errcode = '40001', message = 'profile_version_conflict';
    end if;
    insert into public.nov_talent_student_profiles_v1(
      application_id, display_name, kana, school, phone, email,
      preferred_store, current_status, next_action_at, updated_by_employee_id
    ) values (
      v_application_id, p_display_name, p_kana, p_school, p_phone, p_email,
      p_preferred_store, p_current_status, p_next_action_at, p_actor_employee_id
    )
    returning version into v_version;
    v_changed_fields := array[
      'displayName', 'kana', 'school', 'phone', 'email',
      'preferredStore', 'currentStatus', 'nextActionAt'
    ];
    v_operation := 'CREATE';
  else
    if v_existing.version <> p_expected_version then
      raise exception using errcode = '40001', message = 'profile_version_conflict';
    end if;
    if v_existing.display_name is distinct from p_display_name then v_changed_fields := array_append(v_changed_fields, 'displayName'); end if;
    if v_existing.kana is distinct from p_kana then v_changed_fields := array_append(v_changed_fields, 'kana'); end if;
    if v_existing.school is distinct from p_school then v_changed_fields := array_append(v_changed_fields, 'school'); end if;
    if v_existing.phone is distinct from p_phone then v_changed_fields := array_append(v_changed_fields, 'phone'); end if;
    if v_existing.email is distinct from p_email then v_changed_fields := array_append(v_changed_fields, 'email'); end if;
    if v_existing.preferred_store is distinct from p_preferred_store then v_changed_fields := array_append(v_changed_fields, 'preferredStore'); end if;
    if v_existing.current_status is distinct from p_current_status then v_changed_fields := array_append(v_changed_fields, 'currentStatus'); end if;
    if v_existing.next_action_at is distinct from p_next_action_at then v_changed_fields := array_append(v_changed_fields, 'nextActionAt'); end if;
    if cardinality(v_changed_fields) = 0 then
      raise exception using errcode = '22023', message = 'profile_unchanged';
    end if;
    update public.nov_talent_student_profiles_v1
    set display_name = p_display_name,
      kana = p_kana,
      school = p_school,
      phone = p_phone,
      email = p_email,
      preferred_store = p_preferred_store,
      current_status = p_current_status,
      next_action_at = p_next_action_at,
      version = version + 1,
      updated_by_employee_id = p_actor_employee_id,
      updated_at = now()
    where application_id = v_application_id
      and version = p_expected_version
    returning version into v_version;
    if not found then
      raise exception using errcode = '40001', message = 'profile_version_conflict';
    end if;
    v_operation := 'UPDATE';
  end if;

  insert into public.nov_talent_student_profile_audit_v1(
    application_id, action, changed_fields, actor_employee_id, profile_version
  ) values (
    v_application_id, v_operation, v_changed_fields, p_actor_employee_id, v_version
  );

  return query select v_application_no, v_version, v_operation;
exception
  when no_data_found or too_many_rows then
    raise exception using errcode = '55000', message = 'application_not_exact1';
end
$function$;

create or replace function public.get_nov_talent_staging_workspace_v1(
  p_employee_id uuid,
  p_fiscal_year smallint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_batch_id uuid;
  v_rows jsonb;
  v_manual_rows jsonb;
begin
  if p_fiscal_year <> 2027 then
    raise exception using errcode = '22023', message = 'unsupported_fiscal_year';
  end if;
  perform public.assert_nov_talent_accountable_owner_v1(p_employee_id);

  select b.batch_id into strict v_batch_id
  from public.nov_talent_historical_import_batches_v1 b
  where b.state = 'OPEN' and b.dry_run_only and b.sealed_at is null;

  select coalesce(
    jsonb_agg(to_jsonb(projected) order by projected.created_at, projected.staging_record_id),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      r.staging_record_id,
      r.source_sheet_code,
      r.source_payload,
      r.classification,
      r.reason_codes,
      r.business_date,
      r.created_at,
      jsonb_build_object(
        'mapping_status', m.mapping_status,
        'application_no', a.application_no,
        'source_key_status', k.source_key_status,
        'legacy_no_present', nullif(btrim(k.legacy_no), '') is not null,
        'profile', case when p.application_id is null then null else jsonb_build_object(
          'display_name', p.display_name,
          'kana', p.kana,
          'school', p.school,
          'phone', p.phone,
          'email', p.email,
          'preferred_store', p.preferred_store,
          'current_status', p.current_status,
          'next_action_at', p.next_action_at,
          'version', p.version
        ) end
      ) as mapping
    from public.nov_talent_historical_staging_records_v1 r
    join public.nov_talent_historical_application_mappings_v1 m using (staging_record_id)
    join public.nov_talent_historical_source_keys_v1 k using (staging_record_id)
    left join public.nov_talent_applications_v1 a on a.application_id = m.canonical_application_id
    left join public.nov_talent_student_profiles_v1 p on p.application_id = a.application_id
    where r.batch_id = v_batch_id
      and r.source_sheet_code in ('CONTACTS_27', 'ENTRIES_27', 'OFFERS_27')
    order by r.created_at, r.staging_record_id
    limit 1000
  ) projected;

  select coalesce(jsonb_agg(jsonb_build_object(
    'application_id', a.application_id,
    'application_no', a.application_no,
    'display_name', p.display_name,
    'kana', p.kana,
    'school', p.school,
    'phone', p.phone,
    'email', p.email,
    'preferred_store', p.preferred_store,
    'current_status', p.current_status,
    'next_action_at', p.next_action_at,
    'version', p.version,
    'created_at', p.created_at
  ) order by p.created_at, a.application_id), '[]'::jsonb)
  into v_manual_rows
  from public.nov_talent_student_profiles_v1 p
  join public.nov_talent_applications_v1 a using (application_id)
  where not exists (
    select 1
    from public.nov_talent_historical_application_mappings_v1 m
    where m.canonical_application_id = a.application_id
  );

  return jsonb_build_object('rows', v_rows, 'manualRows', v_manual_rows);
exception
  when no_data_found or too_many_rows then
    raise exception using errcode = '55000', message = 'accepted_batch_not_exact1';
end
$function$;

revoke all on function public.save_nov_talent_student_profile_v1(
  uuid, text, integer, text, text, text, text, text, text, text, date
) from public, anon, authenticated;
grant execute on function public.save_nov_talent_student_profile_v1(
  uuid, text, integer, text, text, text, text, text, text, text, date
) to service_role;

revoke all on function public.get_nov_talent_staging_workspace_v1(uuid, smallint)
  from public, anon, authenticated;
grant execute on function public.get_nov_talent_staging_workspace_v1(uuid, smallint)
  to service_role;

commit;
