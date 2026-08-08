-- M063 single-session lifecycle regression. Entire fixture is rolled back.
begin;

create function pg_temp.expect_failure(p_label text, p_sql text, p_reason text)
returns void language plpgsql as $f$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_reason in sqlerrm)>0 then
      raise notice 'M063_EXPECTED %',p_label;
      return;
    end if;
    raise exception 'M063_WRONG_REJECTION % expected=% actual=%',p_label,p_reason,sqlerrm;
  end;
  raise exception 'M063_MISPASS %',p_label;
end
$f$;

insert into accounting.import_batches(
  import_batch_id,source_system,source_version,source_file,source_period,source_hash,
  schema_version,mapping_contract_version,tax_normalization_contract_version,created_by
) values (
  '63000000-0000-4000-8000-000000000001','m063-fixture','batch-v1','m063.csv',
  daterange('2026-04-01','2026-05-01','[)'),repeat('1',64),
  'schema-v1','mapping-v1','tax-v1','audit:m063'
);

insert into accounting.import_files(
  import_file_id,import_batch_id,file_name,file_type,file_hash,row_count
) values (
  '63000000-0000-4000-8000-000000000002','63000000-0000-4000-8000-000000000001',
  'm063.csv','text_csv',repeat('2',64),1
);

insert into accounting.import_staging_lines(
  staging_line_id,import_batch_id,import_file_id,source_record_key_digest,source_line_no,
  row_digest,accounting_period,corporation_source_key_digest,account_source_key_digest,
  scenario_type,measure_type,source_amount,source_tax_basis,source_tax_category,
  source_tax_rate,tax_rate_source_version,rounding_mode,rounding_scope,rounding_unit,
  rounding_difference_amount,normalized_amount,tax_basis,value_status
) values (
  '63000000-0000-4000-8000-000000000003','63000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000002',repeat('3',64),1,repeat('4',64),'2026-04-01',
  repeat('5',64),repeat('6',64),'actual','period_flow',110,'inclusive','standard',0.1,
  'rate-v1','half_up','line',1,0,null,null,'pending'
);

update accounting.import_files set validation_status='validating'
where import_file_id='63000000-0000-4000-8000-000000000002';
update accounting.import_files set validation_status='validated'
where import_file_id='63000000-0000-4000-8000-000000000002';
update accounting.import_staging_lines set normalized_amount=100,tax_basis='exclusive',
  value_status='observed',normalization_status='passed',mapping_status='passed',validation_status='valid'
where staging_line_id='63000000-0000-4000-8000-000000000003';
update accounting.import_batches set status='validating'
where import_batch_id='63000000-0000-4000-8000-000000000001';
update accounting.import_batches set status='validated'
where import_batch_id='63000000-0000-4000-8000-000000000001';
set constraints accounting.revalidate_import_batch_membership_m063 immediate;

select pg_temp.expect_failure('TERMINAL_FILE_INSERT',
  $$insert into accounting.import_files(import_file_id,import_batch_id,file_name,file_type,file_hash,row_count)
    values('63000000-0000-4000-8000-000000000004','63000000-0000-4000-8000-000000000001',
      'late.csv','text_csv',repeat('7',64),0)$$,
  'BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED');
select pg_temp.expect_failure('TERMINAL_LINE_DELETE',
  $$delete from accounting.import_staging_lines
    where staging_line_id='63000000-0000-4000-8000-000000000003'$$,
  'BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED');

rollback;
