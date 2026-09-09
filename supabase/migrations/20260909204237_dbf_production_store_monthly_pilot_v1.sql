begin;

create or replace function dbf_ingest.production_store_monthly_pilot_expected_v1(
  p_file_sha256 text
) returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case lower(p_file_sha256)
    when '72bff469bf2d027e054176661445661fbb860a740cf30d1a937f38fb7f1946f9' then
      jsonb_build_object(
        'manifestRef', 'db6c78fdf791a7cbf35921eefb8367bca73eff4b07f00110b5741fb874487019',
        'sourceSystem', 'store-monthly-pilot-20260909',
        'fileSha256', lower(p_file_sha256),
        'factKind', 'store_operating_result',
        'fiscalMonth', '2025-06',
        'sourceType', 'store_monthly_previous_year_actual',
        'rowCount', 22,
        'rawRowsDigest', '28a30c5ce0259cb70e42ad216eeec5c95562cba75c8c2e5b5d23171588d85bff',
        'validatedRowsDigest', '85168a82142e150a545be7ded1473ae3a8c73dce449c283d9fc037a8f7833f0d',
        'storeIds', jsonb_build_array(
          '1bcba30a-d063-4cdb-be74-425e250aeb25',
          '36c222de-0554-4265-b177-3b68285cc4a4'
        ),
        'metricCodes', jsonb_build_array(
          'NEW_CUSTOMERS','NEW_REPEAT_RATE','RETAIL_PURCHASE_RATE','RETAIL_SALES',
          'TECHNICAL_PRODUCTIVITY','TECHNICAL_SALES','TECHNICAL_UNIT_PRICE',
          'TOTAL_CUSTOMERS','TOTAL_PRODUCTIVITY','TOTAL_SALES','TOTAL_UNIT_PRICE'
        )
      )
    when 'b30972436958601e69580e07a3a3ff969c7781c5997d87dde3cef47b8a9655f9' then
      jsonb_build_object(
        'manifestRef', 'db6c78fdf791a7cbf35921eefb8367bca73eff4b07f00110b5741fb874487019',
        'sourceSystem', 'store-monthly-pilot-20260909',
        'fileSha256', lower(p_file_sha256),
        'factKind', 'store_operating_result',
        'fiscalMonth', '2026-06',
        'sourceType', 'store_monthly_actual',
        'rowCount', 22,
        'rawRowsDigest', '278df4fe2709879ab2cae8d5589b0c39d894d718e60f63b3d89118aab0734667',
        'validatedRowsDigest', '6d7e4aae6e2dbd3c4a2f159bdf8618fea4301496f2c912e38318702d6b36ae8c',
        'storeIds', jsonb_build_array(
          '1bcba30a-d063-4cdb-be74-425e250aeb25',
          '36c222de-0554-4265-b177-3b68285cc4a4'
        ),
        'metricCodes', jsonb_build_array(
          'NEW_CUSTOMERS','NEW_REPEAT_RATE','RETAIL_PURCHASE_RATE','RETAIL_SALES',
          'TECHNICAL_PRODUCTIVITY','TECHNICAL_SALES','TECHNICAL_UNIT_PRICE',
          'TOTAL_CUSTOMERS','TOTAL_PRODUCTIVITY','TOTAL_SALES','TOTAL_UNIT_PRICE'
        )
      )
    when 'bef80ca154226012ad44c59ce500cf91593425ed0289e5b1ef8dd16507acbac1' then
      jsonb_build_object(
        'manifestRef', 'db6c78fdf791a7cbf35921eefb8367bca73eff4b07f00110b5741fb874487019',
        'sourceSystem', 'store-monthly-pilot-20260909',
        'fileSha256', lower(p_file_sha256),
        'factKind', 'budget',
        'fiscalMonth', '2026-06',
        'sourceType', 'store_monthly_budget',
        'rowCount', 6,
        'rawRowsDigest', '2eeadc686fbae814d2a44c6f85813a88326cfd6d761f92292c8b6233834c69c5',
        'validatedRowsDigest', 'b2e1e7440d737c68b8c32283cb78023aecc0d5b924396946a0e882e3a6828d9e',
        'storeIds', jsonb_build_array(
          '1bcba30a-d063-4cdb-be74-425e250aeb25',
          '36c222de-0554-4265-b177-3b68285cc4a4'
        ),
        'metricCodes', jsonb_build_array('RETAIL_SALES','TECHNICAL_SALES','TOTAL_SALES')
      )
    else null
  end;
$$;

create or replace function dbf_ingest.assert_production_store_monthly_pilot_contract_v1(
  p_contract jsonb
) returns void
language plpgsql
security definer
set search_path = pg_catalog, dbf_ingest
as $$
declare
  v_expected jsonb;
begin
  if jsonb_typeof(p_contract) <> 'object'
    or (select count(*) from jsonb_object_keys(p_contract)) <> 11 then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_CONTRACT_REJECTED';
  end if;
  v_expected := dbf_ingest.production_store_monthly_pilot_expected_v1(p_contract->>'fileSha256');
  if v_expected is null or p_contract <> v_expected then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_CONTRACT_REJECTED';
  end if;
end;
$$;

create or replace function dbf_ingest.assert_production_store_monthly_pilot_raw_rows_v1(
  p_fact_kind text,
  p_fiscal_month date,
  p_raw_rows jsonb,
  p_expected_count integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, dbf_ingest
as $$
declare
  v_invalid integer;
  v_distinct integer;
begin
  if jsonb_typeof(p_raw_rows) <> 'array' or jsonb_array_length(p_raw_rows) <> p_expected_count then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_ROWSET_REJECTED';
  end if;
  select count(*), count(distinct concat(r.value->'payload'->>'store_key', ':', r.value->'payload'->>'metric_code'))
  into v_invalid, v_distinct
  from jsonb_array_elements(p_raw_rows) r
  where (r.value - array['sourceRowNumber','payload','payloadSha256']) <> '{}'::jsonb
    or jsonb_typeof(r.value->'payload') <> 'object'
    or (r.value->>'sourceRowNumber')::integer < 1
    or r.value->'payload'->>'fiscal_month' <> to_char(p_fiscal_month, 'YYYY-MM')
    or r.value->'payload'->>'company_key' <> '0001'
    or r.value->'payload'->>'store_key' not in ('ikebukuro','kamishakujii')
    or r.value->'payload'->>'confirmation_status' <> 'confirmed'
    or case when p_fact_kind = 'store_operating_result' then
      (r.value->'payload' - array[
        'fiscal_month','company_key','store_key','metric_code','value','definition_version','confirmation_status'
      ]) <> '{}'::jsonb
      or r.value->'payload'->>'metric_code' not in (
        'NEW_CUSTOMERS','NEW_REPEAT_RATE','RETAIL_PURCHASE_RATE','RETAIL_SALES',
        'TECHNICAL_PRODUCTIVITY','TECHNICAL_SALES','TECHNICAL_UNIT_PRICE',
        'TOTAL_CUSTOMERS','TOTAL_PRODUCTIVITY','TOTAL_SALES','TOTAL_UNIT_PRICE'
      )
      or r.value->'payload'->>'definition_version' <> 'v1'
      or (r.value->'payload'->>'value')::numeric = 0
    else
      (r.value->'payload' - array[
        'fiscal_month','company_key','store_key','scenario_code','account_code','metric_code','amount','confirmation_status'
      ]) <> '{}'::jsonb
      or r.value->'payload'->>'metric_code' not in ('RETAIL_SALES','TECHNICAL_SALES','TOTAL_SALES')
      or r.value->'payload'->>'scenario_code' <> 'BASE'
      or coalesce(r.value->'payload'->>'account_code','') <> ''
      or (r.value->'payload'->>'amount')::numeric = 0
    end;
  if v_invalid <> 0 then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_ROW_SCOPE_REJECTED';
  end if;

  select count(distinct concat(r.value->'payload'->>'store_key', ':', r.value->'payload'->>'metric_code'))
  into v_distinct from jsonb_array_elements(p_raw_rows) r;
  if v_distinct <> p_expected_count
    or (select count(distinct (r.value->>'sourceRowNumber')::integer) from jsonb_array_elements(p_raw_rows) r) <> p_expected_count
    or (select min((r.value->>'sourceRowNumber')::integer) from jsonb_array_elements(p_raw_rows) r) <> 1
    or (select max((r.value->>'sourceRowNumber')::integer) from jsonb_array_elements(p_raw_rows) r) <> p_expected_count then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_ROWSET_REJECTED';
  end if;
end;
$$;

create or replace function public.dbf_import_store_monthly_pilot_preflight_v1(
  p_batch_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, dbf_ingest
as $$
declare
  v_result jsonb;
  v_expected jsonb;
begin
  select jsonb_build_object(
    'manifestRef', 'db6c78fdf791a7cbf35921eefb8367bca73eff4b07f00110b5741fb874487019',
    'fileSha256', f.sha256,
    'factKind', b.fact_kind,
    'fiscalMonth', to_char(b.fiscal_month, 'YYYY-MM'),
    'sourceType', b.source_type,
    'rowCount', (select count(*) from dbf_ingest.raw_rows r where r.batch_id = b.id),
    'status', b.status
  ), dbf_ingest.production_store_monthly_pilot_expected_v1(f.sha256)
  into v_result, v_expected
  from dbf_ingest.import_batches b
  join dbf_ingest.source_files f on f.id = b.source_file_id
  where b.id = p_batch_id
    and f.source_system = 'store-monthly-pilot-20260909'
    and b.correction_of_batch_id is null;

  if v_result is null or v_expected is null
    or v_result->>'fileSha256' <> v_expected->>'fileSha256'
    or v_result->>'factKind' <> v_expected->>'factKind'
    or v_result->>'fiscalMonth' <> v_expected->>'fiscalMonth'
    or v_result->>'sourceType' <> v_expected->>'sourceType'
    or (v_result->>'rowCount')::integer <> (v_expected->>'rowCount')::integer then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_BATCH_REJECTED';
  end if;
  return v_result;
end;
$$;

create or replace function public.dbf_import_store_monthly_pilot_start_v1(
  p_actor_employee_id uuid,
  p_file jsonb,
  p_fact_kind text,
  p_fiscal_month date,
  p_source_type text,
  p_source_system text,
  p_raw_rows jsonb,
  p_contract jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, dbf_ingest
as $$
declare
  v_expected jsonb;
  v_existing_count integer;
  v_existing_id uuid;
  v_result jsonb;
begin
  perform dbf_ingest.assert_production_store_monthly_pilot_contract_v1(p_contract);
  v_expected := dbf_ingest.production_store_monthly_pilot_expected_v1(p_file->>'sha256');
  if v_expected is null or lower(p_file->>'sha256') <> p_contract->>'fileSha256'
    or p_actor_employee_id is null or p_file->>'mediaType' <> 'text/csv'
    or (p_file->>'byteSize')::integer not in (1430,1422,474)
    or p_fact_kind <> v_expected->>'factKind'
    or to_char(p_fiscal_month, 'YYYY-MM') <> v_expected->>'fiscalMonth'
    or p_source_type <> v_expected->>'sourceType'
    or p_source_system <> v_expected->>'sourceSystem' then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_SOURCE_REJECTED';
  end if;
  if (p_file->>'byteSize')::integer <> case lower(p_file->>'sha256')
    when '72bff469bf2d027e054176661445661fbb860a740cf30d1a937f38fb7f1946f9' then 1430
    when 'b30972436958601e69580e07a3a3ff969c7781c5997d87dde3cef47b8a9655f9' then 1422
    when 'bef80ca154226012ad44c59ce500cf91593425ed0289e5b1ef8dd16507acbac1' then 474
    else -1 end
    or p_file->>'originalFileName' <> case lower(p_file->>'sha256')
    when '72bff469bf2d027e054176661445661fbb860a740cf30d1a937f38fb7f1946f9' then '2025-06-pilot-store-actual.csv'
    when 'b30972436958601e69580e07a3a3ff969c7781c5997d87dde3cef47b8a9655f9' then '2026-06-pilot-store-actual.csv'
    when 'bef80ca154226012ad44c59ce500cf91593425ed0289e5b1ef8dd16507acbac1' then '2026-06-pilot-store-budget.csv'
    else '' end then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_SOURCE_REJECTED';
  end if;

  perform dbf_ingest.assert_production_store_monthly_pilot_raw_rows_v1(
    p_fact_kind, p_fiscal_month, p_raw_rows, (v_expected->>'rowCount')::integer
  );
  perform pg_advisory_xact_lock(hashtextextended(lower(p_file->>'sha256'), 0));
  select count(*), (array_agg(b.id order by b.created_at, b.id))[1]
  into v_existing_count, v_existing_id
  from dbf_ingest.import_batches b
  join dbf_ingest.source_files f on f.id = b.source_file_id
  where f.source_system = p_source_system and f.sha256 = lower(p_file->>'sha256');
  if v_existing_count > 1 then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_DUPLICATE_BATCH_REJECTED';
  elsif v_existing_count = 1 then
    v_result := public.dbf_import_store_monthly_pilot_preflight_v1(v_existing_id);
    return v_result || jsonb_build_object('batchId', v_existing_id, 'idempotent', true);
  end if;

  v_result := public.dbf_import_start_v1(
    p_actor_employee_id, p_file, p_fact_kind, p_fiscal_month, p_source_type,
    p_source_system, p_raw_rows, null, null
  );
  insert into dbf_ingest.import_events
    (batch_id, event_type, actor_employee_id, summary)
  values (
    (v_result->>'batchId')::uuid,
    'PRODUCTION_PILOT_SOURCE_BOUND',
    p_actor_employee_id,
    jsonb_build_object(
      'manifestRef', v_expected->>'manifestRef',
      'fileSha256', v_expected->>'fileSha256',
      'rawRowsDigest', v_expected->>'rawRowsDigest',
      'rowCount', (v_expected->>'rowCount')::integer,
      'storeCount', 2,
      'datasetType', v_expected->>'sourceType',
      'fiscalMonth', v_expected->>'fiscalMonth',
      'metricCount', jsonb_array_length(v_expected->'metricCodes')
    )
  );
  return v_result || jsonb_build_object('idempotent', false);
end;
$$;

create or replace function public.dbf_import_store_monthly_pilot_stage_v1(
  p_actor_employee_id uuid,
  p_batch_id uuid,
  p_fact_kind text,
  p_fiscal_month date,
  p_parser_receipt jsonb,
  p_rows jsonb,
  p_warning_codes jsonb,
  p_contract jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, dbf_ingest
as $$
declare
  v_expected jsonb;
  v_preflight jsonb;
  v_result jsonb;
  v_invalid integer;
begin
  perform dbf_ingest.assert_production_store_monthly_pilot_contract_v1(p_contract);
  v_preflight := public.dbf_import_store_monthly_pilot_preflight_v1(p_batch_id);
  v_expected := dbf_ingest.production_store_monthly_pilot_expected_v1(v_preflight->>'fileSha256');
  if p_actor_employee_id is null or p_fact_kind <> v_expected->>'factKind'
    or to_char(p_fiscal_month, 'YYYY-MM') <> v_expected->>'fiscalMonth'
    or jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) <> (v_expected->>'rowCount')::integer
    or coalesce(p_warning_codes, '[]'::jsonb) <> '[]'::jsonb then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_STAGE_REJECTED';
  end if;

  select count(*) into v_invalid
  from jsonb_array_elements(p_rows) r
  where (r.value->>'companyId')::uuid <> 'e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
    or (r.value->>'storeId')::uuid not in (
      '1bcba30a-d063-4cdb-be74-425e250aeb25'::uuid,
      '36c222de-0554-4265-b177-3b68285cc4a4'::uuid
    )
    or r.value->>'metricCode' not in (
      select jsonb_array_elements_text(v_expected->'metricCodes')
    )
    or r.value->>'sourceRowCategory' <> 'detail'
    or r.value->>'mappingStatus' <> 'resolved'
    or r.value->>'validationStatus' <> 'valid'
    or r.value->'normalizedPayload'->>'confirmationStatus' <> 'confirmed'
    or case when p_fact_kind = 'store_operating_result' then
      r.value->'normalizedPayload'->>'definitionVersion' <> 'v1'
      or ((r.value->>'amount') is not null)::integer
        + ((r.value->>'quantity') is not null)::integer
        + ((r.value->>'rate') is not null)::integer <> 1
    else
      r.value->'normalizedPayload'->>'scenarioCode' <> 'BASE'
      or r.value->>'accountCode' is not null
      or r.value->>'amount' is null
    end;
  if v_invalid <> 0
    or (select count(distinct concat(r.value->>'storeId', ':', r.value->>'metricCode')) from jsonb_array_elements(p_rows) r)
      <> (v_expected->>'rowCount')::integer then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_STAGE_SCOPE_REJECTED';
  end if;

  v_result := public.dbf_import_stage_v1(
    p_actor_employee_id, p_batch_id, p_fact_kind, p_fiscal_month,
    p_parser_receipt, p_rows, p_warning_codes
  );
  insert into dbf_ingest.import_events
    (batch_id, event_type, actor_employee_id, summary)
  values (
    p_batch_id,
    'PRODUCTION_PILOT_VALIDATION_BOUND',
    p_actor_employee_id,
    jsonb_build_object(
      'manifestRef', v_expected->>'manifestRef',
      'fileSha256', v_expected->>'fileSha256',
      'validatedRowsDigest', v_expected->>'validatedRowsDigest',
      'rowCount', (v_expected->>'rowCount')::integer,
      'warningCount', 0,
      'validationResult', 'PASS',
      'storeCount', 2,
      'datasetType', v_expected->>'sourceType',
      'fiscalMonth', v_expected->>'fiscalMonth',
      'metricCount', jsonb_array_length(v_expected->'metricCodes')
    )
  );
  return v_result;
end;
$$;

create or replace function public.dbf_import_store_monthly_pilot_approve_v1(
  p_actor_employee_id uuid,
  p_batch_id uuid,
  p_owner_confirmation boolean,
  p_contract jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, dbf_ingest
as $$
declare
  v_preflight jsonb;
  v_expected jsonb;
  v_result jsonb;
begin
  if p_actor_employee_id is null or p_owner_confirmation is not true then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_OWNER_CONFIRMATION_REQUIRED';
  end if;
  perform dbf_ingest.assert_production_store_monthly_pilot_contract_v1(p_contract);
  v_preflight := public.dbf_import_store_monthly_pilot_preflight_v1(p_batch_id);
  v_expected := dbf_ingest.production_store_monthly_pilot_expected_v1(v_preflight->>'fileSha256');
  if v_preflight->>'status' = 'approved' and exists (
    select 1 from dbf_ingest.import_events e
    where e.batch_id = p_batch_id and e.event_type = 'PRODUCTION_PILOT_OWNER_APPROVED'
  ) then
    return jsonb_build_object('batchId', p_batch_id, 'status', 'approved',
      'rowCount', (v_expected->>'rowCount')::integer, 'idempotent', true);
  end if;
  if v_preflight->>'status' <> 'owner_review'
    or not exists (
      select 1 from dbf_ingest.import_events e
      where e.batch_id = p_batch_id and e.event_type = 'PRODUCTION_PILOT_VALIDATION_BOUND'
        and e.summary->>'validatedRowsDigest' = v_expected->>'validatedRowsDigest'
    )
    or exists (select 1 from dbf_ingest.validation_issues i where i.batch_id = p_batch_id)
    or (select count(*) from dbf_ingest.staging_rows s where s.batch_id = p_batch_id)
      <> (v_expected->>'rowCount')::integer then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_APPROVAL_REJECTED';
  end if;
  v_result := public.dbf_import_approve_v1(p_actor_employee_id, p_batch_id);
  insert into dbf_ingest.import_events
    (batch_id, event_type, actor_employee_id, summary)
  values (
    p_batch_id,
    'PRODUCTION_PILOT_OWNER_APPROVED',
    p_actor_employee_id,
    jsonb_build_object(
      'manifestRef', v_expected->>'manifestRef',
      'fileSha256', v_expected->>'fileSha256',
      'validatedRowsDigest', v_expected->>'validatedRowsDigest',
      'rowCount', (v_expected->>'rowCount')::integer,
      'approvedRole', 'business_data_admin',
      'storeCount', 2,
      'datasetType', v_expected->>'sourceType',
      'fiscalMonth', v_expected->>'fiscalMonth',
      'metricCount', jsonb_array_length(v_expected->'metricCodes')
    )
  );
  return v_result || jsonb_build_object('idempotent', false);
end;
$$;

create or replace function public.dbf_import_store_monthly_pilot_promote_v1(
  p_actor_employee_id uuid,
  p_batch_id uuid,
  p_contract jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, dbf_ingest
as $$
declare
  v_preflight jsonb;
  v_expected jsonb;
  v_result jsonb;
  v_fact_count integer;
begin
  if p_actor_employee_id is null then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_PROMOTION_REJECTED';
  end if;
  perform dbf_ingest.assert_production_store_monthly_pilot_contract_v1(p_contract);
  v_preflight := public.dbf_import_store_monthly_pilot_preflight_v1(p_batch_id);
  v_expected := dbf_ingest.production_store_monthly_pilot_expected_v1(v_preflight->>'fileSha256');
  if v_preflight->>'status' = 'promoted' and exists (
    select 1 from dbf_ingest.import_events e
    where e.batch_id = p_batch_id and e.event_type = 'PRODUCTION_PILOT_PROMOTED'
  ) then
    return jsonb_build_object('batchId', p_batch_id, 'status', 'promoted',
      'rowCount', (v_expected->>'rowCount')::integer, 'idempotent', true);
  end if;
  if v_preflight->>'status' <> 'approved' or not exists (
    select 1 from dbf_ingest.import_events e
    where e.batch_id = p_batch_id and e.event_type = 'PRODUCTION_PILOT_OWNER_APPROVED'
      and e.summary->>'validatedRowsDigest' = v_expected->>'validatedRowsDigest'
  ) then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_PROMOTION_REJECTED';
  end if;

  v_result := public.dbf_import_promote_v1(p_actor_employee_id, p_batch_id);
  if v_expected->>'factKind' = 'store_operating_result' then
    select count(*) into v_fact_count from public.dbf_store_monthly_metric_facts f
    where f.batch_id = p_batch_id and f.is_active;
  else
    select count(*) into v_fact_count from public.dbf_budget_facts f
    where f.batch_id = p_batch_id and f.is_active;
  end if;
  if v_fact_count <> (v_expected->>'rowCount')::integer then
    raise exception using errcode = '22023', message = 'DBF_PRODUCTION_PILOT_POSTSTATE_REJECTED';
  end if;
  insert into dbf_ingest.import_events
    (batch_id, event_type, actor_employee_id, summary)
  values (
    p_batch_id,
    'PRODUCTION_PILOT_PROMOTED',
    p_actor_employee_id,
    jsonb_build_object(
      'manifestRef', v_expected->>'manifestRef',
      'fileSha256', v_expected->>'fileSha256',
      'validatedRowsDigest', v_expected->>'validatedRowsDigest',
      'rowCount', v_fact_count,
      'factKind', v_expected->>'factKind',
      'fiscalMonth', v_expected->>'fiscalMonth',
      'promotedRole', 'business_data_admin',
      'storeCount', 2,
      'datasetType', v_expected->>'sourceType',
      'metricCount', jsonb_array_length(v_expected->'metricCodes')
    )
  );
  return v_result || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function dbf_ingest.production_store_monthly_pilot_expected_v1(text)
  from public, anon, authenticated;
revoke all on function dbf_ingest.assert_production_store_monthly_pilot_contract_v1(jsonb)
  from public, anon, authenticated;
revoke all on function dbf_ingest.assert_production_store_monthly_pilot_raw_rows_v1(text,date,jsonb,integer)
  from public, anon, authenticated;
revoke all on function public.dbf_import_store_monthly_pilot_preflight_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.dbf_import_store_monthly_pilot_start_v1(uuid,jsonb,text,date,text,text,jsonb,jsonb)
  from public, anon, authenticated;
revoke all on function public.dbf_import_store_monthly_pilot_stage_v1(uuid,uuid,text,date,jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
revoke all on function public.dbf_import_store_monthly_pilot_approve_v1(uuid,uuid,boolean,jsonb)
  from public, anon, authenticated;
revoke all on function public.dbf_import_store_monthly_pilot_promote_v1(uuid,uuid,jsonb)
  from public, anon, authenticated;

grant execute on function public.dbf_import_store_monthly_pilot_preflight_v1(uuid) to service_role;
grant execute on function public.dbf_import_store_monthly_pilot_start_v1(uuid,jsonb,text,date,text,text,jsonb,jsonb) to service_role;
grant execute on function public.dbf_import_store_monthly_pilot_stage_v1(uuid,uuid,text,date,jsonb,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.dbf_import_store_monthly_pilot_approve_v1(uuid,uuid,boolean,jsonb) to service_role;
grant execute on function public.dbf_import_store_monthly_pilot_promote_v1(uuid,uuid,jsonb) to service_role;

comment on function public.dbf_import_store_monthly_pilot_promote_v1(uuid,uuid,jsonb) is
  'Owner-approved Production pilot promotion boundary for the two-store 2025-06/2026-06 monthly package.';

commit;
