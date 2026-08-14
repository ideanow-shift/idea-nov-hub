begin;

insert into dbf_ingest.metric_definitions
  (metric_code, definition_version, value_kind, display_name, description)
values
  ('TOTAL_SALES','v1','amount','総売上','Monthly gross sales at the canonical store grain.'),
  ('TECHNICAL_SALES','v1','amount','技術売上','Monthly technical service sales.'),
  ('RETAIL_SALES','v1','amount','通常店販','Monthly retail product sales excluding MID and allocated EC.'),
  ('MID_SALES','v1','amount','MID','Monthly MID sales.'),
  ('EC_ALLOCATED_SALES','v1','amount','EC按分','Monthly EC sales allocated by the approved source rule.'),
  ('TOTAL_CUSTOMERS','v1','quantity','総客数','Monthly total customer visits.'),
  ('NEW_CUSTOMERS','v1','quantity','新規客数','Monthly new customer visits.'),
  ('EXISTING_CUSTOMERS','v1','quantity','既存客数','Monthly existing customer visits.'),
  ('TOTAL_UNIT_PRICE','v1','amount','総単価','Monthly total sales per customer.'),
  ('TECHNICAL_UNIT_PRICE','v1','amount','技術単価','Monthly technical sales per applicable customer.'),
  ('TOTAL_REPEAT_RATE','v1','rate','総リピート率','Monthly total repeat rate represented from zero to one.'),
  ('NEW_REPEAT_RATE','v1','rate','新規リピート率','Monthly new customer repeat rate represented from zero to one.'),
  ('SECOND_REPEAT_RATE','v1','rate','2回目','Second visit repeat rate represented from zero to one.'),
  ('THIRD_REPEAT_RATE','v1','rate','3回目','Third visit repeat rate represented from zero to one.'),
  ('FIXED_REPEAT_RATE','v1','rate','固定','Fixed customer repeat rate represented from zero to one.'),
  ('TOTAL_PRODUCTIVITY','v1','amount','総生産性','Monthly total productivity under definition v1.'),
  ('TECHNICAL_PRODUCTIVITY','v1','amount','技術生産性','Monthly technical productivity under definition v1.'),
  ('RETAIL_PURCHASE_RATE','v1','rate','店販購買率','Monthly retail purchase rate represented from zero to one.'),
  ('OPERATING_PROFIT','v1','amount','利益','Monthly operating profit; accounting-confirmed values take precedence when confirmed.')
on conflict (metric_code, definition_version) do nothing;

create or replace function public.dbf_import_start_v1(
  p_actor_employee_id uuid,
  p_file jsonb,
  p_fact_kind text,
  p_fiscal_month date,
  p_source_type text,
  p_source_system text,
  p_raw_rows jsonb,
  p_correction_of_batch_id uuid default null,
  p_correction_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dbf_ingest
as $$
declare
  v_source_file_id uuid;
  v_batch_id uuid;
  v_revision integer := 1;
  v_previous dbf_ingest.import_batches%rowtype;
  v_row jsonb;
begin
  if p_actor_employee_id is null or p_fact_kind not in ('pl','bs','store_operating_result','budget')
    or p_fiscal_month <> date_trunc('month', p_fiscal_month)::date
    or btrim(coalesce(p_source_type,'')) = '' or btrim(coalesce(p_source_system,'')) = '' then
    raise exception using errcode = '22023', message = 'DBF_IMPORT_START_INVALID';
  end if;
  if jsonb_typeof(p_file) <> 'object' or jsonb_typeof(p_raw_rows) <> 'array'
    or jsonb_array_length(p_raw_rows) < 1 or jsonb_array_length(p_raw_rows) > 10000 then
    raise exception using errcode = '22023', message = 'DBF_IMPORT_SOURCE_INVALID';
  end if;
  if p_correction_of_batch_id is not null then
    select * into strict v_previous from dbf_ingest.import_batches where id = p_correction_of_batch_id for update;
    if v_previous.status <> 'promoted' or v_previous.fact_kind <> p_fact_kind
      or v_previous.fiscal_month <> p_fiscal_month or v_previous.source_type <> p_source_type
      or btrim(coalesce(p_correction_reason,'')) = '' then
      raise exception using errcode = '22023', message = 'DBF_CORRECTION_LINEAGE_INVALID';
    end if;
    v_revision := v_previous.revision + 1;
  elsif p_correction_reason is not null then
    raise exception using errcode = '22023', message = 'DBF_CORRECTION_LINEAGE_INVALID';
  end if;

  insert into dbf_ingest.source_files
    (sha256, byte_size, original_file_name, media_type, source_system, received_by_employee_id)
  values
    (lower(p_file->>'sha256'), (p_file->>'byteSize')::bigint, p_file->>'originalFileName',
      p_file->>'mediaType', p_source_system, p_actor_employee_id)
  on conflict (source_system, sha256, byte_size) do update set sha256 = excluded.sha256
  returning id into v_source_file_id;

  insert into dbf_ingest.import_batches
    (source_file_id, fact_kind, fiscal_month, source_type, status, revision,
      correction_of_batch_id, correction_reason, created_by_employee_id)
  values
    (v_source_file_id, p_fact_kind, p_fiscal_month, p_source_type, 'received', v_revision,
      p_correction_of_batch_id, p_correction_reason, p_actor_employee_id)
  returning id into v_batch_id;

  for v_row in select value from jsonb_array_elements(p_raw_rows)
  loop
    insert into dbf_ingest.raw_rows (batch_id, source_row_number, payload, payload_sha256)
    values (v_batch_id, (v_row->>'sourceRowNumber')::integer, v_row->'payload', lower(v_row->>'payloadSha256'));
  end loop;

  update dbf_ingest.import_batches set status = 'parsed' where id = v_batch_id;
  insert into dbf_ingest.import_events
    (batch_id, event_type, from_status, to_status, actor_employee_id, summary)
  values
    (v_batch_id, 'SOURCE_PARSED', 'received', 'parsed', p_actor_employee_id,
      jsonb_build_object('rowCount', jsonb_array_length(p_raw_rows), 'sourceFileId', v_source_file_id));
  return jsonb_build_object('batchId', v_batch_id, 'sourceFileId', v_source_file_id,
    'status', 'parsed', 'revision', v_revision, 'rowCount', jsonb_array_length(p_raw_rows));
end;
$$;

create or replace function public.dbf_import_resolve_mappings_v1(
  p_source_system text,
  p_requests jsonb
) returns jsonb
language sql
security definer
set search_path = pg_catalog, public, dbf_ingest
as $$
  with requested as (
    select value->>'entityType' as entity_type, value->>'sourceKey' as source_key
    from jsonb_array_elements(p_requests)
  ), resolved as (
    select r.entity_type, r.source_key, m.id as mapping_id, m.status,
      case r.entity_type
        when 'company' then m.company_id
        when 'store' then m.store_id
        when 'employee' then m.employee_id
        when 'organization' then m.organization_id
      end as canonical_id
    from requested r
    left join dbf_ingest.entity_mappings m
      on m.source_system = p_source_system and m.entity_type = r.entity_type and m.source_key = r.source_key
  )
  select jsonb_build_object('mappings', coalesce(jsonb_agg(jsonb_build_object(
    'entityType', entity_type, 'sourceKey', source_key, 'mappingId', mapping_id,
    'status', coalesce(status, 'unresolved'), 'canonicalId', canonical_id
  ) order by entity_type, source_key), '[]'::jsonb)) from resolved;
$$;

create or replace function public.dbf_import_quarantine_mappings_v1(
  p_actor_employee_id uuid,
  p_batch_id uuid,
  p_source_system text,
  p_mappings jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dbf_ingest
as $$
declare v_item jsonb; v_count integer := 0; v_status text;
begin
  select status into strict v_status from dbf_ingest.import_batches where id = p_batch_id for update;
  if v_status not in ('parsed','mapping_required') or jsonb_typeof(p_mappings) <> 'array' then
    raise exception using errcode = '22023', message = 'DBF_MAPPING_QUARANTINE_INVALID';
  end if;
  if not exists (
    select 1 from dbf_ingest.import_batches b join dbf_ingest.source_files f on f.id = b.source_file_id
    where b.id = p_batch_id and f.source_system = p_source_system
  ) then
    raise exception using errcode = '22023', message = 'DBF_MAPPING_SOURCE_SYSTEM_MISMATCH';
  end if;
  for v_item in select value from jsonb_array_elements(p_mappings)
  loop
    insert into dbf_ingest.entity_mappings
      (source_system, entity_type, source_key, source_label, status)
    values
      (p_source_system, v_item->>'entityType', v_item->>'sourceKey', v_item->>'sourceLabel', 'quarantined')
    on conflict (source_system, entity_type, source_key) do nothing;
    v_count := v_count + 1;
  end loop;
  update dbf_ingest.import_batches set status = 'mapping_required' where id = p_batch_id;
  insert into dbf_ingest.import_events
    (batch_id, event_type, from_status, to_status, actor_employee_id, summary)
  values (p_batch_id, 'MAPPING_QUARANTINED', v_status, 'mapping_required', p_actor_employee_id,
    jsonb_build_object('unresolvedCount', v_count));
  return jsonb_build_object('batchId', p_batch_id, 'status', 'mapping_required', 'unresolvedCount', v_count);
end;
$$;

create or replace function public.dbf_import_confirm_mapping_v1(
  p_actor_employee_id uuid,
  p_batch_id uuid,
  p_source_system text,
  p_entity_type text,
  p_source_key text,
  p_canonical_id uuid,
  p_canonical_evidence_sha256 text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dbf_ingest
as $$
declare v_mapping_id uuid;
begin
  if p_entity_type not in ('company','store') then
    raise exception using errcode = '22023', message = 'DBF_MAPPING_TYPE_INVALID';
  end if;
  if not exists (
    select 1 from dbf_ingest.import_batches b join dbf_ingest.source_files f on f.id = b.source_file_id
    where b.id = p_batch_id and f.source_system = p_source_system
  ) then
    raise exception using errcode = '22023', message = 'DBF_MAPPING_SOURCE_SYSTEM_MISMATCH';
  end if;
  update dbf_ingest.entity_mappings set
    company_id = case when p_entity_type = 'company' then p_canonical_id else null end,
    store_id = case when p_entity_type = 'store' then p_canonical_id else null end,
    employee_id = case when p_entity_type = 'employee' then p_canonical_id else null end,
    organization_id = case when p_entity_type = 'organization' then p_canonical_id else null end,
    canonical_evidence_sha256 = lower(p_canonical_evidence_sha256), status = 'active',
    confirmed_by_employee_id = p_actor_employee_id, confirmed_at = statement_timestamp()
  where source_system = p_source_system and entity_type = p_entity_type
    and source_key = p_source_key and status = 'quarantined'
  returning id into v_mapping_id;
  if v_mapping_id is null then
    raise exception using errcode = '22023', message = 'DBF_MAPPING_NOT_QUARANTINED';
  end if;
  insert into dbf_ingest.import_events
    (batch_id, event_type, actor_employee_id, summary)
  values (p_batch_id, 'MAPPING_CONFIRMED', p_actor_employee_id,
    jsonb_build_object('mappingId', v_mapping_id, 'entityType', p_entity_type));
  return jsonb_build_object('mappingId', v_mapping_id, 'status', 'active');
end;
$$;

create or replace function public.dbf_import_stage_v1(
  p_actor_employee_id uuid,
  p_batch_id uuid,
  p_fact_kind text,
  p_fiscal_month date,
  p_parser_receipt jsonb,
  p_rows jsonb,
  p_warning_codes jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dbf_ingest
as $$
declare
  v_batch dbf_ingest.import_batches%rowtype;
  v_row jsonb;
  v_warning jsonb;
  v_raw_row_id bigint;
  v_company_mapping dbf_ingest.entity_mappings%rowtype;
  v_store_mapping dbf_ingest.entity_mappings%rowtype;
  v_row_count integer;
  v_warning_count integer := 0;
  v_source_system text;
begin
  select * into strict v_batch from dbf_ingest.import_batches where id = p_batch_id for update;
  select source_system into strict v_source_system from dbf_ingest.source_files where id = v_batch.source_file_id;
  if v_batch.status not in ('parsed','mapping_required') or v_batch.fact_kind <> p_fact_kind
    or v_batch.fiscal_month <> p_fiscal_month or jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 10000 then
    raise exception using errcode = '22023', message = 'DBF_STAGE_REQUEST_INVALID';
  end if;
  select count(*) into v_row_count from dbf_ingest.raw_rows where batch_id = p_batch_id;
  if v_row_count <> jsonb_array_length(p_rows)
    or exists (select 1 from dbf_ingest.staging_rows where batch_id = p_batch_id) then
    raise exception using errcode = '22023', message = 'DBF_STAGE_ROWSET_MISMATCH';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    select id into strict v_raw_row_id from dbf_ingest.raw_rows
      where batch_id = p_batch_id and source_row_number = (v_row->>'sourceRowNumber')::integer;
    select * into strict v_company_mapping from dbf_ingest.entity_mappings
      where id = (v_row->>'companyMappingId')::uuid and status = 'active' and source_system = v_source_system;
    if v_company_mapping.entity_type <> 'company' or v_company_mapping.company_id <> (v_row->>'companyId')::uuid then
      raise exception using errcode = '22023', message = 'DBF_COMPANY_MAPPING_MISMATCH';
    end if;
    if nullif(v_row->>'storeMappingId','') is not null then
      select * into strict v_store_mapping from dbf_ingest.entity_mappings
        where id = (v_row->>'storeMappingId')::uuid and status = 'active' and source_system = v_source_system;
      if v_store_mapping.entity_type <> 'store' or v_store_mapping.store_id <> (v_row->>'storeId')::uuid then
        raise exception using errcode = '22023', message = 'DBF_STORE_MAPPING_MISMATCH';
      end if;
    end if;

    insert into dbf_ingest.staging_rows
      (batch_id, raw_row_id, company_mapping_id, store_mapping_id, company_id, store_id,
       employee_id, organization_id, account_code, account_name, metric_code,
       amount, quantity, rate, source_row_category, mapping_status, validation_status,
       normalized_payload)
    values
      (p_batch_id, v_raw_row_id, (v_row->>'companyMappingId')::uuid,
       nullif(v_row->>'storeMappingId','')::uuid, (v_row->>'companyId')::uuid,
       nullif(v_row->>'storeId','')::uuid, nullif(v_row->>'employeeId','')::uuid,
       nullif(v_row->>'organizationId','')::uuid, nullif(v_row->>'accountCode',''),
       nullif(v_row->>'accountName',''), nullif(v_row->>'metricCode',''),
       nullif(v_row->>'amount','')::numeric, nullif(v_row->>'quantity','')::numeric,
       nullif(v_row->>'rate','')::numeric, v_row->>'sourceRowCategory', 'resolved', 'valid',
       coalesce(v_row->'normalizedPayload','{}'::jsonb));
  end loop;

  if jsonb_typeof(p_warning_codes) = 'array' then
    for v_warning in select value from jsonb_array_elements(p_warning_codes)
    loop
      insert into dbf_ingest.validation_issues
        (batch_id, severity, rule_code, sanitized_message)
      values (p_batch_id, 'warning', trim(both '"' from v_warning::text), 'Owner review is required for this warning.');
      v_warning_count := v_warning_count + 1;
    end loop;
  end if;

  update dbf_ingest.import_batches set status = 'owner_review' where id = p_batch_id;
  insert into dbf_ingest.import_events
    (batch_id, event_type, from_status, to_status, actor_employee_id, summary)
  values (p_batch_id, 'VALIDATION_COMPLETED', v_batch.status, 'owner_review', p_actor_employee_id,
    jsonb_build_object('rowCount', v_row_count, 'warningCount', v_warning_count,
      'parserReceipt', p_parser_receipt));
  return jsonb_build_object('batchId', p_batch_id, 'status', 'owner_review',
    'rowCount', v_row_count, 'warningCount', v_warning_count, 'errorCount', 0);
end;
$$;

create or replace function public.dbf_import_preview_v1(p_batch_id uuid)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, dbf_ingest
as $$
  select jsonb_build_object(
    'batchId', b.id, 'factKind', b.fact_kind, 'fiscalMonth', to_char(b.fiscal_month, 'YYYY-MM'),
    'sourceType', b.source_type, 'status', b.status, 'revision', b.revision,
    'correctionOfBatchId', b.correction_of_batch_id,
    'rowCount', (select count(*) from dbf_ingest.staging_rows s where s.batch_id = b.id),
    'validCount', (select count(*) from dbf_ingest.staging_rows s where s.batch_id = b.id and s.validation_status in ('valid','warning')),
    'quarantinedCount', (select count(*) from dbf_ingest.staging_rows s where s.batch_id = b.id and (s.mapping_status <> 'resolved' or s.validation_status = 'quarantined')),
    'errorCount', (select count(*) from dbf_ingest.validation_issues i where i.batch_id = b.id and i.severity = 'error'),
    'warningCount', (select count(*) from dbf_ingest.validation_issues i where i.batch_id = b.id and i.severity = 'warning'),
    'issues', coalesce((select jsonb_agg(jsonb_build_object('severity', i.severity,
      'ruleCode', i.rule_code, 'fieldName', i.field_name, 'message', i.sanitized_message)
      order by i.id) from dbf_ingest.validation_issues i where i.batch_id = b.id), '[]'::jsonb),
    'promotionAllowed', b.status = 'approved'
      and not exists (select 1 from dbf_ingest.validation_issues i where i.batch_id = b.id and i.severity = 'error')
      and not exists (select 1 from dbf_ingest.staging_rows s where s.batch_id = b.id
        and (s.mapping_status <> 'resolved' or s.validation_status not in ('valid','warning')))
  ) from dbf_ingest.import_batches b where b.id = p_batch_id;
$$;

create or replace function public.dbf_import_approve_v1(
  p_actor_employee_id uuid,
  p_batch_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dbf_ingest
as $$
declare v_status text; v_count integer;
begin
  select status into strict v_status from dbf_ingest.import_batches where id = p_batch_id for update;
  select count(*) into v_count from dbf_ingest.staging_rows where batch_id = p_batch_id;
  if v_status <> 'owner_review' or v_count = 0
    or exists (select 1 from dbf_ingest.validation_issues where batch_id = p_batch_id and severity = 'error')
    or exists (select 1 from dbf_ingest.staging_rows where batch_id = p_batch_id
      and (mapping_status <> 'resolved' or validation_status not in ('valid','warning'))) then
    raise exception using errcode = '22023', message = 'DBF_OWNER_APPROVAL_REJECTED';
  end if;
  update dbf_ingest.import_batches set status = 'approved', approved_by_employee_id = p_actor_employee_id,
    approved_at = statement_timestamp() where id = p_batch_id;
  insert into dbf_ingest.import_events
    (batch_id, event_type, from_status, to_status, actor_employee_id, summary)
  values (p_batch_id, 'OWNER_APPROVED', 'owner_review', 'approved', p_actor_employee_id,
    jsonb_build_object('rowCount', v_count));
  return jsonb_build_object('batchId', p_batch_id, 'status', 'approved', 'rowCount', v_count);
end;
$$;

create or replace function public.dbf_import_promote_v1(
  p_actor_employee_id uuid,
  p_batch_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dbf_ingest
as $$
declare
  v_batch dbf_ingest.import_batches%rowtype;
  v_expected integer;
  v_matched integer;
  v_original_count integer;
  v_promoted integer := 0;
begin
  select * into strict v_batch from dbf_ingest.import_batches where id = p_batch_id for update;
  select count(*) into v_expected from dbf_ingest.staging_rows
    where batch_id = p_batch_id and mapping_status = 'resolved' and validation_status in ('valid','warning');
  if v_batch.status <> 'approved' or v_expected = 0
    or exists (select 1 from dbf_ingest.validation_issues where batch_id = p_batch_id and severity = 'error')
    or exists (select 1 from dbf_ingest.staging_rows where batch_id = p_batch_id
      and (mapping_status <> 'resolved' or validation_status not in ('valid','warning'))) then
    raise exception using errcode = '22023', message = 'DBF_PROMOTION_BOUNDARY_REJECTED';
  end if;
  if v_batch.correction_of_batch_id is not null and not exists (
    select 1 from dbf_ingest.import_batches original
    where original.id = v_batch.correction_of_batch_id
      and original.fact_kind = v_batch.fact_kind
      and original.fiscal_month = v_batch.fiscal_month
      and original.status = 'promoted'
  ) then
    raise exception using errcode = '22023', message = 'DBF_CORRECTION_LINEAGE_INVALID';
  end if;

  if v_batch.fact_kind = 'pl' then
    if v_batch.correction_of_batch_id is null then
      if exists (
        select 1 from dbf_ingest.staging_rows s
        join public.dbf_pl_detail_facts f on s.source_row_category = 'detail'
          and f.fiscal_month = v_batch.fiscal_month and f.company_id = s.company_id
          and f.store_id is not distinct from s.store_id and f.account_code = s.account_code and f.is_active
        where s.batch_id = p_batch_id
      ) or exists (
        select 1 from dbf_ingest.staging_rows s
        join public.dbf_pl_aggregate_facts f on s.source_row_category = 'aggregate'
          and f.fiscal_month = v_batch.fiscal_month and f.company_id = s.company_id
          and f.aggregate_scope = s.normalized_payload->>'aggregateScope'
          and f.account_code = s.account_code and f.is_active
        where s.batch_id = p_batch_id
      ) then raise exception using errcode = '23505', message = 'DBF_ACTIVE_VERSION_EXISTS'; end if;
    else
      select count(*) into v_matched from dbf_ingest.staging_rows s
      left join public.dbf_pl_detail_facts d on s.source_row_category = 'detail'
        and d.batch_id = v_batch.correction_of_batch_id and d.fiscal_month = v_batch.fiscal_month
        and d.company_id = s.company_id and d.store_id is not distinct from s.store_id
        and d.account_code = s.account_code and d.is_active
      left join public.dbf_pl_aggregate_facts a on s.source_row_category = 'aggregate'
        and a.batch_id = v_batch.correction_of_batch_id and a.fiscal_month = v_batch.fiscal_month
        and a.company_id = s.company_id and a.aggregate_scope = s.normalized_payload->>'aggregateScope'
        and a.account_code = s.account_code and a.is_active
      where s.batch_id = p_batch_id and (d.id is not null or a.id is not null);
      select
        (select count(*) from public.dbf_pl_detail_facts where batch_id = v_batch.correction_of_batch_id and is_active)
        + (select count(*) from public.dbf_pl_aggregate_facts where batch_id = v_batch.correction_of_batch_id and is_active)
      into v_original_count;
      if v_matched <> v_expected or v_original_count <> v_expected then raise exception using errcode = '22023', message = 'DBF_CORRECTION_GRAIN_MISMATCH'; end if;
      update public.dbf_pl_detail_facts f set is_active = false, superseded_at = statement_timestamp()
      from dbf_ingest.staging_rows s where s.batch_id = p_batch_id and s.source_row_category = 'detail'
        and f.batch_id = v_batch.correction_of_batch_id and f.fiscal_month = v_batch.fiscal_month
        and f.company_id = s.company_id and f.store_id is not distinct from s.store_id
        and f.account_code = s.account_code and f.is_active;
      update public.dbf_pl_aggregate_facts f set is_active = false, superseded_at = statement_timestamp()
      from dbf_ingest.staging_rows s where s.batch_id = p_batch_id and s.source_row_category = 'aggregate'
        and f.batch_id = v_batch.correction_of_batch_id and f.fiscal_month = v_batch.fiscal_month
        and f.company_id = s.company_id and f.aggregate_scope = s.normalized_payload->>'aggregateScope'
        and f.account_code = s.account_code and f.is_active;
    end if;
    insert into public.dbf_pl_detail_facts
      (fiscal_month, company_id, store_id, account_code, account_name, amount, source_type,
       source_file_id, batch_id, imported_by_employee_id, version, status, correction_of_fact_id, correction_reason)
    select v_batch.fiscal_month, s.company_id, s.store_id, s.account_code, s.account_name, s.amount,
      v_batch.source_type, v_batch.source_file_id, p_batch_id, p_actor_employee_id,
      coalesce(old.version + 1, 1), s.normalized_payload->>'confirmationStatus', old.id,
      case when old.id is not null then v_batch.correction_reason end
    from dbf_ingest.staging_rows s
    left join public.dbf_pl_detail_facts old on v_batch.correction_of_batch_id is not null
      and old.batch_id = v_batch.correction_of_batch_id and old.fiscal_month = v_batch.fiscal_month
      and old.company_id = s.company_id and old.store_id is not distinct from s.store_id
      and old.account_code = s.account_code
    where s.batch_id = p_batch_id and s.source_row_category = 'detail';
    get diagnostics v_promoted = row_count;
    insert into public.dbf_pl_aggregate_facts
      (fiscal_month, company_id, aggregate_scope, account_code, account_name, amount, source_type,
       source_file_id, batch_id, imported_by_employee_id, version, status, correction_of_fact_id, correction_reason)
    select v_batch.fiscal_month, s.company_id, s.normalized_payload->>'aggregateScope', s.account_code,
      s.account_name, s.amount, v_batch.source_type, v_batch.source_file_id, p_batch_id,
      p_actor_employee_id, coalesce(old.version + 1, 1), s.normalized_payload->>'confirmationStatus',
      old.id, case when old.id is not null then v_batch.correction_reason end
    from dbf_ingest.staging_rows s
    left join public.dbf_pl_aggregate_facts old on v_batch.correction_of_batch_id is not null
      and old.batch_id = v_batch.correction_of_batch_id and old.fiscal_month = v_batch.fiscal_month
      and old.company_id = s.company_id and old.aggregate_scope = s.normalized_payload->>'aggregateScope'
      and old.account_code = s.account_code
    where s.batch_id = p_batch_id and s.source_row_category = 'aggregate';
    get diagnostics v_matched = row_count;
    v_promoted := v_promoted + v_matched;

  elsif v_batch.fact_kind = 'bs' then
    if v_batch.correction_of_batch_id is null and exists (
      select 1 from dbf_ingest.staging_rows s join public.dbf_bs_facts f
        on f.fiscal_month = v_batch.fiscal_month and f.company_id = s.company_id
        and f.account_code = s.account_code and f.is_active where s.batch_id = p_batch_id
    ) then raise exception using errcode = '23505', message = 'DBF_ACTIVE_VERSION_EXISTS'; end if;
    if v_batch.correction_of_batch_id is not null then
      select count(*) into v_matched from dbf_ingest.staging_rows s join public.dbf_bs_facts f
        on f.batch_id = v_batch.correction_of_batch_id and f.fiscal_month = v_batch.fiscal_month
        and f.company_id = s.company_id and f.account_code = s.account_code and f.is_active
        where s.batch_id = p_batch_id;
      select count(*) into v_original_count from public.dbf_bs_facts
        where batch_id = v_batch.correction_of_batch_id and is_active;
      if v_matched <> v_expected or v_original_count <> v_expected then raise exception using errcode = '22023', message = 'DBF_CORRECTION_GRAIN_MISMATCH'; end if;
      update public.dbf_bs_facts f set is_active = false, superseded_at = statement_timestamp()
      from dbf_ingest.staging_rows s where s.batch_id = p_batch_id
        and f.batch_id = v_batch.correction_of_batch_id and f.fiscal_month = v_batch.fiscal_month
        and f.company_id = s.company_id and f.account_code = s.account_code and f.is_active;
    end if;
    insert into public.dbf_bs_facts
      (fiscal_month, company_id, account_code, account_name, amount, classification,
       source_file_id, batch_id, imported_by_employee_id, version, status,
       correction_of_fact_id, correction_reason)
    select v_batch.fiscal_month, s.company_id, s.account_code, s.account_name, s.amount,
      s.normalized_payload->>'classification', v_batch.source_file_id, p_batch_id,
      p_actor_employee_id, coalesce(old.version + 1, 1), s.normalized_payload->>'confirmationStatus',
      old.id, case when old.id is not null then v_batch.correction_reason end
    from dbf_ingest.staging_rows s left join public.dbf_bs_facts old
      on v_batch.correction_of_batch_id is not null and old.batch_id = v_batch.correction_of_batch_id
      and old.fiscal_month = v_batch.fiscal_month and old.company_id = s.company_id
      and old.account_code = s.account_code where s.batch_id = p_batch_id;
    get diagnostics v_promoted = row_count;

  elsif v_batch.fact_kind = 'store_operating_result' then
    if v_batch.correction_of_batch_id is null and exists (
      select 1 from dbf_ingest.staging_rows s join public.dbf_store_monthly_metric_facts f
        on f.fiscal_month = v_batch.fiscal_month and f.company_id = s.company_id
        and f.store_id = s.store_id and f.metric_code = s.metric_code and f.is_active
        where s.batch_id = p_batch_id
    ) then raise exception using errcode = '23505', message = 'DBF_ACTIVE_VERSION_EXISTS'; end if;
    if v_batch.correction_of_batch_id is not null then
      select count(*) into v_matched from dbf_ingest.staging_rows s join public.dbf_store_monthly_metric_facts f
        on f.batch_id = v_batch.correction_of_batch_id and f.fiscal_month = v_batch.fiscal_month
        and f.company_id = s.company_id and f.store_id = s.store_id
        and f.metric_code = s.metric_code and f.is_active where s.batch_id = p_batch_id;
      select count(*) into v_original_count from public.dbf_store_monthly_metric_facts
        where batch_id = v_batch.correction_of_batch_id and is_active;
      if v_matched <> v_expected or v_original_count <> v_expected then raise exception using errcode = '22023', message = 'DBF_CORRECTION_GRAIN_MISMATCH'; end if;
      update public.dbf_store_monthly_metric_facts f set is_active = false, superseded_at = statement_timestamp()
      from dbf_ingest.staging_rows s where s.batch_id = p_batch_id
        and f.batch_id = v_batch.correction_of_batch_id and f.fiscal_month = v_batch.fiscal_month
        and f.company_id = s.company_id and f.store_id = s.store_id
        and f.metric_code = s.metric_code and f.is_active;
    end if;
    insert into public.dbf_store_monthly_metric_facts
      (fiscal_month, company_id, store_id, metric_code, amount, quantity, rate,
       definition_version, source_type, source_file_id, batch_id, imported_by_employee_id,
       version, status, correction_of_fact_id, correction_reason)
    select v_batch.fiscal_month, s.company_id, s.store_id, s.metric_code, s.amount, s.quantity, s.rate,
      s.normalized_payload->>'definitionVersion', v_batch.source_type, v_batch.source_file_id,
      p_batch_id, p_actor_employee_id, coalesce(old.version + 1, 1),
      s.normalized_payload->>'confirmationStatus', old.id,
      case when old.id is not null then v_batch.correction_reason end
    from dbf_ingest.staging_rows s left join public.dbf_store_monthly_metric_facts old
      on v_batch.correction_of_batch_id is not null and old.batch_id = v_batch.correction_of_batch_id
      and old.fiscal_month = v_batch.fiscal_month and old.company_id = s.company_id
      and old.store_id = s.store_id and old.metric_code = s.metric_code
    where s.batch_id = p_batch_id;
    get diagnostics v_promoted = row_count;

  elsif v_batch.fact_kind = 'budget' then
    if v_batch.correction_of_batch_id is null and exists (
      select 1 from dbf_ingest.staging_rows s join public.dbf_budget_facts f
        on f.fiscal_month = v_batch.fiscal_month and f.company_id = s.company_id
        and f.store_id is not distinct from s.store_id and f.organization_id is not distinct from s.organization_id
        and f.scenario_code = s.normalized_payload->>'scenarioCode'
        and f.account_code is not distinct from s.account_code and f.metric_code is not distinct from s.metric_code
        and f.is_active where s.batch_id = p_batch_id
    ) then raise exception using errcode = '23505', message = 'DBF_ACTIVE_VERSION_EXISTS'; end if;
    if v_batch.correction_of_batch_id is not null then
      select count(*) into v_matched from dbf_ingest.staging_rows s join public.dbf_budget_facts f
        on f.batch_id = v_batch.correction_of_batch_id and f.fiscal_month = v_batch.fiscal_month
        and f.company_id = s.company_id and f.store_id is not distinct from s.store_id
        and f.organization_id is not distinct from s.organization_id
        and f.scenario_code = s.normalized_payload->>'scenarioCode'
        and f.account_code is not distinct from s.account_code and f.metric_code is not distinct from s.metric_code
        and f.is_active where s.batch_id = p_batch_id;
      select count(*) into v_original_count from public.dbf_budget_facts
        where batch_id = v_batch.correction_of_batch_id and is_active;
      if v_matched <> v_expected or v_original_count <> v_expected then raise exception using errcode = '22023', message = 'DBF_CORRECTION_GRAIN_MISMATCH'; end if;
      update public.dbf_budget_facts f set is_active = false, superseded_at = statement_timestamp()
      from dbf_ingest.staging_rows s where s.batch_id = p_batch_id
        and f.batch_id = v_batch.correction_of_batch_id and f.fiscal_month = v_batch.fiscal_month
        and f.company_id = s.company_id and f.store_id is not distinct from s.store_id
        and f.organization_id is not distinct from s.organization_id
        and f.scenario_code = s.normalized_payload->>'scenarioCode'
        and f.account_code is not distinct from s.account_code and f.metric_code is not distinct from s.metric_code
        and f.is_active;
    end if;
    insert into public.dbf_budget_facts
      (fiscal_month, company_id, store_id, organization_id, scenario_code, account_code,
       metric_code, amount, source_file_id, batch_id, imported_by_employee_id, version,
       status, correction_of_fact_id, correction_reason)
    select v_batch.fiscal_month, s.company_id, s.store_id, s.organization_id,
      s.normalized_payload->>'scenarioCode', s.account_code, s.metric_code, s.amount,
      v_batch.source_file_id, p_batch_id, p_actor_employee_id, coalesce(old.version + 1, 1),
      s.normalized_payload->>'confirmationStatus', old.id,
      case when old.id is not null then v_batch.correction_reason end
    from dbf_ingest.staging_rows s left join public.dbf_budget_facts old
      on v_batch.correction_of_batch_id is not null and old.batch_id = v_batch.correction_of_batch_id
      and old.fiscal_month = v_batch.fiscal_month and old.company_id = s.company_id
      and old.store_id is not distinct from s.store_id
      and old.organization_id is not distinct from s.organization_id
      and old.scenario_code = s.normalized_payload->>'scenarioCode'
      and old.account_code is not distinct from s.account_code and old.metric_code is not distinct from s.metric_code
    where s.batch_id = p_batch_id;
    get diagnostics v_promoted = row_count;
  end if;

  if v_promoted <> v_expected then
    raise exception using errcode = '22023', message = 'DBF_PROMOTION_ROWCOUNT_MISMATCH';
  end if;
  if v_batch.correction_of_batch_id is not null then
    update dbf_ingest.import_batches set status = 'superseded' where id = v_batch.correction_of_batch_id;
  end if;
  update dbf_ingest.import_batches set status = 'promoted', promoted_at = statement_timestamp() where id = p_batch_id;
  insert into dbf_ingest.import_events
    (batch_id, event_type, from_status, to_status, actor_employee_id, summary)
  values (p_batch_id, case when v_batch.correction_of_batch_id is null then 'VERSION_PROMOTED' else 'CORRECTION_PROMOTED' end,
    'approved', 'promoted', p_actor_employee_id,
    jsonb_build_object('rowCount', v_promoted, 'revision', v_batch.revision,
      'correctionOfBatchId', v_batch.correction_of_batch_id));
  return jsonb_build_object('batchId', p_batch_id, 'status', 'promoted',
    'rowCount', v_promoted, 'revision', v_batch.revision);
end;
$$;

create or replace function public.dbf_import_history_v1(
  p_fiscal_month date default null,
  p_fact_kind text default null,
  p_limit integer default 50
) returns jsonb
language sql
security definer
set search_path = pg_catalog, public, dbf_ingest
as $$
  select jsonb_build_object('items', coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb))
  from (
    select b.created_at, jsonb_build_object(
      'batchId', b.id, 'factKind', b.fact_kind, 'fiscalMonth', to_char(b.fiscal_month, 'YYYY-MM'),
      'sourceType', b.source_type, 'status', b.status, 'revision', b.revision,
      'correctionOfBatchId', b.correction_of_batch_id, 'createdAt', b.created_at,
      'approvedAt', b.approved_at, 'promotedAt', b.promoted_at,
      'rowCount', (select count(*) from dbf_ingest.raw_rows r where r.batch_id = b.id),
      'errorCount', (select count(*) from dbf_ingest.validation_issues i where i.batch_id = b.id and i.severity = 'error'),
      'warningCount', (select count(*) from dbf_ingest.validation_issues i where i.batch_id = b.id and i.severity = 'warning')
    ) as item
    from dbf_ingest.import_batches b
    where (p_fiscal_month is null or b.fiscal_month = p_fiscal_month)
      and (p_fact_kind is null or b.fact_kind = p_fact_kind)
    order by b.created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))
  ) history;
$$;

revoke all on function public.dbf_import_start_v1(uuid,jsonb,text,date,text,text,jsonb,uuid,text)
  from public, anon, authenticated;
revoke all on function public.dbf_import_resolve_mappings_v1(text,jsonb)
  from public, anon, authenticated;
revoke all on function public.dbf_import_quarantine_mappings_v1(uuid,uuid,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.dbf_import_confirm_mapping_v1(uuid,uuid,text,text,text,uuid,text)
  from public, anon, authenticated;
revoke all on function public.dbf_import_stage_v1(uuid,uuid,text,date,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
revoke all on function public.dbf_import_preview_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.dbf_import_approve_v1(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.dbf_import_promote_v1(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.dbf_import_history_v1(date,text,integer)
  from public, anon, authenticated;

grant execute on function public.dbf_import_start_v1(uuid,jsonb,text,date,text,text,jsonb,uuid,text)
  to service_role;
grant execute on function public.dbf_import_resolve_mappings_v1(text,jsonb)
  to service_role;
grant execute on function public.dbf_import_quarantine_mappings_v1(uuid,uuid,text,jsonb)
  to service_role;
grant execute on function public.dbf_import_confirm_mapping_v1(uuid,uuid,text,text,text,uuid,text)
  to service_role;
grant execute on function public.dbf_import_stage_v1(uuid,uuid,text,date,jsonb,jsonb,jsonb)
  to service_role;
grant execute on function public.dbf_import_preview_v1(uuid)
  to service_role;
grant execute on function public.dbf_import_approve_v1(uuid,uuid)
  to service_role;
grant execute on function public.dbf_import_promote_v1(uuid,uuid)
  to service_role;
grant execute on function public.dbf_import_history_v1(date,text,integer)
  to service_role;

comment on function public.dbf_import_promote_v1(uuid,uuid) is
  'Service-role-only atomic DBF promotion boundary. Rejects unresolved mapping, validation errors, unapproved batches, duplicate active versions, and invalid correction lineage.';

commit;
