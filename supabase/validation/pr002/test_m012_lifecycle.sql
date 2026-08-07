-- PR002 / M012 lifecycle DB regression. Synthetic data only; transaction always rolls back.
begin;

create temporary table m012_lifecycle_test_results (
  test_name text primary key,
  result text not null check (result = 'passed')
) on commit drop;

create function pg_temp.m012_expect_failure(p_test_name text, p_sql text)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  begin
    execute p_sql;
  exception when others then
    insert into pg_temp.m012_lifecycle_test_results values (p_test_name, 'passed');
    return;
  end;
  raise exception 'BDF_M012_EXPECTED_FAILURE_DID_NOT_OCCUR test=%', p_test_name;
end
$function$;

select pg_temp.m012_expect_failure(
  'batch_insert_validating',
  $$insert into accounting.import_batches
    (source_system, source_version, source_file, source_period, source_hash,
     schema_version, mapping_contract_version, tax_normalization_contract_version,
     status, created_by)
    values ('synthetic', 'direct-batch-validating', 'fixture.csv',
      daterange('2026-07-01', '2026-08-01', '[)'), repeat('1',64),
      'schema-v1', 'mapping-v1', 'tax-v1', 'validating', 'audit:m012-test')$$
);
select pg_temp.m012_expect_failure(
  'batch_insert_validated',
  $$insert into accounting.import_batches
    (source_system, source_version, source_file, source_period, source_hash,
     schema_version, mapping_contract_version, tax_normalization_contract_version,
     status, created_by)
    values ('synthetic', 'direct-batch-validated', 'fixture.csv',
      daterange('2026-07-01', '2026-08-01', '[)'), repeat('2',64),
      'schema-v1', 'mapping-v1', 'tax-v1', 'validated', 'audit:m012-test')$$
);
select pg_temp.m012_expect_failure(
  'batch_insert_rejected',
  $$insert into accounting.import_batches
    (source_system, source_version, source_file, source_period, source_hash,
     schema_version, mapping_contract_version, tax_normalization_contract_version,
     status, created_by)
    values ('synthetic', 'direct-batch-rejected', 'fixture.csv',
      daterange('2026-07-01', '2026-08-01', '[)'), repeat('3',64),
      'schema-v1', 'mapping-v1', 'tax-v1', 'rejected', 'audit:m012-test')$$
);
select pg_temp.m012_expect_failure(
  'batch_insert_promoted',
  $$insert into accounting.import_batches
    (source_system, source_version, source_file, source_period, source_hash,
     schema_version, mapping_contract_version, tax_normalization_contract_version,
     status, created_by)
    values ('synthetic', 'direct-batch-promoted', 'fixture.csv',
      daterange('2026-07-01', '2026-08-01', '[)'), repeat('4',64),
      'schema-v1', 'mapping-v1', 'tax-v1', 'promoted', 'audit:m012-test')$$
);
select pg_temp.m012_expect_failure(
  'batch_insert_superseded',
  $$insert into accounting.import_batches
    (source_system, source_version, source_file, source_period, source_hash,
     schema_version, mapping_contract_version, tax_normalization_contract_version,
     status, created_by)
    values ('synthetic', 'direct-batch-superseded', 'fixture.csv',
      daterange('2026-07-01', '2026-08-01', '[)'), repeat('5',64),
      'schema-v1', 'mapping-v1', 'tax-v1', 'superseded', 'audit:m012-test')$$
);

insert into accounting.import_batches (
  import_batch_id, source_system, source_version, source_file, source_period,
  source_hash, schema_version, mapping_contract_version,
  tax_normalization_contract_version, created_by
) values (
  '00000000-0000-4000-8000-000000000120', 'synthetic', 'normal-lifecycle',
  'fixture.csv', daterange('2026-07-01', '2026-08-01', '[)'), repeat('a',64),
  'schema-v1', 'mapping-v1', 'tax-v1', 'audit:m012-test'
);

select pg_temp.m012_expect_failure(
  'file_insert_validating',
  $$insert into accounting.import_files
    (import_batch_id, file_name, file_type, file_hash, row_count, validation_status)
    values ('00000000-0000-4000-8000-000000000120', 'invalid1.csv', 'csv', repeat('b',64), 0, 'validating')$$
);
select pg_temp.m012_expect_failure(
  'file_insert_validated',
  $$insert into accounting.import_files
    (import_batch_id, file_name, file_type, file_hash, row_count, validation_status)
    values ('00000000-0000-4000-8000-000000000120', 'invalid2.csv', 'csv', repeat('c',64), 0, 'validated')$$
);
select pg_temp.m012_expect_failure(
  'file_insert_rejected',
  $$insert into accounting.import_files
    (import_batch_id, file_name, file_type, file_hash, row_count, validation_status)
    values ('00000000-0000-4000-8000-000000000120', 'invalid3.csv', 'csv', repeat('d',64), 0, 'rejected')$$
);

insert into accounting.import_files (
  import_file_id, import_batch_id, file_name, file_type, file_hash, row_count
) values (
  '00000000-0000-4000-8000-000000000121',
  '00000000-0000-4000-8000-000000000120',
  'fixture.csv', 'csv', repeat('e',64), 2
);

select pg_temp.m012_expect_failure(
  'line_insert_valid',
  $$insert into accounting.import_staging_lines
    (import_batch_id, import_file_id, source_record_key_digest, source_line_no,
     row_digest, accounting_period, corporation_source_key_digest,
     account_source_key_digest, scenario_type, measure_type, source_amount,
     source_tax_basis, source_tax_category, source_tax_rate,
     tax_rate_source_version, rounding_mode, rounding_scope, rounding_unit,
     rounding_difference_amount, normalized_amount, tax_basis, value_status,
     normalization_status, mapping_status, validation_status)
    values ('00000000-0000-4000-8000-000000000120',
      '00000000-0000-4000-8000-000000000121', repeat('1',64), 901,
      repeat('2',64), '2026-07-01', repeat('3',64), repeat('4',64),
      'actual', 'period_flow', 110, 'inclusive', 'taxable_standard', 0.1,
      'tax-jp-v1', 'floor', 'line', 1, 0, 100, 'exclusive', 'observed',
      'passed', 'passed', 'valid')$$
);
select pg_temp.m012_expect_failure(
  'line_insert_invalid',
  $$insert into accounting.import_staging_lines
    (import_batch_id, import_file_id, source_record_key_digest, source_line_no,
     row_digest, accounting_period, corporation_source_key_digest,
     account_source_key_digest, scenario_type, measure_type, source_tax_basis,
     source_tax_category, tax_rate_source_version, rounding_mode, rounding_scope,
     value_status, normalization_status, mapping_status, validation_status)
    values ('00000000-0000-4000-8000-000000000120',
      '00000000-0000-4000-8000-000000000121', repeat('5',64), 902,
      repeat('6',64), '2026-07-01', repeat('7',64), repeat('8',64),
      'actual', 'period_flow', 'unknown', 'unknown_tax', 'unknown', 'unknown',
      'unknown', 'validation_failed', 'failed', 'failed', 'invalid')$$
);
select pg_temp.m012_expect_failure(
  'line_insert_excluded',
  $$insert into accounting.import_staging_lines
    (import_batch_id, import_file_id, source_record_key_digest, source_line_no,
     row_digest, accounting_period, corporation_source_key_digest,
     account_source_key_digest, scenario_type, measure_type, source_tax_basis,
     source_tax_category, tax_rate_source_version, rounding_mode, rounding_scope,
     value_status, validation_status)
    values ('00000000-0000-4000-8000-000000000120',
      '00000000-0000-4000-8000-000000000121', repeat('9',64), 903,
      repeat('0',64), '2026-07-01', repeat('1',64), repeat('2',64),
      'actual', 'period_flow', 'unknown', 'unknown_tax', 'unknown', 'unknown',
      'unknown', 'pending', 'excluded')$$
);

insert into accounting.import_staging_lines (
  staging_line_id, import_batch_id, import_file_id, source_record_key_digest,
  source_line_no, row_digest, accounting_period, corporation_source_key_digest,
  account_source_key_digest, scenario_type, measure_type, source_amount,
  source_tax_basis, source_tax_category, source_tax_rate,
  tax_rate_source_version, rounding_mode, rounding_scope, rounding_unit,
  rounding_difference_amount, value_status
) values
  ('00000000-0000-4000-8000-000000000122',
   '00000000-0000-4000-8000-000000000120',
   '00000000-0000-4000-8000-000000000121', repeat('3',64), 1,
   repeat('4',64), '2026-07-01', repeat('5',64), repeat('6',64),
   'actual', 'period_flow', 110, 'inclusive', 'taxable_standard', 0.1,
   'tax-jp-v1', 'floor', 'line', 1, 0, 'pending'),
  ('00000000-0000-4000-8000-000000000123',
   '00000000-0000-4000-8000-000000000120',
   '00000000-0000-4000-8000-000000000121', repeat('7',64), 2,
   repeat('8',64), '2026-07-01', repeat('9',64), repeat('a',64),
   'actual', 'period_flow', null, 'unknown', 'unknown_tax', null,
   'unknown', 'unknown', 'unknown', null, null, 'pending');

select pg_temp.m012_expect_failure(
  'batch_received_to_validated',
  $$update accounting.import_batches set status='validated'
    where import_batch_id='00000000-0000-4000-8000-000000000120'$$
);

update accounting.import_files set validation_status = 'validating'
where import_file_id = '00000000-0000-4000-8000-000000000121';
update accounting.import_files set validation_status = 'validated'
where import_file_id = '00000000-0000-4000-8000-000000000121';

update accounting.import_staging_lines
set normalized_amount=100, tax_basis='exclusive', value_status='observed',
    normalization_status='passed', mapping_status='passed', validation_status='valid'
where staging_line_id='00000000-0000-4000-8000-000000000122';
update accounting.import_staging_lines set validation_status='excluded'
where staging_line_id='00000000-0000-4000-8000-000000000123';

update accounting.import_batches set status='validating'
where import_batch_id='00000000-0000-4000-8000-000000000120';
update accounting.import_batches set status='validated'
where import_batch_id='00000000-0000-4000-8000-000000000120';

select pg_temp.m012_expect_failure(
  'batch_validated_to_received',
  $$update accounting.import_batches set status='received'
    where import_batch_id='00000000-0000-4000-8000-000000000120'$$
);
select pg_temp.m012_expect_failure(
  'batch_validated_to_promoted',
  $$update accounting.import_batches set status='promoted'
    where import_batch_id='00000000-0000-4000-8000-000000000120'$$
);
select pg_temp.m012_expect_failure(
  'batch_validated_to_superseded',
  $$update accounting.import_batches set status='superseded'
    where import_batch_id='00000000-0000-4000-8000-000000000120'$$
);
select pg_temp.m012_expect_failure(
  'line_valid_to_received',
  $$update accounting.import_staging_lines set validation_status='received'
    where staging_line_id='00000000-0000-4000-8000-000000000122'$$
);
select pg_temp.m012_expect_failure(
  'line_excluded_to_valid',
  $$update accounting.import_staging_lines set validation_status='valid'
    where staging_line_id='00000000-0000-4000-8000-000000000123'$$
);

do $assertions$
declare
  passed_count integer;
begin
  select count(*) into passed_count from pg_temp.m012_lifecycle_test_results;
  if passed_count <> 17 then
    raise exception 'BDF_M012_LIFECYCLE_TEST_COUNT expected=17 actual=%', passed_count;
  end if;
  if not exists (
    select 1 from accounting.import_batches
    where import_batch_id='00000000-0000-4000-8000-000000000120'
      and status='validated'
  ) then
    raise exception 'BDF_M012_NORMAL_LIFECYCLE_DID_NOT_VALIDATE';
  end if;
end
$assertions$;

rollback;
