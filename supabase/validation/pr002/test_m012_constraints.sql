-- PR002 / M012 constraint, immutability, and Batch Gate DB regression.
-- Synthetic data only; the transaction always rolls back.
begin;

create temporary table m012_constraint_results (
  test_name text primary key,
  result text not null check (result = 'passed')
) on commit drop;

create function pg_temp.m012_expect_constraint_failure(p_name text, p_sql text)
returns void language plpgsql security invoker set search_path = ''
as $function$
begin
  begin
    execute p_sql;
  exception when others then
    insert into pg_temp.m012_constraint_results values (p_name, 'passed');
    return;
  end;
  raise exception 'BDF_M012_EXPECTED_FAILURE_DID_NOT_OCCUR test=%', p_name;
end
$function$;

insert into accounting.import_batches (
  import_batch_id, source_system, source_version, source_file, source_period,
  source_hash, schema_version, mapping_contract_version,
  tax_normalization_contract_version, created_by
) values (
  '10000000-0000-4000-8000-000000000001', 'synthetic', 'constraint-base',
  'base.csv', daterange('2026-07-01','2026-08-01','[)'), repeat('a',64),
  'schema-v1', 'mapping-v1', 'tax-v1', 'audit:m012-test'
);
insert into accounting.import_files (
  import_file_id, import_batch_id, file_name, file_type, file_hash, row_count
) values (
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001', 'base.csv', 'csv', repeat('b',64), 1
);
insert into accounting.import_staging_lines (
  staging_line_id, import_batch_id, import_file_id, source_record_key_digest,
  source_line_no, row_digest, accounting_period, corporation_source_key_digest,
  account_source_key_digest, scenario_type, measure_type, source_amount,
  source_tax_basis, source_tax_category, source_tax_rate, tax_rate_source_version,
  rounding_mode, rounding_scope, rounding_unit, rounding_difference_amount,
  value_status
) values (
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', repeat('c',64), 1, repeat('d',64),
  '2026-07-01', repeat('e',64), repeat('f',64), 'actual', 'period_flow', 110,
  'inclusive', 'taxable_standard', 0.1, 'tax-jp-v1', 'floor', 'line', 1, 0,
  'pending'
);

select pg_temp.m012_expect_constraint_failure('duplicate_batch_source_version',
  $$insert into accounting.import_batches
    (source_system,source_version,source_file,source_period,source_hash,schema_version,
     mapping_contract_version,tax_normalization_contract_version,created_by)
    values ('synthetic','constraint-base','duplicate.csv',daterange('2026-07-01','2026-08-01','[)'),
      repeat('1',64),'schema-v1','mapping-v1','tax-v1','audit:m012-test')$$);
select pg_temp.m012_expect_constraint_failure('duplicate_file_hash',
  $$insert into accounting.import_files
    (import_batch_id,file_name,file_type,file_hash,row_count)
    values ('10000000-0000-4000-8000-000000000001','duplicate.csv','csv',repeat('b',64),1)$$);
select pg_temp.m012_expect_constraint_failure('duplicate_stable_line',
  $$insert into accounting.import_staging_lines
    (import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
     accounting_period,corporation_source_key_digest,account_source_key_digest,
     scenario_type,measure_type,source_tax_basis,source_tax_category,
     tax_rate_source_version,rounding_mode,rounding_scope,value_status)
    values ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
      repeat('c',64),1,repeat('1',64),'2026-07-01',repeat('2',64),repeat('3',64),
      'actual','period_flow','unknown','unknown_tax','unknown','unknown','unknown','pending')$$);
select pg_temp.m012_expect_constraint_failure('orphan_file',
  $$insert into accounting.import_files
    (import_batch_id,file_name,file_type,file_hash,row_count)
    values ('ffffffff-ffff-4fff-8fff-ffffffffffff','orphan.csv','csv',repeat('2',64),0)$$);
select pg_temp.m012_expect_constraint_failure('orphan_staging_line',
  $$insert into accounting.import_staging_lines
    (import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
     accounting_period,corporation_source_key_digest,account_source_key_digest,
     scenario_type,measure_type,source_tax_basis,source_tax_category,
     tax_rate_source_version,rounding_mode,rounding_scope,value_status)
    values ('10000000-0000-4000-8000-000000000001','ffffffff-ffff-4fff-8fff-ffffffffffff',
      repeat('3',64),2,repeat('4',64),'2026-07-01',repeat('5',64),repeat('6',64),
      'actual','period_flow','unknown','unknown_tax','unknown','unknown','unknown','pending')$$);

select pg_temp.m012_expect_constraint_failure('invalid_tax_basis',
  $$insert into accounting.import_staging_lines
    (import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
     accounting_period,corporation_source_key_digest,account_source_key_digest,
     scenario_type,measure_type,source_tax_basis,source_tax_category,
     tax_rate_source_version,rounding_mode,rounding_scope,value_status)
    values ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
      repeat('7',64),3,repeat('8',64),'2026-07-01',repeat('9',64),repeat('0',64),
      'actual','period_flow','gross','unknown_tax','unknown','unknown','unknown','pending')$$);
select pg_temp.m012_expect_constraint_failure('invalid_tax_category',
  $$insert into accounting.import_staging_lines
    (import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
     accounting_period,corporation_source_key_digest,account_source_key_digest,
     scenario_type,measure_type,source_tax_basis,source_tax_category,
     tax_rate_source_version,rounding_mode,rounding_scope,value_status)
    values ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
      repeat('1',64),4,repeat('2',64),'2026-07-01',repeat('3',64),repeat('4',64),
      'actual','period_flow','unknown','INVALID TAX','unknown','unknown','unknown','pending')$$);
select pg_temp.m012_expect_constraint_failure('invalid_rounding_mode',
  $$insert into accounting.import_staging_lines
    (import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
     accounting_period,corporation_source_key_digest,account_source_key_digest,
     scenario_type,measure_type,source_tax_basis,source_tax_category,
     tax_rate_source_version,rounding_mode,rounding_scope,value_status)
    values ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
      repeat('5',64),5,repeat('6',64),'2026-07-01',repeat('7',64),repeat('8',64),
      'actual','period_flow','unknown','unknown_tax','unknown','bankers_magic','unknown','pending')$$);
select pg_temp.m012_expect_constraint_failure('invalid_rounding_scope',
  $$insert into accounting.import_staging_lines
    (import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
     accounting_period,corporation_source_key_digest,account_source_key_digest,
     scenario_type,measure_type,source_tax_basis,source_tax_category,
     tax_rate_source_version,rounding_mode,rounding_scope,value_status)
    values ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
      repeat('9',64),6,repeat('0',64),'2026-07-01',repeat('1',64),repeat('2',64),
      'actual','period_flow','unknown','unknown_tax','unknown','unknown','quarter','pending')$$);
select pg_temp.m012_expect_constraint_failure('negative_record_count',
  $$insert into accounting.import_files
    (import_batch_id,file_name,file_type,file_hash,row_count)
    values ('10000000-0000-4000-8000-000000000001','negative.csv','csv',repeat('3',64),-1)$$);

select pg_temp.m012_expect_constraint_failure('immutable_source_system',
  $$update accounting.import_batches set source_system='changed'
    where import_batch_id='10000000-0000-4000-8000-000000000001'$$);
select pg_temp.m012_expect_constraint_failure('immutable_source_version',
  $$update accounting.import_batches set source_version='changed'
    where import_batch_id='10000000-0000-4000-8000-000000000001'$$);
select pg_temp.m012_expect_constraint_failure('immutable_source_hash',
  $$update accounting.import_batches set source_hash=repeat('4',64)
    where import_batch_id='10000000-0000-4000-8000-000000000001'$$);
select pg_temp.m012_expect_constraint_failure('immutable_file_hash',
  $$update accounting.import_files set file_hash=repeat('5',64)
    where import_file_id='10000000-0000-4000-8000-000000000002'$$);
select pg_temp.m012_expect_constraint_failure('immutable_record_key',
  $$update accounting.import_staging_lines set source_record_key_digest=repeat('6',64)
    where staging_line_id='10000000-0000-4000-8000-000000000003'$$);
select pg_temp.m012_expect_constraint_failure('immutable_line_number',
  $$update accounting.import_staging_lines set source_line_no=9
    where staging_line_id='10000000-0000-4000-8000-000000000003'$$);
select pg_temp.m012_expect_constraint_failure('batch_delete',
  $$delete from accounting.import_batches
    where import_batch_id='10000000-0000-4000-8000-000000000001'$$);
select pg_temp.m012_expect_constraint_failure('file_delete',
  $$delete from accounting.import_files
    where import_file_id='10000000-0000-4000-8000-000000000002'$$);
select pg_temp.m012_expect_constraint_failure('line_delete',
  $$delete from accounting.import_staging_lines
    where staging_line_id='10000000-0000-4000-8000-000000000003'$$);

-- Empty Batch / zero File.
insert into accounting.import_batches
  (import_batch_id,source_system,source_version,source_file,source_period,source_hash,
   schema_version,mapping_contract_version,tax_normalization_contract_version,created_by)
values ('20000000-0000-4000-8000-000000000001','synthetic','gate-empty','empty.csv',
  daterange('2026-07-01','2026-08-01','[)'),repeat('1',64),'schema-v1','mapping-v1','tax-v1','audit:m012-test');
update accounting.import_batches set status='validating' where import_batch_id='20000000-0000-4000-8000-000000000001';
select pg_temp.m012_expect_constraint_failure('empty_batch_validation',
  $$update accounting.import_batches set status='validated'
    where import_batch_id='20000000-0000-4000-8000-000000000001'$$);

-- Validated File but no line.
insert into accounting.import_batches
  (import_batch_id,source_system,source_version,source_file,source_period,source_hash,
   schema_version,mapping_contract_version,tax_normalization_contract_version,created_by)
values ('20000000-0000-4000-8000-000000000002','synthetic','gate-no-line','noline.csv',
  daterange('2026-07-01','2026-08-01','[)'),repeat('2',64),'schema-v1','mapping-v1','tax-v1','audit:m012-test');
insert into accounting.import_files (import_batch_id,file_name,file_type,file_hash,row_count)
values ('20000000-0000-4000-8000-000000000002','noline.csv','csv',repeat('6',64),0);
update accounting.import_files set validation_status='validating' where import_batch_id='20000000-0000-4000-8000-000000000002';
update accounting.import_files set validation_status='validated' where import_batch_id='20000000-0000-4000-8000-000000000002';
update accounting.import_batches set status='validating' where import_batch_id='20000000-0000-4000-8000-000000000002';
select pg_temp.m012_expect_constraint_failure('staging_zero_validation',
  $$update accounting.import_batches set status='validated'
    where import_batch_id='20000000-0000-4000-8000-000000000002'$$);

do $assertions$
declare passed_count integer;
begin
  select count(*) into passed_count from pg_temp.m012_constraint_results;
  if passed_count <> 21 then
    raise exception 'BDF_M012_CONSTRAINT_TEST_COUNT expected=21 actual=%', passed_count;
  end if;
end
$assertions$;

rollback;
