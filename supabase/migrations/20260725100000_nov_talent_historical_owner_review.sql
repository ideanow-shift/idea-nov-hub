begin;

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
begin
  if p_fiscal_year <> 2027 then
    raise exception using errcode = '22023', message = 'unsupported_fiscal_year';
  end if;

  perform public.assert_nov_talent_accountable_owner_v1(p_employee_id);

  select b.batch_id
  into strict v_batch_id
  from public.nov_talent_historical_import_batches_v1 b
  where b.state = 'OPEN'
    and b.dry_run_only
    and b.sealed_at is null;

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
        'legacy_no_present', nullif(btrim(k.legacy_no), '') is not null
      ) as mapping
    from public.nov_talent_historical_staging_records_v1 r
    join public.nov_talent_historical_application_mappings_v1 m
      using (staging_record_id)
    join public.nov_talent_historical_source_keys_v1 k
      using (staging_record_id)
    left join public.nov_talent_applications_v1 a
      on a.application_id = m.canonical_application_id
    where r.batch_id = v_batch_id
      and r.source_sheet_code in ('CONTACTS_27', 'ENTRIES_27', 'OFFERS_27')
    order by r.created_at, r.staging_record_id
    limit 1000
  ) projected;

  return jsonb_build_object('rows', v_rows);
exception
  when no_data_found or too_many_rows then
    raise exception using errcode = '55000', message = 'accepted_batch_not_exact1';
end
$function$;

create or replace function public.apply_nov_talent_historical_review_v1(
  p_primary_record_ids uuid[],
  p_link_pairs jsonb,
  p_reviewer_employee_id uuid
)
returns table(
  "requestedPrimary" integer,
  "createdPrimary" integer,
  "requestedLinks" integer,
  "confirmedLinks" integer,
  "remainingUnmapped" integer,
  "canonicalEventCreated" boolean,
  "rawValuesIncluded" boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_batch_id uuid;
  v_record_id uuid;
  v_source_record_id uuid;
  v_target_record_id uuid;
  v_application_id uuid;
  v_source_digest text;
  v_pair jsonb;
  v_primary_count integer := coalesce(cardinality(p_primary_record_ids), 0);
  v_link_count integer := case
    when jsonb_typeof(p_link_pairs) = 'array' then jsonb_array_length(p_link_pairs)
    else -1
  end;
  v_created integer := 0;
  v_confirmed integer := 0;
  v_remaining integer := 0;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_reviewer_employee_id);

  if p_primary_record_ids is null
    or p_link_pairs is null
    or v_primary_count > 600
    or v_link_count < 0
    or v_link_count > 200
    or v_primary_count + v_link_count = 0
  then
    raise exception using errcode = '22023', message = 'invalid_review_request';
  end if;

  if v_primary_count <> (
    select count(distinct value)
    from unnest(p_primary_record_ids) as input(value)
  ) then
    raise exception using errcode = '22023', message = 'duplicate_primary_record';
  end if;

  select b.batch_id
  into strict v_batch_id
  from public.nov_talent_historical_import_batches_v1 b
  where b.state = 'OPEN'
    and b.dry_run_only
    and b.sealed_at is null;

  foreach v_record_id in array p_primary_record_ids loop
    select r.source_record_digest
    into strict v_source_digest
    from public.nov_talent_historical_staging_records_v1 r
    join public.nov_talent_historical_application_mappings_v1 m
      using (staging_record_id)
    where r.staging_record_id = v_record_id
      and r.batch_id = v_batch_id
      and r.source_sheet_code = 'CONTACTS_27'
      and m.mapping_status = 'UNMAPPED';

    insert into public.nov_talent_applications_v1 default values
    returning application_id into v_application_id;

    insert into public.nov_talent_historical_source_application_mappings_v1(
      batch_id,
      source_sheet_code,
      source_key_digest,
      canonical_application_id,
      mapping_kind,
      confirmed_by_employee_id
    ) values (
      v_batch_id,
      'CONTACTS_27',
      v_source_digest,
      v_application_id,
      'PRIMARY_CREATED',
      p_reviewer_employee_id
    );

    update public.nov_talent_historical_application_mappings_v1
    set canonical_application_id = v_application_id,
      mapping_status = 'OWNER_CONFIRMED',
      reviewed_by_employee_id = p_reviewer_employee_id,
      reviewed_at = now()
    where staging_record_id = v_record_id
      and mapping_status = 'UNMAPPED';
    if not found then
      raise exception using errcode = '55000', message = 'primary_mapping_not_exact1';
    end if;

    update public.nov_talent_historical_source_keys_v1
    set source_key_status = 'OWNER_CONFIRMED'
    where staging_record_id = v_record_id
      and source_key_status = 'UNPROVEN';
    if not found then
      raise exception using errcode = '55000', message = 'primary_source_key_not_confirmable';
    end if;

    v_created := v_created + 1;
  end loop;

  for v_pair in select value from jsonb_array_elements(p_link_pairs) loop
    if jsonb_typeof(v_pair) <> 'object'
      or jsonb_object_length(v_pair) <> 2
      or not (v_pair ? 'sourceRecordId')
      or not (v_pair ? 'targetRecordId')
    then
      raise exception using errcode = '22023', message = 'invalid_link_pair';
    end if;

    begin
      v_source_record_id := (v_pair->>'sourceRecordId')::uuid;
      v_target_record_id := (v_pair->>'targetRecordId')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'invalid_link_pair';
    end;

    select target_mapping.canonical_application_id
    into strict v_application_id
    from public.nov_talent_historical_staging_records_v1 target_record
    join public.nov_talent_historical_application_mappings_v1 target_mapping
      using (staging_record_id)
    where target_record.staging_record_id = v_target_record_id
      and target_record.batch_id = v_batch_id
      and target_record.source_sheet_code = 'CONTACTS_27'
      and target_mapping.mapping_status = 'OWNER_CONFIRMED';

    select source_record.source_record_digest
    into strict v_source_digest
    from public.nov_talent_historical_staging_records_v1 source_record
    join public.nov_talent_historical_application_mappings_v1 source_mapping
      using (staging_record_id)
    where source_record.staging_record_id = v_source_record_id
      and source_record.batch_id = v_batch_id
      and source_record.source_sheet_code in ('ENTRIES_27', 'OFFERS_27')
      and source_mapping.mapping_status = 'UNMAPPED';

    insert into public.nov_talent_historical_source_application_mappings_v1(
      batch_id,
      source_sheet_code,
      source_key_digest,
      canonical_application_id,
      mapping_kind,
      confirmed_by_employee_id
    )
    select
      v_batch_id,
      r.source_sheet_code,
      v_source_digest,
      v_application_id,
      'CROSS_SHEET_CONFIRMED',
      p_reviewer_employee_id
    from public.nov_talent_historical_staging_records_v1 r
    where r.staging_record_id = v_source_record_id;

    update public.nov_talent_historical_application_mappings_v1
    set canonical_application_id = v_application_id,
      mapping_status = 'OWNER_CONFIRMED',
      reviewed_by_employee_id = p_reviewer_employee_id,
      reviewed_at = now()
    where staging_record_id = v_source_record_id
      and mapping_status = 'UNMAPPED';
    if not found then
      raise exception using errcode = '55000', message = 'cross_sheet_mapping_not_exact1';
    end if;

    update public.nov_talent_historical_source_keys_v1
    set source_key_status = 'OWNER_CONFIRMED'
    where staging_record_id = v_source_record_id
      and source_key_status = 'UNPROVEN';
    if not found then
      raise exception using errcode = '55000', message = 'cross_sheet_source_key_not_confirmable';
    end if;

    v_confirmed := v_confirmed + 1;
  end loop;

  select count(*)::integer
  into v_remaining
  from public.nov_talent_historical_staging_records_v1 r
  join public.nov_talent_historical_application_mappings_v1 m
    using (staging_record_id)
  where r.batch_id = v_batch_id
    and r.source_sheet_code in ('CONTACTS_27', 'ENTRIES_27', 'OFFERS_27')
    and m.mapping_status = 'UNMAPPED';

  return query
  select
    v_primary_count,
    v_created,
    v_link_count,
    v_confirmed,
    v_remaining,
    false,
    false;
exception
  when no_data_found or too_many_rows then
    raise exception using errcode = '55000', message = 'review_target_not_exact1';
end
$function$;

revoke all on function public.get_nov_talent_staging_workspace_v1(uuid, smallint)
  from public, anon, authenticated;
grant execute on function public.get_nov_talent_staging_workspace_v1(uuid, smallint)
  to service_role;

revoke all on function public.apply_nov_talent_historical_review_v1(uuid[], jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_nov_talent_historical_review_v1(uuid[], jsonb, uuid)
  to service_role;

commit;
