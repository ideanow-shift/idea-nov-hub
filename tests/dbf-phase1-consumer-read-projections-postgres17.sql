\set ON_ERROR_STOP on

begin;

do $$
begin
  if has_function_privilege('anon', 'public.dbf_corporate_accounting_actual_read_v1(date,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.dbf_corporate_accounting_actual_read_v1(date,uuid)', 'execute') then
    raise exception 'Browser roles must not execute the corporate accounting actual read RPC';
  end if;
  if not has_function_privilege('service_role', 'public.dbf_corporate_accounting_actual_read_v1(date,uuid)', 'execute') then
    raise exception 'service_role execute grant is missing';
  end if;
end
$$;

insert into dbf_ingest.source_files (
  id, sha256, byte_size, original_file_name, media_type, source_system, received_by_employee_id
) values
  ('41000000-0000-4000-8000-000000000001', repeat('c', 64), 128, 'corporate.csv', 'text/csv', 'fixture', '90000000-0000-4000-8000-000000000001'),
  ('41000000-0000-4000-8000-000000000002', repeat('d', 64), 128, 'foreign.csv', 'text/csv', 'fixture', '90000000-0000-4000-8000-000000000001');

insert into dbf_ingest.import_batches (
  id, source_file_id, fact_kind, fiscal_month, source_type, status,
  created_by_employee_id, approved_by_employee_id, approved_at, promoted_at
) values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'pl', '2026-06-01', 'fixture', 'promoted',
   '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', statement_timestamp(), statement_timestamp()),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', 'bs', '2026-06-01', 'fixture', 'promoted',
   '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', statement_timestamp(), statement_timestamp()),
  ('42000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000002', 'pl', '2026-07-01', 'fixture', 'promoted',
   '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', statement_timestamp(), statement_timestamp());

insert into public.dbf_pl_detail_facts (
  id, fiscal_month, company_id, store_id, account_code, account_name, amount, source_type,
  source_file_id, batch_id, imported_by_employee_id, version, status, is_active, row_semantics, is_additive
) values
  ('43000000-0000-4000-8000-000000000001', '2026-06-01', '20000000-0000-4000-8000-000000000001', null,
   'PL-01', 'Sales', 123.45, 'fixture', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001',
   '90000000-0000-4000-8000-000000000001', 1, 'confirmed', true, 'POSTABLE_DETAIL', true),
  ('43000000-0000-4000-8000-000000000002', '2026-07-01', '20000000-0000-4000-8000-000000000002', null,
   'FOREIGN', 'Foreign', 999.99, 'fixture', '41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000003',
   '90000000-0000-4000-8000-000000000001', 1, 'confirmed', true, 'POSTABLE_DETAIL', true);

insert into public.dbf_pl_aggregate_facts (
  id, fiscal_month, company_id, aggregate_scope, account_code, account_name, amount, source_type,
  source_file_id, batch_id, imported_by_employee_id, version, status, is_active, row_semantics, is_additive
) values
  ('44000000-0000-4000-8000-000000000001', '2026-06-01', '20000000-0000-4000-8000-000000000001', 'company_total',
   'PL-TOTAL', 'Total', 123.45, 'fixture', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001',
   '90000000-0000-4000-8000-000000000001', 1, 'confirmed', true, 'CONTROL_TOTAL', false);

insert into public.dbf_bs_facts (
  id, fiscal_month, company_id, account_code, account_name, amount, classification,
  source_file_id, batch_id, imported_by_employee_id, version, status, is_active, row_semantics, is_additive
) values
  ('45000000-0000-4000-8000-000000000001', '2026-06-01', '20000000-0000-4000-8000-000000000001',
   'BS-01', 'Cash', 500.00, 'asset', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000001', 1, 'confirmed', true, 'POSTABLE_DETAIL', true);

set local role service_role;

do $$
declare
  actual_count integer;
  actual_amount text;
begin
  select count(*), max(amount_value) filter (where account_code='PL-01')
    into actual_count, actual_amount
  from public.dbf_corporate_accounting_actual_read_v1(
    '2026-06-01', '20000000-0000-4000-8000-000000000001'
  );
  if actual_count <> 3 or actual_amount <> '123.45' then
    raise exception 'Corporate actual scope failed: count %, amount %', actual_count, actual_amount;
  end if;

  select count(*) into actual_count
  from public.dbf_corporate_accounting_actual_read_v1(
    '2026-06-01', '20000000-0000-4000-8000-000000000002'
  );
  if actual_count <> 0 then
    raise exception 'Foreign company facts leaked into the projection';
  end if;

  begin
    perform * from public.dbf_corporate_accounting_actual_read_v1(
      '2026-06-02', '20000000-0000-4000-8000-000000000001'
    );
    raise exception 'Non-normalized month was accepted';
  exception when sqlstate '22023' then
    null;
  end;
end
$$;

reset role;
rollback;
