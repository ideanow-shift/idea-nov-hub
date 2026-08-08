begin;

-- Outcome 1: formal recruiting facts for idea-nov-staging.
-- No historical rows are inferred, rewritten, or backfilled by this migration.

alter table public.nov_talent_candidates_v1
  add column current_status_projection_source text not null default 'LEGACY'
    check (current_status_projection_source in ('LEGACY', 'INITIAL', 'SELECTION_HISTORY')),
  add column current_status_selection_history_id uuid
    references public.nov_talent_selection_history_v1(selection_history_id) on delete restrict,
  add column current_status_projected_at timestamptz,
  add constraint nov_talent_candidates_v1_status_projection_shape check (
    (current_status_projection_source = 'SELECTION_HISTORY'
      and current_status_selection_history_id is not null
      and current_status_projected_at is not null)
    or
    (current_status_projection_source in ('LEGACY', 'INITIAL')
      and current_status_selection_history_id is null
      and current_status_projected_at is null)
  );

create index nov_talent_candidates_v1_status_projection
  on public.nov_talent_candidates_v1 (current_status_selection_history_id)
  where current_status_selection_history_id is not null;

comment on column public.nov_talent_candidates_v1.current_status_code is
  'Display projection. Official selection facts live only in nov_talent_selection_history_v1.';
comment on column public.nov_talent_candidates_v1.current_status_projection_source is
  'LEGACY for pre-Outcome-1 rows, INITIAL for a new Candidate initial state, or SELECTION_HISTORY for a deterministic official projection.';

create or replace function nov_talent_internal.candidate_audit_snapshot_v1(
  p_row public.nov_talent_candidates_v1
)
returns jsonb
language sql
immutable
set search_path = ''
as $function$
  select jsonb_strip_nulls(jsonb_build_object(
    'graduationYear', p_row.graduation_year,
    'displayName', p_row.student_name,
    'kana', p_row.student_name_kana,
    'school', p_row.school_name,
    'faculty', p_row.faculty_name,
    'phone', p_row.phone,
    'email', p_row.email,
    'lineIdentifier', p_row.line_identifier,
    'currentStatus', p_row.current_status_code,
    'currentStatusProjectionSource', p_row.current_status_projection_source,
    'currentStatusSelectionHistoryId', p_row.current_status_selection_history_id,
    'currentStatusProjectedAt', p_row.current_status_projected_at,
    'acquisitionSource', p_row.acquisition_source,
    'assignedTo', p_row.assigned_to,
    'notes', p_row.notes,
    'isActive', p_row.is_active
  ));
$function$;

create or replace function public.nov_talent_create_candidate_v1(
  p_actor_employee_id uuid, p_actor_role text, p_reason text, p_graduation_year smallint,
  p_student_name text, p_student_name_kana text, p_school_name text, p_faculty_name text,
  p_phone text, p_email text, p_line_identifier text, p_current_status_code text,
  p_acquisition_source text, p_assigned_to text, p_notes text
)
returns table(candidate_id uuid, candidate_version integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.nov_talent_candidates_v1%rowtype;
  v_role text := lower(coalesce(p_actor_role, ''));
begin
  if v_role not in ('super_admin', 'backoffice', 'hr.admin', 'hr.staff')
    or p_actor_employee_id is null then
    raise exception using errcode = '42501', message = 'candidate_write_forbidden';
  end if;
  if nullif(btrim(p_reason), '') is null
    or char_length(btrim(p_reason)) > 500
    or p_current_status_code is not null
  then
    raise exception using errcode = '22023', message = 'candidate_initial_state_invalid';
  end if;
  insert into public.nov_talent_candidates_v1 (
    graduation_year, student_name, student_name_kana, school_name, faculty_name,
    phone, email, line_identifier, current_status_code,
    current_status_projection_source, acquisition_source, assigned_to, notes,
    source_type, created_by_employee_id, updated_by_employee_id
  ) values (
    p_graduation_year, btrim(p_student_name), nullif(btrim(p_student_name_kana), ''),
    nullif(btrim(p_school_name), ''), nullif(btrim(p_faculty_name), ''),
    nullif(btrim(p_phone), ''), nullif(lower(btrim(p_email)), ''),
    nullif(btrim(p_line_identifier), ''), p_current_status_code,
    'INITIAL', nullif(btrim(p_acquisition_source), ''),
    nullif(btrim(p_assigned_to), ''), nullif(btrim(p_notes), ''),
    'NOV_TALENT_UI', p_actor_employee_id, p_actor_employee_id
  ) returning * into v_row;
  insert into public.nov_talent_candidate_audit_log_v1 (
    candidate_id, action, changed_fields, before_values, after_values,
    actor_employee_id, actor_role, reason, candidate_version
  ) values (
    v_row.candidate_id, 'CREATE', array['candidate'], '{}'::jsonb,
    nov_talent_internal.candidate_audit_snapshot_v1(v_row),
    p_actor_employee_id, v_role, btrim(p_reason), v_row.version
  );
  return query select v_row.candidate_id, v_row.version;
end
$function$;

-- Event owns contact, LINE, salon-tour, and communication facts. Existing
-- reverse-source legacy rows remain readable, but cannot be promoted or edited.
alter table public.nov_talent_recruitment_events_v1
  drop constraint if exists nov_talent_recruitment_events_v1_event_code_check;

create or replace function nov_talent_internal.guard_official_recruitment_event_v1()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_allowed constant text[] := array[
    'CONTACT_RECORDED', 'LINE_REGISTERED',
    'SALON_TOUR_PLANNED', 'SALON_TOUR_COMPLETED',
    'COMMUNICATION_RECORDED'
  ];
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'recruitment_event_physical_delete_forbidden';
  end if;

  if tg_op = 'INSERT' and not (new.event_code = any(v_allowed)) then
    raise exception using errcode = '23514', message = 'event_fact_domain_invalid';
  end if;

  if tg_op = 'UPDATE' then
    if old.event_code = any(v_allowed) then
      if not (new.event_code = any(v_allowed)) then
        raise exception using errcode = '23514', message = 'event_fact_domain_invalid';
      end if;
    elsif new.event_code is distinct from old.event_code
      or new.candidate_id is distinct from old.candidate_id
      or new.event_date is distinct from old.event_date
      or new.event_name is distinct from old.event_name
      or new.event_state is distinct from old.event_state
      or new.contact_content is distinct from old.contact_content
      or new.assigned_to is distinct from old.assigned_to
      or new.notes is distinct from old.notes
    then
      raise exception using errcode = '55000', message = 'legacy_event_fact_read_only';
    end if;
  end if;

  return new;
end
$function$;

drop trigger if exists guard_official_recruitment_event_v1
  on public.nov_talent_recruitment_events_v1;
create trigger guard_official_recruitment_event_v1
before insert or update or delete on public.nov_talent_recruitment_events_v1
for each row execute function nov_talent_internal.guard_official_recruitment_event_v1();

-- Selection History is append-only and owns application, interview, offer,
-- acceptance, withdrawal, and rejection facts. Only the dedicated transaction
-- RPC may append a new official row.
alter table public.nov_talent_selection_history_v1
  drop constraint if exists nov_talent_selection_history_v1_selection_code_check;

create or replace function nov_talent_internal.guard_official_selection_append_v1()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_allowed constant text[] := array[
    'APPLICATION_RECEIVED', 'INTERVIEW_PLANNED', 'INTERVIEW_COMPLETED',
    'OFFERED', 'OFFER_ACCEPTED', 'WITHDRAWN', 'REJECTED'
  ];
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception using errcode = '55000', message = 'selection_history_append_only';
  end if;
  if current_setting('nov_talent.selection_append_v1', true) is distinct from 'allowed' then
    raise exception using errcode = '42501', message = 'selection_append_rpc_required';
  end if;
  if not (new.selection_code = any(v_allowed)) then
    raise exception using errcode = '23514', message = 'selection_fact_domain_invalid';
  end if;
  return new;
end
$function$;

drop trigger if exists guard_official_selection_append_v1
  on public.nov_talent_selection_history_v1;
create trigger guard_official_selection_append_v1
before insert or update or delete on public.nov_talent_selection_history_v1
for each row execute function nov_talent_internal.guard_official_selection_append_v1();

create or replace function nov_talent_internal.block_recruitment_activity_audit_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception using errcode = '55000', message = 'recruitment_activity_audit_append_only';
end
$function$;

drop trigger if exists block_recruitment_activity_audit_mutation_v1
  on public.nov_talent_recruitment_activity_audit_v1;
create trigger block_recruitment_activity_audit_mutation_v1
before update or delete on public.nov_talent_recruitment_activity_audit_v1
for each row execute function nov_talent_internal.block_recruitment_activity_audit_mutation_v1();

create or replace function public.nov_talent_append_selection_transition_v1(
  p_actor_employee_id uuid,
  p_actor_role text,
  p_reason text,
  p_candidate_id uuid,
  p_expected_candidate_version integer,
  p_selection_code text,
  p_effective_date date,
  p_assigned_to text,
  p_notes text
)
returns table(
  selection_history_id uuid,
  selection_version integer,
  candidate_version integer,
  projected_status_code text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate_old public.nov_talent_candidates_v1%rowtype;
  v_candidate_new public.nov_talent_candidates_v1%rowtype;
  v_selection public.nov_talent_selection_history_v1%rowtype;
  v_projection public.nov_talent_selection_history_v1%rowtype;
  v_role text := lower(coalesce(p_actor_role, ''));
begin
  if v_role not in ('super_admin', 'backoffice', 'hr.admin', 'hr.staff') then
    raise exception using errcode = '42501', message = 'selection_write_forbidden';
  end if;
  if p_actor_employee_id is null then
    raise exception using errcode = '22023', message = 'actor_identity_required';
  end if;
  if nullif(btrim(p_reason), '') is null
    or char_length(btrim(p_reason)) > 500
    or p_effective_date is null
    or p_selection_code not in (
      'APPLICATION_RECEIVED', 'INTERVIEW_PLANNED', 'INTERVIEW_COMPLETED',
      'OFFERED', 'OFFER_ACCEPTED', 'WITHDRAWN', 'REJECTED'
    )
  then
    raise exception using errcode = '22023', message = 'selection_transition_invalid';
  end if;

  select c.*
  into strict v_candidate_old
  from public.nov_talent_candidates_v1 c
  where c.candidate_id = p_candidate_id
    and c.is_active
  for update;

  if v_candidate_old.version <> p_expected_candidate_version then
    raise exception using errcode = '40001', message = 'candidate_version_conflict';
  end if;

  perform set_config('nov_talent.selection_append_v1', 'allowed', true);
  insert into public.nov_talent_selection_history_v1 (
    candidate_id, selection_code, effective_date, source_type, source_row_no,
    source_field_code, source_fingerprint, assigned_to, notes,
    created_by_employee_id, updated_by_employee_id
  ) values (
    p_candidate_id, p_selection_code, p_effective_date, 'NOV_TALENT_UI', null,
    p_selection_code, null, nullif(btrim(p_assigned_to), ''), nullif(btrim(p_notes), ''),
    p_actor_employee_id, p_actor_employee_id
  ) returning * into v_selection;

  select s.*
  into strict v_projection
  from public.nov_talent_selection_history_v1 s
  where s.candidate_id = p_candidate_id
    and s.is_active
    and s.selection_code in (
      'APPLICATION_RECEIVED', 'INTERVIEW_PLANNED', 'INTERVIEW_COMPLETED',
      'OFFERED', 'OFFER_ACCEPTED', 'WITHDRAWN', 'REJECTED'
    )
  -- Selection codes are non-ordinal facts. Do not infer a workflow or assign
  -- semantic rank: the display projection is only the latest effective fact.
  order by s.effective_date desc, s.created_at desc, s.selection_history_id desc
  limit 1;

  update public.nov_talent_candidates_v1 c
  set current_status_code = v_projection.selection_code,
      current_status_projection_source = 'SELECTION_HISTORY',
      current_status_selection_history_id = v_projection.selection_history_id,
      current_status_projected_at = now(),
      version = c.version + 1,
      updated_by_employee_id = p_actor_employee_id,
      updated_at = now()
  where c.candidate_id = p_candidate_id
  returning c.* into v_candidate_new;

  insert into public.nov_talent_recruitment_activity_audit_v1 (
    candidate_id, entity_type, entity_id, action, changed_fields,
    before_values, after_values, actor_employee_id, actor_role, reason,
    entity_version
  ) values (
    p_candidate_id, 'SELECTION', v_selection.selection_history_id::text, 'CREATE',
    array['selectionHistory'], '{}'::jsonb,
    jsonb_build_object(
      'selectionCode', v_selection.selection_code,
      'effectiveDate', v_selection.effective_date,
      'projectionApplied', v_projection.selection_history_id = v_selection.selection_history_id
    ),
    p_actor_employee_id, v_role, btrim(p_reason), v_selection.version
  );

  insert into public.nov_talent_candidate_audit_log_v1 (
    candidate_id, action, changed_fields, before_values, after_values,
    actor_employee_id, actor_role, reason, candidate_version
  ) values (
    p_candidate_id,
    case when v_candidate_old.current_status_code is distinct from v_candidate_new.current_status_code
      then 'STATUS_CHANGE' else 'UPDATE' end,
    array['currentStatusProjection'],
    nov_talent_internal.candidate_audit_snapshot_v1(v_candidate_old),
    nov_talent_internal.candidate_audit_snapshot_v1(v_candidate_new),
    p_actor_employee_id, v_role, btrim(p_reason), v_candidate_new.version
  );

  return query select
    v_selection.selection_history_id,
    v_selection.version,
    v_candidate_new.version,
    v_candidate_new.current_status_code;
exception
  when no_data_found then
    raise exception using errcode = 'P0002', message = 'candidate_not_found';
end
$function$;

-- Source Fact remains immutable evidence. Linking is explicit, versioned, and
-- audited, but never creates Selection History or enters an official KPI.
alter table public.nov_talent_recruitment_source_facts_v1
  add column evidence_reference text
    check (evidence_reference is null or (
      char_length(evidence_reference) between 1 and 300
      and evidence_reference ~ '^[A-Z0-9_:-]+$'
    )),
  add column evidence_hash text
    check (evidence_hash is null or evidence_hash ~ '^[0-9a-f]{64}$'),
  add column resolution_method text
    check (resolution_method is null or resolution_method in ('EXACT_STABLE', 'HUMAN_CONFIRMED'));

create or replace function nov_talent_internal.guard_source_fact_evidence_v2()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'source_fact_evidence_delete_forbidden';
  end if;
  if current_setting('nov_talent.source_fact_link_v2', true) is distinct from 'allowed' then
    raise exception using errcode = '42501', message = 'source_fact_link_rpc_required';
  end if;
  if old.candidate_id is not null
    or new.candidate_id is null
    or new.candidate_id is not distinct from old.candidate_id
    or new.version <> old.version + 1
    or new.linked_at is null
    or new.linked_by_employee_id is null
    or nullif(btrim(new.link_reason), '') is null
    or nullif(btrim(new.evidence_reference), '') is null
    or new.evidence_hash is null
    or new.resolution_method is null
    or (to_jsonb(new) - array[
      'candidate_id', 'linked_at', 'linked_by_employee_id',
      'link_reason', 'evidence_reference', 'evidence_hash',
      'resolution_method', 'version'
    ]) is distinct from (to_jsonb(old) - array[
      'candidate_id', 'linked_at', 'linked_by_employee_id',
      'link_reason', 'evidence_reference', 'evidence_hash',
      'resolution_method', 'version'
    ])
  then
    raise exception using errcode = '55000', message = 'source_fact_evidence_immutable';
  end if;
  return new;
end
$function$;

drop trigger if exists guard_source_fact_evidence_v2
  on public.nov_talent_recruitment_source_facts_v1;
create trigger guard_source_fact_evidence_v2
before update or delete on public.nov_talent_recruitment_source_facts_v1
for each row execute function nov_talent_internal.guard_source_fact_evidence_v2();

create or replace function public.nov_talent_link_source_fact_v2(
  p_actor_employee_id uuid,
  p_actor_role text,
  p_reason text,
  p_source_type text,
  p_source_row_no integer,
  p_fact_code text,
  p_candidate_id uuid,
  p_expected_candidate_version integer,
  p_expected_source_version integer,
  p_evidence_reference text,
  p_resolution_method text
)
returns table(
  source_row_no integer,
  source_version integer,
  candidate_version integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate public.nov_talent_candidates_v1%rowtype;
  v_source_old public.nov_talent_recruitment_source_facts_v1%rowtype;
  v_source_new public.nov_talent_recruitment_source_facts_v1%rowtype;
  v_role text := lower(coalesce(p_actor_role, ''));
  v_canonical_reference text;
begin
  v_canonical_reference := concat(
    'SOURCE:', p_source_type, ':ROW:', p_source_row_no, ':', p_fact_code
  );
  if v_role not in ('super_admin', 'backoffice', 'hr.admin', 'hr.staff') then
    raise exception using errcode = '42501', message = 'source_fact_link_forbidden';
  end if;
  if p_actor_employee_id is null
    or nullif(btrim(p_reason), '') is null
    or char_length(btrim(p_reason)) > 500
    or p_source_type not in ('ENTRIES_27', 'OFFERS_27')
    or p_fact_code not in (
      'APPLICATION_RECEIVED', 'INTERVIEW_PLANNED', 'INTERVIEW_COMPLETED',
      'OFFERED', 'OFFER_ACCEPTED', 'WITHDRAWN', 'REJECTED'
    )
    or p_source_row_no < 1
    or p_evidence_reference is distinct from v_canonical_reference
    or p_resolution_method not in ('EXACT_STABLE', 'HUMAN_CONFIRMED')
  then
    raise exception using errcode = '22023', message = 'source_fact_link_invalid';
  end if;

  select c.*
  into strict v_candidate
  from public.nov_talent_candidates_v1 c
  where c.candidate_id = p_candidate_id
    and c.is_active
  for update;
  if v_candidate.version <> p_expected_candidate_version then
    raise exception using errcode = '40001', message = 'candidate_version_conflict';
  end if;

  select f.*
  into strict v_source_old
  from public.nov_talent_recruitment_source_facts_v1 f
  where f.source_type = p_source_type
    and f.source_row_no = p_source_row_no
    and f.fact_code = p_fact_code
  for update;
  if v_source_old.version <> p_expected_source_version
    or v_source_old.candidate_id is not null
  then
    raise exception using errcode = '40001', message = 'source_fact_version_conflict';
  end if;

  perform set_config('nov_talent.source_fact_link_v2', 'allowed', true);
  update public.nov_talent_recruitment_source_facts_v1 f
  set candidate_id = p_candidate_id,
      linked_at = now(),
      linked_by_employee_id = p_actor_employee_id,
      link_reason = btrim(p_reason),
      evidence_reference = p_evidence_reference,
      evidence_hash = v_source_old.source_fingerprint,
      resolution_method = p_resolution_method,
      version = f.version + 1
  where f.source_type = p_source_type
    and f.source_row_no = p_source_row_no
    and f.fact_code = p_fact_code
  returning f.* into v_source_new;

  insert into public.nov_talent_recruitment_activity_audit_v1 (
    candidate_id, entity_type, entity_id, action, changed_fields,
    before_values, after_values, actor_employee_id, actor_role, reason,
    entity_version
  ) values (
    p_candidate_id, 'SOURCE_FACT_LINK',
    concat(p_source_type, ':', p_source_row_no, ':', p_fact_code),
    'LINK', array['candidateLink', 'evidenceReference', 'resolutionMethod'],
    jsonb_build_object('linked', false),
    jsonb_build_object(
      'linked', true,
      'evidenceReference', p_evidence_reference,
      'evidenceHash', v_source_old.source_fingerprint,
      'resolutionMethod', p_resolution_method
    ),
    p_actor_employee_id, v_role, btrim(p_reason), v_source_new.version
  );

  return query select v_source_new.source_row_no, v_source_new.version, v_candidate.version;
exception
  when no_data_found then
    raise exception using errcode = 'P0002', message = 'source_fact_or_candidate_not_found';
end
$function$;

-- Candidate profile edits may change descriptive fields, but status is now a
-- projection and cannot be written through the generic Candidate RPC.
create or replace function public.nov_talent_update_candidate_v1(
  p_actor_employee_id uuid, p_actor_role text, p_reason text, p_candidate_id uuid, p_expected_version integer,
  p_graduation_year smallint, p_student_name text, p_student_name_kana text, p_school_name text,
  p_faculty_name text, p_phone text, p_email text, p_line_identifier text, p_current_status_code text,
  p_acquisition_source text, p_assigned_to text, p_notes text
)
returns table(candidate_id uuid, candidate_version integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old public.nov_talent_candidates_v1%rowtype;
  v_new public.nov_talent_candidates_v1%rowtype;
  v_role text := lower(coalesce(p_actor_role, ''));
begin
  if v_role not in ('super_admin', 'backoffice', 'hr.admin', 'hr.staff')
    or p_actor_employee_id is null
    or nullif(btrim(p_reason), '') is null
    or char_length(btrim(p_reason)) > 500
  then
    raise exception using errcode = '42501', message = 'candidate_write_forbidden';
  end if;
  select c.* into strict v_old
  from public.nov_talent_candidates_v1 c
  where c.candidate_id = p_candidate_id and c.is_active
  for update;
  if v_old.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'candidate_version_conflict';
  end if;
  if p_current_status_code is distinct from v_old.current_status_code then
    raise exception using errcode = '42501', message = 'candidate_status_projection_write_forbidden';
  end if;

  update public.nov_talent_candidates_v1 c
  set graduation_year = p_graduation_year,
      student_name = btrim(p_student_name),
      student_name_kana = nullif(btrim(p_student_name_kana), ''),
      school_name = nullif(btrim(p_school_name), ''),
      faculty_name = nullif(btrim(p_faculty_name), ''),
      phone = nullif(btrim(p_phone), ''),
      email = nullif(lower(btrim(p_email)), ''),
      line_identifier = nullif(btrim(p_line_identifier), ''),
      acquisition_source = nullif(btrim(p_acquisition_source), ''),
      assigned_to = nullif(btrim(p_assigned_to), ''),
      notes = nullif(btrim(p_notes), ''),
      version = c.version + 1,
      updated_by_employee_id = p_actor_employee_id,
      updated_at = now()
  where c.candidate_id = p_candidate_id
  returning c.* into v_new;

  insert into public.nov_talent_candidate_audit_log_v1 (
    candidate_id, action, changed_fields, before_values, after_values,
    actor_employee_id, actor_role, reason, candidate_version
  ) values (
    p_candidate_id, 'UPDATE', array['candidate'],
    nov_talent_internal.candidate_audit_snapshot_v1(v_old),
    nov_talent_internal.candidate_audit_snapshot_v1(v_new),
    p_actor_employee_id, v_role, btrim(p_reason), v_new.version
  );
  return query select p_candidate_id, v_new.version;
exception
  when no_data_found then
    raise exception using errcode = 'P0002', message = 'candidate_not_found';
end
$function$;

alter table public.nov_talent_recruitment_events_v1 force row level security;
alter table public.nov_talent_selection_history_v1 force row level security;
alter table public.nov_talent_recruitment_source_facts_v1 force row level security;
alter table public.nov_talent_recruitment_activity_audit_v1 force row level security;
alter table public.nov_talent_candidates_v1 force row level security;

revoke all on public.nov_talent_recruitment_events_v1
  from public, anon, authenticated, service_role;
revoke all on public.nov_talent_selection_history_v1
  from public, anon, authenticated, service_role;
revoke all on public.nov_talent_recruitment_source_facts_v1
  from public, anon, authenticated, service_role;
revoke all on public.nov_talent_recruitment_activity_audit_v1
  from public, anon, authenticated, service_role;
revoke all on public.nov_talent_candidates_v1
  from public, anon, authenticated, service_role;

-- Direct table writes are prohibited. SECURITY DEFINER RPCs are the only
-- write surface; the Edge Function uses service_role only for reads and RPC.
grant select on public.nov_talent_recruitment_events_v1 to service_role;
grant select on public.nov_talent_selection_history_v1 to service_role;
grant select on public.nov_talent_recruitment_source_facts_v1 to service_role;
grant select on public.nov_talent_recruitment_activity_audit_v1 to service_role;
grant select on public.nov_talent_candidates_v1 to service_role;

-- The legacy Source Fact RPC cannot prove Candidate concurrency or a stable
-- evidence reference and is therefore retired. The generic activity RPC is
-- retained for Event / Next Action only; Selection writes hit the append-only
-- trigger and fail closed.
revoke execute on function public.nov_talent_link_source_fact_v1(
  uuid, text, text, text, integer, text, uuid, integer
) from service_role;

revoke all on function nov_talent_internal.guard_official_recruitment_event_v1()
  from public, anon, authenticated;
revoke all on function nov_talent_internal.guard_official_selection_append_v1()
  from public, anon, authenticated;
revoke all on function nov_talent_internal.block_recruitment_activity_audit_mutation_v1()
  from public, anon, authenticated;
revoke all on function nov_talent_internal.guard_source_fact_evidence_v2()
  from public, anon, authenticated;
revoke all on function public.nov_talent_append_selection_transition_v1(
  uuid, text, text, uuid, integer, text, date, text, text
) from public, anon, authenticated;
revoke all on function public.nov_talent_link_source_fact_v2(
  uuid, text, text, text, integer, text, uuid, integer, integer, text, text
) from public, anon, authenticated;

grant execute on function public.nov_talent_append_selection_transition_v1(
  uuid, text, text, uuid, integer, text, date, text, text
) to service_role;
grant execute on function public.nov_talent_link_source_fact_v2(
  uuid, text, text, text, integer, text, uuid, integer, integer, text, text
) to service_role;

comment on table public.nov_talent_selection_history_v1 is
  'Append-only official Selection facts: application, interview, offer, acceptance, withdrawal, and rejection.';
comment on table public.nov_talent_recruitment_events_v1 is
  'Official Event facts: contact, LINE registration, salon tour, and communication. Legacy reverse-source rows are read-only.';
comment on table public.nov_talent_recruitment_source_facts_v1 is
  'Immutable unlinked evidence. A Candidate link does not promote evidence into Selection History or an official KPI.';
comment on function public.nov_talent_append_selection_transition_v1(
  uuid, text, text, uuid, integer, text, date, text, text
) is 'Atomically appends one official Selection fact and refreshes Candidate current status as a deterministic projection.';

commit;
