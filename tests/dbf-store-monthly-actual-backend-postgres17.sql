\set ON_ERROR_STOP on

begin;

do $$
begin
  if has_function_privilege('anon', 'public.dbf_store_monthly_actual_read_v1(date,uuid,uuid[])', 'execute')
     or has_function_privilege('authenticated', 'public.dbf_store_monthly_actual_read_v1(date,uuid,uuid[])', 'execute') then
    raise exception 'Browser roles must not execute the store monthly actual RPC';
  end if;
  if not has_function_privilege('service_role', 'public.dbf_store_monthly_actual_read_v1(date,uuid,uuid[])', 'execute') then
    raise exception 'service_role execute grant is missing';
  end if;
end
$$;

insert into dbf_ingest.source_files (
  id, sha256, byte_size, original_file_name, media_type, source_system, received_by_employee_id
) values
  ('10000000-0000-4000-8000-000000000001', repeat('a', 64), 128, 'store-monthly.csv', 'text/csv', 'fixture', '90000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', repeat('b', 64), 128, 'other-company.csv', 'text/csv', 'fixture', '90000000-0000-4000-8000-000000000001');

insert into dbf_ingest.import_batches (
  id, source_file_id, fact_kind, fiscal_month, source_type, status,
  created_by_employee_id, approved_by_employee_id, approved_at, promoted_at
) values
  (
    '11000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'store_operating_result', '2026-06-01', 'fixture', 'promoted',
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001', statement_timestamp(), statement_timestamp()
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'store_operating_result', '2026-06-01', 'fixture', 'promoted',
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001', statement_timestamp(), statement_timestamp()
  );

insert into public.dbf_store_monthly_metric_facts (
  id, fiscal_month, company_id, store_id, metric_code, amount, definition_version,
  source_type, source_file_id, batch_id, imported_by_employee_id, version, status, is_active
) values
  (
    '12000000-0000-4000-8000-000000000001', '2026-06-01',
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
    'TOTAL_SALES', 1234567.00, 'v1', 'store_operating_result',
    '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001', 1, 'confirmed', true
  ),
  (
    '12000000-0000-4000-8000-000000000002', '2026-06-01',
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002',
    'TOTAL_SALES', 7654321.00, 'v1', 'store_operating_result',
    '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001', 1, 'provisional', true
  ),
  (
    '12000000-0000-4000-8000-000000000003', '2026-06-01',
    '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003',
    'TOTAL_SALES', 9999999.00, 'v1', 'store_operating_result',
    '10000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000001', 1, 'confirmed', true
  );

set local role service_role;

do $$
declare
  actual_count integer;
  actual_value text;
begin
  select count(*), max(metric_value)
    into actual_count, actual_value
  from public.dbf_store_monthly_actual_read_v1(
    '2026-06-01',
    '20000000-0000-4000-8000-000000000001',
    array[
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002'
    ]::uuid[]
  );
  if actual_count <> 1 or actual_value <> '1234567.00' then
    raise exception 'Confirmed fact scope failed: count %, value %', actual_count, actual_value;
  end if;

  select count(*) into actual_count
  from public.dbf_store_monthly_actual_read_v1(
    '2026-06-01',
    '20000000-0000-4000-8000-000000000001',
    array['30000000-0000-4000-8000-000000000004']::uuid[]
  );
  if actual_count <> 0 then
    raise exception 'Missing stores must remain missing';
  end if;

  begin
    perform * from public.dbf_store_monthly_actual_read_v1(
      '2026-06-02',
      '20000000-0000-4000-8000-000000000001',
      array['30000000-0000-4000-8000-000000000001']::uuid[]
    );
    raise exception 'Non-normalized month was accepted';
  exception when sqlstate '22023' then
    null;
  end;

  begin
    perform * from public.dbf_store_monthly_actual_read_v1(
      '2026-06-01',
      '20000000-0000-4000-8000-000000000001',
      array[
        '30000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000001'
      ]::uuid[]
    );
    raise exception 'Duplicate store scope was accepted';
  exception when sqlstate '22023' then
    null;
  end;
end
$$;

reset role;

rollback;
