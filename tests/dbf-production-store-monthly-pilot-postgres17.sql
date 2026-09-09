\set ON_ERROR_STOP on

begin;

do $$
declare
  v_actor uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_batch uuid;
  v_company_mapping uuid;
  v_ikebukuro_mapping uuid;
  v_kamishakujii_mapping uuid;
  v_contract jsonb := jsonb_build_object(
    'manifestRef', 'db6c78fdf791a7cbf35921eefb8367bca73eff4b07f00110b5741fb874487019',
    'sourceSystem', 'store-monthly-pilot-20260909',
    'fileSha256', 'bef80ca154226012ad44c59ce500cf91593425ed0289e5b1ef8dd16507acbac1',
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
  );
  v_raw jsonb;
  v_rows jsonb;
  v_result jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'sourceRowNumber', numbered.n,
    'payload', jsonb_build_object(
      'fiscal_month', '2026-06',
      'company_key', '0001',
      'store_key', numbered.store_key,
      'scenario_code', 'BASE',
      'account_code', '',
      'metric_code', numbered.metric_code,
      'amount', numbered.amount::text,
      'confirmation_status', 'confirmed'
    ),
    'payloadSha256', repeat('a', 64)
  ) order by numbered.n)
  into v_raw
  from (values
    (1, 'kamishakujii', 'TOTAL_SALES', 101::numeric),
    (2, 'kamishakujii', 'TECHNICAL_SALES', 102::numeric),
    (3, 'kamishakujii', 'RETAIL_SALES', 103::numeric),
    (4, 'ikebukuro', 'TOTAL_SALES', 201::numeric),
    (5, 'ikebukuro', 'TECHNICAL_SALES', 202::numeric),
    (6, 'ikebukuro', 'RETAIL_SALES', 203::numeric)
  ) numbered(n, store_key, metric_code, amount);

  v_result := public.dbf_import_store_monthly_pilot_start_v1(
    v_actor,
    jsonb_build_object(
      'sha256', 'bef80ca154226012ad44c59ce500cf91593425ed0289e5b1ef8dd16507acbac1',
      'byteSize', 474,
      'originalFileName', '2026-06-pilot-store-budget.csv',
      'mediaType', 'text/csv'
    ),
    'budget', date '2026-06-01', 'store_monthly_budget',
    'store-monthly-pilot-20260909', v_raw, v_contract
  );
  v_batch := (v_result->>'batchId')::uuid;

  perform public.dbf_import_quarantine_mappings_v1(
    v_actor, v_batch, 'store-monthly-pilot-20260909',
    jsonb_build_array(
      jsonb_build_object('entityType','company','sourceKey','0001','sourceLabel','company'),
      jsonb_build_object('entityType','store','sourceKey','ikebukuro','sourceLabel','store-a'),
      jsonb_build_object('entityType','store','sourceKey','kamishakujii','sourceLabel','store-b')
    )
  );
  perform public.dbf_import_confirm_mapping_v1(
    v_actor, v_batch, 'store-monthly-pilot-20260909', 'company', '0001',
    'e4059116-bdb3-4e13-9763-bbc77bdfe062', repeat('b', 64)
  );
  perform public.dbf_import_confirm_mapping_v1(
    v_actor, v_batch, 'store-monthly-pilot-20260909', 'store', 'ikebukuro',
    '36c222de-0554-4265-b177-3b68285cc4a4', repeat('c', 64)
  );
  perform public.dbf_import_confirm_mapping_v1(
    v_actor, v_batch, 'store-monthly-pilot-20260909', 'store', 'kamishakujii',
    '1bcba30a-d063-4cdb-be74-425e250aeb25', repeat('d', 64)
  );
  select id into strict v_company_mapping from dbf_ingest.entity_mappings
    where source_system = 'store-monthly-pilot-20260909' and entity_type = 'company' and source_key = '0001';
  select id into strict v_ikebukuro_mapping from dbf_ingest.entity_mappings
    where source_system = 'store-monthly-pilot-20260909' and entity_type = 'store' and source_key = 'ikebukuro';
  select id into strict v_kamishakujii_mapping from dbf_ingest.entity_mappings
    where source_system = 'store-monthly-pilot-20260909' and entity_type = 'store' and source_key = 'kamishakujii';

  select jsonb_agg(jsonb_build_object(
    'sourceRowNumber', numbered.n,
    'companyMappingId', v_company_mapping,
    'storeMappingId', case numbered.store_key when 'ikebukuro' then v_ikebukuro_mapping else v_kamishakujii_mapping end,
    'companyId', 'e4059116-bdb3-4e13-9763-bbc77bdfe062',
    'storeId', case numbered.store_key
      when 'ikebukuro' then '36c222de-0554-4265-b177-3b68285cc4a4'
      else '1bcba30a-d063-4cdb-be74-425e250aeb25' end,
    'employeeId', null,
    'organizationId', null,
    'accountCode', null,
    'accountName', null,
    'metricCode', numbered.metric_code,
    'amount', numbered.amount,
    'quantity', null,
    'rate', null,
    'sourceRowCategory', 'detail',
    'mappingStatus', 'resolved',
    'validationStatus', 'valid',
    'normalizedPayload', jsonb_build_object('scenarioCode','BASE','confirmationStatus','confirmed')
  ) order by numbered.n)
  into v_rows
  from (values
    (1, 'kamishakujii', 'TOTAL_SALES', 101::numeric),
    (2, 'kamishakujii', 'TECHNICAL_SALES', 102::numeric),
    (3, 'kamishakujii', 'RETAIL_SALES', 103::numeric),
    (4, 'ikebukuro', 'TOTAL_SALES', 201::numeric),
    (5, 'ikebukuro', 'TECHNICAL_SALES', 202::numeric),
    (6, 'ikebukuro', 'RETAIL_SALES', 203::numeric)
  ) numbered(n, store_key, metric_code, amount);

  perform public.dbf_import_store_monthly_pilot_stage_v1(
    v_actor, v_batch, 'budget', date '2026-06-01',
    jsonb_build_object('statement','BUDGET','status','PARSED','balanceCheck',null,'parserVersion','pilot-test-v1'),
    v_rows, '[]'::jsonb, v_contract
  );
  perform public.dbf_import_store_monthly_pilot_approve_v1(v_actor, v_batch, true, v_contract);
  perform public.dbf_import_store_monthly_pilot_promote_v1(v_actor, v_batch, v_contract);
  v_result := public.dbf_import_store_monthly_pilot_promote_v1(v_actor, v_batch, v_contract);
  if v_result->>'status' <> 'promoted' or (v_result->>'idempotent')::boolean is not true then
    raise exception 'pilot promotion idempotency failed';
  end if;
  if (select count(*) from public.dbf_budget_facts where batch_id = v_batch and is_active) <> 6 then
    raise exception 'pilot budget fact count mismatch';
  end if;
  if (select count(*) from public.dbf_store_monthly_metric_facts) <> 0 then
    raise exception 'unexpected store metric fact write';
  end if;
  if (select count(*) from dbf_ingest.import_events
      where batch_id = v_batch and event_type = 'PRODUCTION_PILOT_PROMOTED') <> 1 then
    raise exception 'pilot promotion audit mismatch';
  end if;
end
$$;

do $$
begin
  if has_function_privilege('anon', 'public.dbf_import_store_monthly_pilot_promote_v1(uuid,uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.dbf_import_store_monthly_pilot_promote_v1(uuid,uuid,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.dbf_import_store_monthly_pilot_promote_v1(uuid,uuid,jsonb)', 'EXECUTE') then
    raise exception 'pilot RPC grant boundary mismatch';
  end if;
  if position('public' in pg_get_functiondef(
    'public.dbf_import_store_monthly_pilot_promote_v1(uuid,uuid,jsonb)'::regprocedure
  )) > 0 and exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'dbf_import_store_monthly_pilot_promote_v1'
      and p.proconfig::text like '%search_path%public%'
  ) then
    raise exception 'pilot RPC search_path is not hardened';
  end if;
end
$$;

rollback;
