-- NOV Talent Fair Attribution Queue Population v2 executor.
-- Authoring only. This migration does not populate any business row.
-- The command is deliberately exposed only to service_role and can run only
-- through the idea-nov-staging PostgREST host.

begin;

create or replace function public.nov_talent_population_fair_attribution_queue_v2(
  p_actor_employee_id uuid,
  p_actor_role text,
  p_environment text,
  p_manifest_file_sha256 text,
  p_manifest jsonb
)
returns table(
  attribution_count integer,
  audit_count integer,
  manifest_canonical_payload_sha256 text
)
language plpgsql
security definer
set search_path = ''
as $executor$
declare
  v_headers jsonb := '{}'::jsonb;
  v_claims jsonb := '{}'::jsonb;
  v_host text := '';
  v_jwt_role text := '';
  v_existing_attribution_count bigint;
  v_existing_audit_count bigint;
  v_existing_confirmed_count bigint;
  v_candidate_total bigint;
  v_candidate_2027 bigint;
  v_candidate_2028 bigint;
  v_candidate_snapshot_sha256 text;
  v_fair_total bigint;
  v_fair_active bigint;
  v_fair_inactive bigint;
  v_fair_snapshot_sha256 text;
  v_case_count bigint;
  v_pair_count bigint;
  v_single_count bigint;
  v_multiple_count bigint;
  v_duplicate_pair_count bigint;
  v_pair_payload_sha256 text;
  v_missing_candidate_count bigint;
  v_missing_or_inactive_fair_count bigint;
  v_attribution_count integer;
  v_audit_count integer;
begin
  -- One transaction-scoped lock serializes every population attempt. There is
  -- no retry path and the second invocation sees non-zero existing state.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nov_talent_fair_attribution_population_v2', 0)
  );

  begin
    v_headers := coalesce(nullif(pg_catalog.current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  begin
    v_claims := coalesce(nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    v_claims := '{}'::jsonb;
  end;
  v_host := lower(coalesce(v_headers->>'host', ''));
  v_jwt_role := lower(coalesce(v_claims->>'role', ''));

  if v_host <> 'zgkoofphhivesclehrom.supabase.co' then
    raise exception using errcode = '42501', message = 'population_v2_staging_host_required';
  end if;
  if v_jwt_role <> 'service_role' then
    raise exception using errcode = '42501', message = 'population_v2_service_role_required';
  end if;
  if p_environment is distinct from 'idea-nov-staging' then
    raise exception using errcode = '42501', message = 'population_v2_staging_environment_required';
  end if;
  if p_actor_employee_id is null or lower(coalesce(p_actor_role, '')) not in ('super_admin', 'backoffice', 'hr.admin') then
    raise exception using errcode = '42501', message = 'population_v2_actor_forbidden';
  end if;
  if p_manifest_file_sha256 is distinct from 'ecbadebb2a4b6bb6e0d4484193bd4088bc9f36ebf9fdbe8b56f8634be604d34b' then
    raise exception using errcode = '22023', message = 'population_v2_manifest_file_hash_mismatch';
  end if;
  if jsonb_typeof(p_manifest) <> 'object'
    or p_manifest->>'manifest_version' is distinct from 'fair-attribution-queue-population-manifest-v2'
    or p_manifest->>'source_contract_version' is distinct from 'fair-attribution-source-hash-contract-v1'
    or p_manifest->>'grouping_contract_version' is distinct from 'fair-attribution-grouping-contract-v1'
    or p_manifest->>'manifest_canonical_payload_sha256' is distinct from 'db225936b21cd026496dba583aaae8b7ef215cc00fb54bc686698044506e0c53'
    or p_manifest#>>'{source,source_range_sha256}' is distinct from '394728af93cee9beaa56e38df23a716e8ccbedfc0ec37bb490263370e2d843d9'
    or p_manifest#>>'{candidate_snapshot,contract_version}' is distinct from 'fair-attribution-candidate-snapshot-v1'
    or p_manifest#>>'{candidate_snapshot,snapshot_sha256}' is distinct from '01783932dc8cae65ef840dfa1e43becc41ebbb0e536b972d43017cadc141d1a3'
    or p_manifest#>>'{fair_snapshot,contract_version}' is distinct from 'fair-attribution-fair-snapshot-v1'
    or p_manifest#>>'{fair_snapshot,snapshot_sha256}' is distinct from '766ba161ce59d326599c641e9d8531b19482bfd25dfa1ff2714bde240a8beca3'
    or p_manifest#>>'{validation,result}' is distinct from 'PASS'
  then
    raise exception using errcode = '22023', message = 'population_v2_manifest_contract_invalid';
  end if;

  if coalesce((p_manifest#>>'{population_counts,logical_candidate_count}')::integer, -1) <> 161
    or coalesce((p_manifest#>>'{population_counts,single_candidate_count}')::integer, -1) <> 121
    or coalesce((p_manifest#>>'{population_counts,multiple_candidate_count}')::integer, -1) <> 40
    or coalesce((p_manifest#>>'{population_counts,physical_pending_row_count}')::integer, -1) <> 201
    or coalesce((p_manifest#>>'{population_counts,max_fair_candidates_per_candidate}')::integer, -1) <> 2
    or coalesce((p_manifest#>>'{population_counts,excluded_non_fair_count}')::integer, -1) <> 367
    or coalesce((p_manifest#>>'{validation,candidate_unresolved_count}')::integer, -1) <> 0
    or coalesce((p_manifest#>>'{validation,inactive_fair_count}')::integer, -1) <> 0
    or coalesce((p_manifest#>>'{validation,orphan_fair_count}')::integer, -1) <> 0
    or coalesce((p_manifest#>>'{validation,duplicate_candidate_fair_pair_count}')::integer, -1) <> 0
    or coalesce((p_manifest#>>'{validation,source_evidence_missing_count}')::integer, -1) <> 0
    or coalesce((p_manifest#>>'{validation,invalid_attribution_count}')::integer, -1) <> 0
  then
    raise exception using errcode = '22023', message = 'population_v2_manifest_gate_not_pass';
  end if;

  if jsonb_typeof(p_manifest->'cases') <> 'array' then
    raise exception using errcode = '22023', message = 'population_v2_cases_array_required';
  end if;

  with cases as (
    select value as item
    from pg_catalog.jsonb_array_elements(p_manifest->'cases')
  ), expanded as (
    select
      item->>'candidate_id' as candidate_id_text,
      item->>'attribution_type' as attribution_type,
      item->>'attribution_status' as attribution_status,
      item->>'review_required' as review_required,
      item->>'source_evidence' as source_evidence,
      item->'source_rows' as source_rows,
      item->'fair_candidate_ids' as fair_candidate_ids,
      item->>'fair_candidate_count' as fair_candidate_count_text
    from cases
  )
  select count(*) into v_case_count from expanded;

  if v_case_count <> 161 or exists (
    with cases as (select value as item from pg_catalog.jsonb_array_elements(p_manifest->'cases'))
    select 1 from cases
    where jsonb_typeof(item) <> 'object'
      or coalesce(item->>'candidate_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or item->>'attribution_type' is distinct from 'ORIGIN'
      or item->>'attribution_status' is distinct from 'PENDING'
      or item->>'review_required' is distinct from 'true'
      or coalesce(item->>'source_evidence', '') !~ '^[A-Za-z0-9:_-]{1,64}$'
      or jsonb_typeof(item->'source_rows') <> 'array'
      or jsonb_array_length(item->'source_rows') <> 1
      or jsonb_typeof(item->'fair_candidate_ids') <> 'array'
      or jsonb_array_length(item->'fair_candidate_ids') not between 1 and 2
      or coalesce((item->>'fair_candidate_count')::integer, -1) <> jsonb_array_length(item->'fair_candidate_ids')
  ) then
    raise exception using errcode = '22023', message = 'population_v2_case_contract_invalid';
  end if;

  with cases as (
    select value as item from pg_catalog.jsonb_array_elements(p_manifest->'cases')
  ), pairs as (
    select item->>'candidate_id' as candidate_id_text, fair_id_text,
      jsonb_array_length(item->'fair_candidate_ids') as fair_count
    from cases
    cross join lateral pg_catalog.jsonb_array_elements_text(item->'fair_candidate_ids') as fair_ids(fair_id_text)
  )
  select
    count(*),
    count(distinct candidate_id_text) filter (where fair_count = 1),
    count(distinct candidate_id_text) filter (where fair_count >= 2),
    count(*) - count(distinct (candidate_id_text, fair_id_text))
  into v_pair_count, v_single_count, v_multiple_count, v_duplicate_pair_count
  from pairs;

  if v_pair_count <> 201 or v_single_count <> 121 or v_multiple_count <> 40 or v_duplicate_pair_count <> 0 then
    raise exception using errcode = '22023', message = 'population_v2_grouping_contract_invalid';
  end if;

  with cases as (
    select value as item from pg_catalog.jsonb_array_elements(p_manifest->'cases')
  ), pair_rows as (
    select
      item->>'candidate_id' as candidate_id_text,
      fair_id_text,
      item->'source_rows'->>0 as source_row_text,
      item->>'source_evidence' as source_evidence
    from cases
    cross join lateral pg_catalog.jsonb_array_elements_text(item->'fair_candidate_ids') as f(fair_id_text)
  )
  select pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(coalesce(pg_catalog.string_agg(
      pg_catalog.concat_ws('|', candidate_id_text, fair_id_text, source_row_text, source_evidence),
      E'\n' order by candidate_id_text, fair_id_text
    ), ''), 'UTF8'), 'sha256'
  ), 'hex')
  into v_pair_payload_sha256
  from pair_rows;
  if v_pair_payload_sha256 is distinct from '074db42b222ec1230dbefdccd099f708b272bca385760a3bc3b7679a053dbc09' then
    raise exception using errcode = '22023', message = 'population_v2_pair_payload_hash_mismatch';
  end if;

  if exists (
    with cases as (select value as item from pg_catalog.jsonb_array_elements(p_manifest->'cases')),
    fair_ids as (
      select fair_id_text from cases
      cross join lateral pg_catalog.jsonb_array_elements_text(item->'fair_candidate_ids') as f(fair_id_text)
    )
    select 1 from fair_ids
    where fair_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception using errcode = '22023', message = 'population_v2_fair_id_invalid';
  end if;

  -- Freeze Candidate/Fair identity and active-state through the final insert.
  -- SHARE blocks concurrent business UPDATE/DELETE while still permitting reads.
  lock table public.nov_talent_candidate_datasets_v1 in share mode;
  lock table public.nov_talent_candidate_dataset_records_v1 in share mode;
  lock table public.nov_talent_candidates_v1 in share mode;
  lock table public.nov_talent_fair_masters_v1 in share mode;
  lock table public.nov_talent_candidate_fair_attributions_v1 in share row exclusive mode;
  lock table public.nov_talent_candidate_fair_attribution_audit_v1 in share row exclusive mode;

  select count(*), count(*) filter (where attribution_type = 'ORIGIN' and attribution_status = 'CONFIRMED')
  into v_existing_attribution_count, v_existing_confirmed_count
  from public.nov_talent_candidate_fair_attributions_v1;
  select count(*) into v_existing_audit_count from public.nov_talent_candidate_fair_attribution_audit_v1;
  if v_existing_attribution_count <> 0 or v_existing_audit_count <> 0 or v_existing_confirmed_count <> 0 then
    raise exception using errcode = '55000', message = 'population_v2_existing_state_not_empty';
  end if;

  select count(*) filter (where is_active),
    count(*) filter (where is_active and graduation_year = 2027),
    count(*) filter (where is_active and graduation_year = 2028)
  into v_candidate_total, v_candidate_2027, v_candidate_2028
  from public.nov_talent_candidates_v1;
  if v_candidate_total <> 636 or v_candidate_2027 <> 528 or v_candidate_2028 <> 108 then
    raise exception using errcode = '55000', message = 'population_v2_candidate_snapshot_count_mismatch';
  end if;

  select pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(coalesce(pg_catalog.string_agg(
      pg_catalog.concat_ws('|', r.candidate_id::text, r.graduation_year::text,
        r.source_row_no::text, r.source_reference_hash, r.source_type, c.version::text),
      E'\n' order by r.candidate_id
    ), ''), 'UTF8'), 'sha256'
  ), 'hex')
  into v_candidate_snapshot_sha256
  from public.nov_talent_candidate_dataset_records_v1 r
  join public.nov_talent_candidate_datasets_v1 d on d.dataset_id = r.dataset_id and d.state = 'ACTIVE'
  join public.nov_talent_candidates_v1 c on c.candidate_id = r.candidate_id and c.is_active;
  if v_candidate_snapshot_sha256 is distinct from '01783932dc8cae65ef840dfa1e43becc41ebbb0e536b972d43017cadc141d1a3' then
    raise exception using errcode = '55000', message = 'population_v2_candidate_snapshot_hash_mismatch';
  end if;

  select count(*), count(*) filter (where is_active), count(*) filter (where not is_active)
  into v_fair_total, v_fair_active, v_fair_inactive
  from public.nov_talent_fair_masters_v1;
  if v_fair_total <> 82 or v_fair_active <> 46 or v_fair_inactive <> 36 then
    raise exception using errcode = '55000', message = 'population_v2_fair_snapshot_count_mismatch';
  end if;

  select pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(coalesce(pg_catalog.string_agg(
      pg_catalog.concat_ws('|', f.fair_id::text, f.event_date::text,
        case when f.is_active then 't' else 'f' end, f.version::text),
      E'\n' order by f.fair_id
    ), ''), 'UTF8'), 'sha256'
  ), 'hex')
  into v_fair_snapshot_sha256
  from public.nov_talent_fair_masters_v1 f;
  if v_fair_snapshot_sha256 is distinct from '766ba161ce59d326599c641e9d8531b19482bfd25dfa1ff2714bde240a8beca3' then
    raise exception using errcode = '55000', message = 'population_v2_fair_snapshot_hash_mismatch';
  end if;

  with cases as (
    select value as item from pg_catalog.jsonb_array_elements(p_manifest->'cases')
  )
  select count(*) into v_missing_candidate_count
  from cases
  left join public.nov_talent_candidates_v1 c
    on c.candidate_id = (item->>'candidate_id')::uuid and c.is_active
  where c.candidate_id is null;

  with cases as (
    select value as item from pg_catalog.jsonb_array_elements(p_manifest->'cases')
  ), pairs as (
    select fair_id_text from cases
    cross join lateral pg_catalog.jsonb_array_elements_text(item->'fair_candidate_ids') as f(fair_id_text)
  )
  select count(*) into v_missing_or_inactive_fair_count
  from pairs
  left join public.nov_talent_fair_masters_v1 f on f.fair_id = fair_id_text::uuid and f.is_active
  where f.fair_id is null;

  if v_missing_candidate_count <> 0 or v_missing_or_inactive_fair_count <> 0 then
    raise exception using errcode = '55000', message = 'population_v2_manifest_identity_unavailable';
  end if;

  with cases as (
    select value as item from pg_catalog.jsonb_array_elements(p_manifest->'cases')
  ), pairs as (
    select
      (item->>'candidate_id')::uuid as candidate_id,
      fair_id_text::uuid as fair_id,
      (item->'source_rows'->>0)::integer as source_row
    from cases
    cross join lateral pg_catalog.jsonb_array_elements_text(item->'fair_candidate_ids') as f(fair_id_text)
  ), inserted as (
    insert into public.nov_talent_candidate_fair_attributions_v1 (
      candidate_id, fair_id, attribution_type, attribution_status,
      source_type, source_reference, source_date, evidence_reference,
      confidence_level, created_by, updated_by
    )
    select
      p.candidate_id, p.fair_id, 'ORIGIN', 'PENDING',
      'SPREADSHEET',
      pg_catalog.format('manifest-v2:%s;source:%s;sheet:%s;row:%s',
        'db225936b21cd026496dba583aaae8b7ef215cc00fb54bc686698044506e0c53',
        '394728af93cee9beaa56e38df23a716e8ccbedfc0ec37bb490263370e2d843d9',
        '1142586954', p.source_row),
      null,
      pg_catalog.format('manifest-v2:%s;source:%s;row:%s',
        'db225936b21cd026496dba583aaae8b7ef215cc00fb54bc686698044506e0c53',
        '394728af93cee9beaa56e38df23a716e8ccbedfc0ec37bb490263370e2d843d9',
        p.source_row),
      'LOW', p_actor_employee_id, p_actor_employee_id
    from pairs p
    order by p.candidate_id, p.fair_id
    returning attribution_id, evidence_reference, version
  ), audited as (
    insert into public.nov_talent_candidate_fair_attribution_audit_v1 (
      attribution_id, previous_status, new_status, reviewer, reviewer_role,
      reason, evidence_reference, attribution_version
    )
    select
      i.attribution_id, null, 'PENDING', p_actor_employee_id, lower(p_actor_role),
      'QUEUE_POPULATION_V2_PENDING_CREATED', i.evidence_reference, i.version
    from inserted i
    returning audit_id
  )
  select
    (select count(*)::integer from inserted),
    (select count(*)::integer from audited)
  into v_attribution_count, v_audit_count;

  if v_attribution_count <> 201 or v_audit_count <> 201 then
    raise exception using errcode = '55000', message = 'population_v2_atomic_count_mismatch';
  end if;
  if exists (
    select 1 from public.nov_talent_candidate_fair_attributions_v1
    where attribution_status <> 'PENDING' or attribution_type <> 'ORIGIN'
  ) then
    raise exception using errcode = '55000', message = 'population_v2_non_pending_row_detected';
  end if;

  return query select
    v_attribution_count,
    v_audit_count,
    'db225936b21cd026496dba583aaae8b7ef215cc00fb54bc686698044506e0c53'::text;
end;
$executor$;

revoke all on function public.nov_talent_population_fair_attribution_queue_v2(uuid,text,text,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.nov_talent_population_fair_attribution_queue_v2(uuid,text,text,text,jsonb)
  to service_role;

comment on function public.nov_talent_population_fair_attribution_queue_v2(uuid,text,text,text,jsonb)
  is 'Staging-only, one-shot, retry-0 bulk population command for the sealed Fair Attribution Manifest v2. Inserts exactly 201 PENDING attributions and 201 creation audit rows atomically.';

commit;
