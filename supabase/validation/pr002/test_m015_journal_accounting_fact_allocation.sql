-- Synthetic-only M015 contract test. Entire fixture is rolled back.
begin;

create function pg_temp.expect_failure(p_label text, p_sql text, p_reason text)
returns void language plpgsql as $f$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_reason in sqlerrm) > 0 then
      raise notice 'M015_EXPECTED %', p_label;
      return;
    end if;
    raise exception 'M015_WRONG_REJECTION % expected=% actual=%', p_label, p_reason, sqlerrm;
  end;
  raise exception 'M015_MISPASS %', p_label;
end
$f$;

-- Canonical Master snapshot and exact effective-dated version pins.
insert into governance.master_source_snapshots(
  source_snapshot_id,source_system,source_environment,source_version,snapshot_version,
  source_as_of,content_digest,mapping_contract_version,masking_policy_version,
  total_record_count,approval_reference,created_by
) values (
  '15000000-0000-4000-8000-000000000001','m015-fixture','test','m015-source-v1','m015-snapshot-v1',
  '2026-04-01T00:00:00Z',repeat('1',64),'mapping-v1','masking-v1',4,'APR:M015','audit:m015'
);

insert into governance.canonical_entity_registry(canonical_entity_id,entity_type) values
  ('15000000-0000-4000-8000-000000000100','corporation'),
  ('15000000-0000-4000-8000-000000000200','store'),
  ('15000000-0000-4000-8000-000000000202','corporation_store_relationship'),
  ('15000000-0000-4000-8000-000000000210','store'),
  ('15000000-0000-4000-8000-000000000212','corporation_store_relationship'),
  ('15000000-0000-4000-8000-000000000300','department'),
  ('15000000-0000-4000-8000-000000000310','department');
insert into core.corporation_identities(corporation_id) values
  ('15000000-0000-4000-8000-000000000100');
insert into core.store_identities(store_id) values
  ('15000000-0000-4000-8000-000000000200'),
  ('15000000-0000-4000-8000-000000000210');
insert into core.corporation_store_relationship_identities(relationship_id) values
  ('15000000-0000-4000-8000-000000000202'),
  ('15000000-0000-4000-8000-000000000212');
insert into core.department_identities(department_id) values
  ('15000000-0000-4000-8000-000000000300'),
  ('15000000-0000-4000-8000-000000000310');
insert into governance.canonical_version_registry(
  entity_version_id,canonical_entity_id,entity_type,source_snapshot_id
) values
  ('15000000-0000-4000-8000-000000000101','15000000-0000-4000-8000-000000000100','corporation','15000000-0000-4000-8000-000000000001'),
  ('15000000-0000-4000-8000-000000000201','15000000-0000-4000-8000-000000000200','store','15000000-0000-4000-8000-000000000001'),
  ('15000000-0000-4000-8000-000000000203','15000000-0000-4000-8000-000000000202','corporation_store_relationship','15000000-0000-4000-8000-000000000001'),
  ('15000000-0000-4000-8000-000000000211','15000000-0000-4000-8000-000000000210','store','15000000-0000-4000-8000-000000000001'),
  ('15000000-0000-4000-8000-000000000213','15000000-0000-4000-8000-000000000212','corporation_store_relationship','15000000-0000-4000-8000-000000000001'),
  ('15000000-0000-4000-8000-000000000301','15000000-0000-4000-8000-000000000300','department','15000000-0000-4000-8000-000000000001'),
  ('15000000-0000-4000-8000-000000000311','15000000-0000-4000-8000-000000000310','department','15000000-0000-4000-8000-000000000001');
insert into core.corporations(
  corporation_version_id,corporation_id,corporation_code,display_name,status,
  effective_from,effective_to,source_snapshot_id,source_record_digest
) values (
  '15000000-0000-4000-8000-000000000101','15000000-0000-4000-8000-000000000100',
  'M015-CORP','M015 Corporation','active','2026-01-01','2027-01-01',
  '15000000-0000-4000-8000-000000000001',repeat('2',64)
);
insert into core.stores(
  store_version_id,store_id,store_code,display_name,status,effective_from,effective_to,
  source_snapshot_id,source_record_digest
) values (
  '15000000-0000-4000-8000-000000000201','15000000-0000-4000-8000-000000000200',
  'M015-STORE','M015 Store','active','2026-01-01','2027-01-01',
  '15000000-0000-4000-8000-000000000001',repeat('3',64)
);
insert into core.stores(
  store_version_id,store_id,store_code,display_name,status,effective_from,effective_to,
  source_snapshot_id,source_record_digest
) values (
  '15000000-0000-4000-8000-000000000211','15000000-0000-4000-8000-000000000210',
  'M015-EXPIRED','M015 Mid-period Store','active','2026-01-01','2026-04-15',
  '15000000-0000-4000-8000-000000000001',repeat('8',64)
);
insert into core.corporation_store_relationships(
  relationship_version_id,relationship_id,store_id,corporation_id,relationship_type,
  operating_model,effective_from,effective_to,source_snapshot_id,source_record_digest
) values (
  '15000000-0000-4000-8000-000000000203','15000000-0000-4000-8000-000000000202',
  '15000000-0000-4000-8000-000000000200','15000000-0000-4000-8000-000000000100',
  'accounting','direct','2026-01-01','2027-01-01',
  '15000000-0000-4000-8000-000000000001',repeat('4',64)
);
insert into core.corporation_store_relationships(
  relationship_version_id,relationship_id,store_id,corporation_id,relationship_type,
  operating_model,effective_from,effective_to,source_snapshot_id,source_record_digest
) values (
  '15000000-0000-4000-8000-000000000213','15000000-0000-4000-8000-000000000212',
  '15000000-0000-4000-8000-000000000210','15000000-0000-4000-8000-000000000100',
  'accounting','direct','2026-01-01','2026-04-15',
  '15000000-0000-4000-8000-000000000001',repeat('9',64)
);
insert into core.departments(
  department_version_id,department_id,department_code,display_name,corporation_id,status,
  effective_from,effective_to,source_snapshot_id,source_record_digest
) values (
  '15000000-0000-4000-8000-000000000301','15000000-0000-4000-8000-000000000300',
  'M015-DEPT','M015 Department','15000000-0000-4000-8000-000000000100','active',
  '2026-01-01','2027-01-01','15000000-0000-4000-8000-000000000001',repeat('5',64)
);
insert into core.departments(
  department_version_id,department_id,department_code,display_name,corporation_id,status,
  effective_from,effective_to,source_snapshot_id,source_record_digest
) values (
  '15000000-0000-4000-8000-000000000311','15000000-0000-4000-8000-000000000310',
  'M015-INACTIVE','M015 Inactive Department','15000000-0000-4000-8000-000000000100','inactive',
  '2026-01-01','2027-01-01','15000000-0000-4000-8000-000000000001',repeat('0',64)
);

-- P/L posting Account plus a B/S Account for mismatch tests.
insert into accounting.account_identities(account_id,created_by) values
  ('15000000-0000-4000-8000-000000000400','audit:m015'),
  ('15000000-0000-4000-8000-000000000402','audit:m015'),
  ('15000000-0000-4000-8000-000000000404','audit:m015'),
  ('15000000-0000-4000-8000-000000000406','audit:m015');
insert into accounting.accounts(
  account_version_id,account_id,version_no,account_code,account_name,account_type,
  statement_type,account_category,normal_balance,sign_policy,measure_type,display_order,
  effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by
) values
  ('15000000-0000-4000-8000-000000000401','15000000-0000-4000-8000-000000000400',1,
   'M015-PL','M015 Expense','posting','pl','operating_expense','debit','debit_positive',
   'period_flow',10,'2026-01-01','2027-01-01','active','account-v1','mapping-v1',repeat('6',64),'audit:m015'),
  ('15000000-0000-4000-8000-000000000403','15000000-0000-4000-8000-000000000402',1,
   'M015-BS','M015 Asset','posting','bs','current_asset','debit','debit_positive',
   'ending_balance',20,'2026-01-01','2027-01-01','active','account-v1','mapping-v1',repeat('7',64),'audit:m015'),
  ('15000000-0000-4000-8000-000000000405','15000000-0000-4000-8000-000000000404',1,
   'M015-GROSS','M015 Gross Profit','posting','pl','gross_profit','credit','credit_positive',
   'period_flow',30,'2026-01-01','2027-01-01','active','account-v1','mapping-v1',repeat('8',64),'audit:m015'),
  ('15000000-0000-4000-8000-000000000407','15000000-0000-4000-8000-000000000406',1,
   'M015-PARTIAL','M015 Partial Expense','posting','pl','operating_expense','debit','debit_positive',
   'period_flow',40,'2026-01-01','2026-04-15','active','account-v1','mapping-v1',repeat('9',64),'audit:m015');

-- One fully validated Actual source line through M012.
insert into accounting.import_batches(
  import_batch_id,source_system,source_version,source_file,source_period,source_hash,
  schema_version,mapping_contract_version,tax_normalization_contract_version,created_by
) values (
  '15000000-0000-4000-8000-000000000500','m015_source','actual-v1','m015.csv',
  '[2026-04-01,2026-05-01)'::daterange,repeat('8',64),'schema-v1','mapping-v1','tax-v1','audit:m015'
);
insert into accounting.import_files(
  import_file_id,import_batch_id,file_name,file_type,file_hash,row_count
) values (
  '15000000-0000-4000-8000-000000000501','15000000-0000-4000-8000-000000000500',
  'm015.csv','csv',repeat('9',64),12
);
insert into accounting.import_staging_lines(
  staging_line_id,import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
  accounting_period,corporation_source_key_digest,account_source_key_digest,scenario_type,measure_type,
  source_amount,source_tax_basis,source_tax_category,source_tax_rate,tax_rate_source_version,
  rounding_mode,rounding_scope,rounding_unit,rounding_difference_amount,normalized_amount,tax_basis,
  value_status,normalization_status,mapping_status,validation_status
) values (
  '15000000-0000-4000-8000-000000000502','15000000-0000-4000-8000-000000000500',
  '15000000-0000-4000-8000-000000000501',repeat('a',64),1,repeat('b',64),'2026-04-01',
  repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','standard',0.1,'tax-v1',
  'half_up','line',1,0,null,null,'pending','pending','pending','received'
);
-- M012 quarantine can retain these incomplete/non-finite evidence rows. M015 must not promote them.
insert into accounting.import_staging_lines(
  staging_line_id,import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
  accounting_period,corporation_source_key_digest,account_source_key_digest,scenario_type,measure_type,
  source_amount,source_tax_basis,source_tax_category,source_tax_rate,tax_rate_source_version,
  rounding_mode,rounding_scope,rounding_unit,rounding_difference_amount,normalized_amount,tax_basis,
  value_status,normalization_status,mapping_status,validation_status
) values
  ('15000000-0000-4000-8000-000000000520','15000000-0000-4000-8000-000000000500',
   '15000000-0000-4000-8000-000000000501',repeat('0',64),20,repeat('1',64),'2026-04-01',
   repeat('c',64),repeat('d',64),'actual','period_flow','NaN'::numeric,'inclusive','standard',0.1,'tax-v1',
   'half_up','line',1,0,null,null,'pending','pending','pending','received'),
  ('15000000-0000-4000-8000-000000000521','15000000-0000-4000-8000-000000000500',
   '15000000-0000-4000-8000-000000000501',repeat('2',64),21,repeat('3',64),'2026-04-01',
   repeat('c',64),repeat('d',64),'actual','period_flow',null,'inclusive','standard',0.1,'tax-v1',
   'half_up','line',1,0,null,null,'pending','pending','pending','received'),
  ('15000000-0000-4000-8000-000000000522','15000000-0000-4000-8000-000000000500',
   '15000000-0000-4000-8000-000000000501',repeat('4',64),22,repeat('5',64),'2026-04-01',
   repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','standard',0.1,'tax-v1',
   'half_up','line',null,0,null,null,'pending','pending','pending','received'),
  ('15000000-0000-4000-8000-000000000523','15000000-0000-4000-8000-000000000500',
   '15000000-0000-4000-8000-000000000501',repeat('6',64),23,repeat('7',64),'2026-04-01',
   repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','standard',0.1,'tax-v1',
   'half_up','line','NaN'::numeric,0,null,null,'pending','pending','pending','received'),
  ('15000000-0000-4000-8000-000000000524','15000000-0000-4000-8000-000000000500',
   '15000000-0000-4000-8000-000000000501',repeat('8',64),24,repeat('9',64),'2026-04-01',
   repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','standard',0.1,'tax-v1',
   'half_up','line',1,'NaN'::numeric,null,null,'pending','pending','pending','received'),
  ('15000000-0000-4000-8000-000000000525','15000000-0000-4000-8000-000000000500',
   '15000000-0000-4000-8000-000000000501',repeat('a',64),25,repeat('b',64),'2026-04-01',
   repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','standard',0.1,'tax-v1',
   'half_up','line',1,null,null,null,'pending','pending','pending','received'),
  ('15000000-0000-4000-8000-000000000526','15000000-0000-4000-8000-000000000500',
   '15000000-0000-4000-8000-000000000501',repeat('c',64),26,repeat('d',64),'2026-04-01',
   repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','standard',0.1,'tax-v1',
   'half_up','not_applicable',1,0,null,null,'pending','pending','pending','received'),
  ('15000000-0000-4000-8000-000000000527','15000000-0000-4000-8000-000000000500',
   '15000000-0000-4000-8000-000000000501',repeat('e',64),27,repeat('f',64),'2026-04-01',
   repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','unknown',0.1,'tax-v1',
   'half_up','line',1,0,null,null,'pending','pending','pending','received'),
  ('15000000-0000-4000-8000-000000000528','15000000-0000-4000-8000-000000000500',
   '15000000-0000-4000-8000-000000000501',repeat('0',64),28,repeat('1',64),'2026-04-01',
   repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','standard',0.1,'UNKNOWN',
   'half_up','line',1,0,null,null,'pending','pending','pending','received');

-- Bounded numeric rejects Infinity before M015; the M015 guard still carries explicit defense-in-depth.
select pg_temp.expect_failure('ACTUAL_SOURCE_AMOUNT_INFINITY_TYPE_REJECTION', $q$
  insert into accounting.import_staging_lines(
    staging_line_id,import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
    accounting_period,corporation_source_key_digest,account_source_key_digest,scenario_type,measure_type,
    source_amount,source_tax_basis,source_tax_category,source_tax_rate,tax_rate_source_version,
    rounding_mode,rounding_scope,rounding_unit,rounding_difference_amount,value_status
  ) values ('15000000-0000-4000-8000-000000000529','15000000-0000-4000-8000-000000000500',
    '15000000-0000-4000-8000-000000000501',repeat('2',64),29,repeat('3',64),'2026-04-01',
    repeat('c',64),repeat('d',64),'actual','period_flow','Infinity'::numeric,'inclusive','standard',0.1,'tax-v1',
    'half_up','line',1,0,'pending')
$q$, 'numeric field overflow');
select pg_temp.expect_failure('ACTUAL_ROUNDING_UNIT_INFINITY_TYPE_REJECTION', $q$
  insert into accounting.import_staging_lines(
    staging_line_id,import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
    accounting_period,corporation_source_key_digest,account_source_key_digest,scenario_type,measure_type,
    source_amount,source_tax_basis,source_tax_category,source_tax_rate,tax_rate_source_version,
    rounding_mode,rounding_scope,rounding_unit,rounding_difference_amount,value_status
  ) values ('15000000-0000-4000-8000-000000000530','15000000-0000-4000-8000-000000000500',
    '15000000-0000-4000-8000-000000000501',repeat('4',64),30,repeat('5',64),'2026-04-01',
    repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','standard',0.1,'tax-v1',
    'half_up','line','Infinity'::numeric,0,'pending')
$q$, 'numeric field overflow');
select pg_temp.expect_failure('ACTUAL_ROUNDING_DIFFERENCE_INFINITY_TYPE_REJECTION', $q$
  insert into accounting.import_staging_lines(
    staging_line_id,import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
    accounting_period,corporation_source_key_digest,account_source_key_digest,scenario_type,measure_type,
    source_amount,source_tax_basis,source_tax_category,source_tax_rate,tax_rate_source_version,
    rounding_mode,rounding_scope,rounding_unit,rounding_difference_amount,value_status
  ) values ('15000000-0000-4000-8000-000000000531','15000000-0000-4000-8000-000000000500',
    '15000000-0000-4000-8000-000000000501',repeat('6',64),31,repeat('7',64),'2026-04-01',
    repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','standard',0.1,'tax-v1',
    'half_up','line',1,'Infinity'::numeric,'pending')
$q$, 'numeric field overflow');
-- A second candidate remains excluded and cannot cross the M015 Actual boundary.
insert into accounting.import_staging_lines(
  staging_line_id,import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
  accounting_period,corporation_source_key_digest,account_source_key_digest,scenario_type,measure_type,
  source_amount,source_tax_basis,source_tax_category,source_tax_rate,tax_rate_source_version,
  rounding_mode,rounding_scope,rounding_unit,rounding_difference_amount,normalized_amount,tax_basis,
  value_status,normalization_status,mapping_status,validation_status
) values (
  '15000000-0000-4000-8000-000000000503','15000000-0000-4000-8000-000000000500',
  '15000000-0000-4000-8000-000000000501',repeat('e',64),2,repeat('f',64),'2026-04-01',
  repeat('c',64),repeat('d',64),'actual','period_flow',55,'unknown','unknown',null,'unknown',
  'unknown','unknown',null,null,null,null,'pending','pending','pending','received'
);
-- M012 permits numeric NaN; M015 must reject it at the Canonical promotion boundary.
insert into accounting.import_staging_lines(
  staging_line_id,import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
  accounting_period,corporation_source_key_digest,account_source_key_digest,scenario_type,measure_type,
  source_amount,source_tax_basis,source_tax_category,source_tax_rate,tax_rate_source_version,
  rounding_mode,rounding_scope,rounding_unit,rounding_difference_amount,normalized_amount,tax_basis,
  value_status,normalization_status,mapping_status,validation_status
) values (
  '15000000-0000-4000-8000-000000000505','15000000-0000-4000-8000-000000000500',
  '15000000-0000-4000-8000-000000000501',repeat('6',64),3,repeat('7',64),'2026-04-01',
  repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','standard',0.1,'tax-v1',
  'half_up','line',1,0,null,null,'pending','pending','pending','received'
);
update accounting.import_files set validation_status='validating'
where import_file_id='15000000-0000-4000-8000-000000000501';
update accounting.import_files set validation_status='validated'
where import_file_id='15000000-0000-4000-8000-000000000501';
update accounting.import_staging_lines set
  normalized_amount=100,tax_basis='exclusive',value_status='observed',
  normalization_status='passed',mapping_status='passed',validation_status='valid'
where staging_line_id='15000000-0000-4000-8000-000000000502';
update accounting.import_staging_lines set validation_status='excluded'
where staging_line_id='15000000-0000-4000-8000-000000000503';
update accounting.import_staging_lines set
  normalized_amount='NaN'::numeric,tax_basis='exclusive',value_status='observed',
  normalization_status='passed',mapping_status='passed',validation_status='valid'
where staging_line_id='15000000-0000-4000-8000-000000000505';
update accounting.import_staging_lines set
  normalized_amount=100,tax_basis='exclusive',value_status='observed',
  normalization_status='passed',mapping_status='passed',validation_status='valid'
where staging_line_id in (
  '15000000-0000-4000-8000-000000000520','15000000-0000-4000-8000-000000000521',
  '15000000-0000-4000-8000-000000000522','15000000-0000-4000-8000-000000000523',
  '15000000-0000-4000-8000-000000000524','15000000-0000-4000-8000-000000000525',
  '15000000-0000-4000-8000-000000000526','15000000-0000-4000-8000-000000000527',
  '15000000-0000-4000-8000-000000000528'
);
update accounting.import_batches set status='validating'
where import_batch_id='15000000-0000-4000-8000-000000000500';
update accounting.import_batches set status='validated'
where import_batch_id='15000000-0000-4000-8000-000000000500';

-- A second Batch remains in the only legal initial state. Actual must not consume it.
insert into accounting.import_batches(
  import_batch_id,source_system,source_version,source_file,source_period,source_hash,
  schema_version,mapping_contract_version,tax_normalization_contract_version,created_by
) values (
  '15000000-0000-4000-8000-000000000504','m015_source','actual-pending-v1','pending.csv',
  '[2026-04-01,2026-05-01)'::daterange,repeat('0',64),'schema-v1','mapping-v1','tax-v1','audit:m015'
);

select pg_temp.expect_failure('LATE_FILE_AFTER_BATCH_VALIDATION', $q$
  insert into accounting.import_files(
    import_file_id,import_batch_id,file_name,file_type,file_hash,row_count
  ) values (
    '15000000-0000-4000-8000-000000000509','15000000-0000-4000-8000-000000000500',
    'late.csv','csv',repeat('1',64),0)
$q$, 'BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED');

select pg_temp.expect_failure('LATE_LINE_AFTER_BATCH_VALIDATION', $q$
  insert into accounting.import_staging_lines(
    staging_line_id,import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,
    accounting_period,corporation_source_key_digest,account_source_key_digest,scenario_type,measure_type,
    source_amount,source_tax_basis,source_tax_category,tax_rate_source_version,rounding_mode,rounding_scope,
    value_status,normalization_status,mapping_status,validation_status
  ) values (
    '15000000-0000-4000-8000-000000000508','15000000-0000-4000-8000-000000000500',
    '15000000-0000-4000-8000-000000000501',repeat('2',64),8,repeat('3',64),'2026-04-01',
    repeat('4',64),repeat('5',64),'actual','period_flow',null,'unknown','unknown','unknown','unknown','unknown',
    'pending','pending','pending','received')
$q$, 'BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED');

select pg_temp.expect_failure('MUTATE_LINE_AFTER_BATCH_VALIDATION', $q$
  update accounting.import_staging_lines set source_line_no=3
  where staging_line_id='15000000-0000-4000-8000-000000000503'
$q$, 'BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED');

select pg_temp.expect_failure('MOVE_LINE_FROM_VALIDATED_BATCH', $q$
  update accounting.import_staging_lines
  set import_batch_id='15000000-0000-4000-8000-000000000504'
  where staging_line_id='15000000-0000-4000-8000-000000000503'
$q$, 'BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED');

select pg_temp.expect_failure('ACTUAL_VERSION_BATCH_NOT_VALIDATED', $q$
  insert into accounting.accounting_versions(
    accounting_version_id,corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,
    version_sequence,version_label,source_batch_id,content_hash,created_by
  ) values (
    '15000000-0000-4000-8000-000000000604','15000000-0000-4000-8000-000000000100',
    'actual','preliminary',2027,'2026-04-01','2026-05-01',4,'Actual pending source',
    '15000000-0000-4000-8000-000000000504',repeat('4',64),'audit:m015')
$q$, 'BDF_ACCOUNTING_VERSION_SOURCE_BATCH_NOT_ELIGIBLE');

-- Actual Version plus Budget source/derived Version pair.
insert into accounting.accounting_versions(
  accounting_version_id,corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,
  version_sequence,version_label,source_batch_id,content_hash,created_by
) values (
  '15000000-0000-4000-8000-000000000600','15000000-0000-4000-8000-000000000100',
  'actual','preliminary',2027,'2026-04-01','2026-05-01',1,'Actual v1',
  '15000000-0000-4000-8000-000000000500',repeat('1',64),'audit:m015'
);
insert into accounting.accounting_versions(
  accounting_version_id,corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,
  version_sequence,version_label,content_hash,created_by
) values (
  '15000000-0000-4000-8000-000000000610','15000000-0000-4000-8000-000000000100',
  'budget','baseline',2027,'2026-04-01','2026-05-01',1,'Budget v1',repeat('2',64),'audit:m015'
);
insert into accounting.accounting_versions(
  accounting_version_id,corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,
  version_sequence,version_label,parent_version_id,content_hash,created_by
) values (
  '15000000-0000-4000-8000-000000000611','15000000-0000-4000-8000-000000000100',
  'budget','revision',2027,'2026-04-01','2026-05-01',2,'Budget allocated',
  '15000000-0000-4000-8000-000000000610',repeat('3',64),'audit:m015'
);
insert into accounting.accounting_versions(
  accounting_version_id,corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,
  version_sequence,version_label,content_hash,created_by
) values (
  '15000000-0000-4000-8000-000000000620','15000000-0000-4000-8000-000000000100',
  'forecast','rolling_forecast',2027,'2026-04-01','2026-05-01',1,'Forecast v1',repeat('4',64),'audit:m015'
);

select pg_temp.expect_failure('ORPHAN_VERSION', $q$
  insert into accounting.journal_entries(accounting_version_id,source_kind,source_system,
    source_reference_digest,source_entry_key_digest,entry_date,posting_period,evidence_digest,entry_type,recorded_by)
  values('15999999-0000-4000-8000-000000000999','planning','m015_plan',repeat('1',64),repeat('2',64),
    '2026-04-10','2026-04-01',repeat('3',64),'planning','audit:m015')
$q$, 'BDF_JOURNAL_REQUIRES_DRAFT_VERSION');

select pg_temp.expect_failure('PERIOD_MISMATCH', $q$
  insert into accounting.journal_entries(accounting_version_id,source_kind,source_system,
    source_reference_digest,source_entry_key_digest,entry_date,posting_period,evidence_digest,entry_type,recorded_by)
  values('15000000-0000-4000-8000-000000000610','planning','m015_plan',repeat('a',64),repeat('b',64),
    '2026-05-10','2026-05-01',repeat('c',64),'planning','audit:m015')
$q$, 'BDF_JOURNAL_PERIOD_MISMATCH');

select pg_temp.expect_failure('ACTUAL_BATCH_NOT_VALIDATED', $q$
  insert into accounting.journal_entries(accounting_version_id,source_kind,source_system,source_batch_id,
    source_reference_digest,source_entry_key_digest,entry_date,posting_period,evidence_digest,entry_type,recorded_by)
  values('15000000-0000-4000-8000-000000000600','import','m015_source',
    '15000000-0000-4000-8000-000000000504',repeat('d',64),repeat('e',64),
    '2026-04-10','2026-04-01',repeat('f',64),'source','audit:m015')
$q$, 'BDF_JOURNAL_IMPORT_SOURCE_NOT_ELIGIBLE');

select pg_temp.expect_failure('ACTUAL_SOURCE_BYPASS', $q$
  insert into accounting.journal_entries(accounting_version_id,source_kind,source_system,
    source_reference_digest,source_entry_key_digest,entry_date,posting_period,evidence_digest,entry_type,recorded_by)
  values('15000000-0000-4000-8000-000000000600','planning','m015_plan',repeat('1',64),repeat('2',64),
    '2026-04-10','2026-04-01',repeat('3',64),'source','audit:m015')
$q$, 'BDF_JOURNAL_ACTUAL_IMPORT_REQUIRED');

insert into accounting.journal_entries(
  journal_entry_id,accounting_version_id,source_kind,source_system,source_batch_id,
  source_reference_digest,source_entry_key_digest,entry_date,posting_period,description_code,
  evidence_digest,entry_type,recorded_by
) values (
  '15000000-0000-4000-8000-000000000700','15000000-0000-4000-8000-000000000600',
  'import','m015_source','15000000-0000-4000-8000-000000000500',repeat('4',64),repeat('5',64),
  '2026-04-10','2026-04-01','source.entry',repeat('6',64),'source','audit:m015'
);
insert into accounting.journal_entries(
  journal_entry_id,accounting_version_id,source_kind,source_system,
  source_reference_digest,source_entry_key_digest,entry_date,posting_period,description_code,
  evidence_digest,entry_type,recorded_by
) values (
  '15000000-0000-4000-8000-000000000710','15000000-0000-4000-8000-000000000610',
  'planning','m015_plan',repeat('7',64),repeat('8',64),'2026-04-11','2026-04-01',
  'planning.entry',repeat('9',64),'planning','audit:m015'
);
insert into accounting.journal_entries(
  journal_entry_id,accounting_version_id,source_kind,source_system,
  source_reference_digest,source_entry_key_digest,entry_date,posting_period,description_code,
  evidence_digest,entry_type,recorded_by
) values (
  '15000000-0000-4000-8000-000000000720','15000000-0000-4000-8000-000000000620',
  'planning','m015_forecast',repeat('0',64),repeat('1',64),'2026-04-12','2026-04-01',
  'forecast.entry',repeat('2',64),'planning','audit:m015'
);

select pg_temp.expect_failure('DUPLICATE_JOURNAL', $q$
  insert into accounting.journal_entries(accounting_version_id,source_kind,source_system,
    source_reference_digest,source_entry_key_digest,entry_date,posting_period,evidence_digest,entry_type,recorded_by)
  values('15000000-0000-4000-8000-000000000610','planning','m015_plan',repeat('a',64),repeat('8',64),
    '2026-04-12','2026-04-01',repeat('b',64),'planning','audit:m015')
$q$, 'accounting_journal_entries_version_source_unique');

create function pg_temp.expect_actual_evidence_rejection(
  p_label text,
  p_staging_line_id uuid,
  p_source_record_key_digest text,
  p_source_line_no bigint,
  p_stable_line_key_digest text,
  p_line_sequence integer
) returns void language plpgsql as $f$
begin
  perform pg_temp.expect_failure(p_label, format($q$
    insert into accounting.journal_lines(
      journal_entry_id,accounting_version_id,source_system,source_batch_id,source_file_id,
      staging_line_id,source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
      account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
      measure_type,posting_side,normalization_evidence_digest,recorded_by
    ) values (
      '15000000-0000-4000-8000-000000000700','15000000-0000-4000-8000-000000000600',
      'm015_source','15000000-0000-4000-8000-000000000500',
      '15000000-0000-4000-8000-000000000501',%L,%L,%s,%L,%s,
      '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
      '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
      'corporation','period_flow','debit',repeat('e',64),'audit:m015'
    )
  $q$, p_staging_line_id, p_source_record_key_digest, p_source_line_no,
    p_stable_line_key_digest, p_line_sequence),
    'BDF_JOURNAL_LINE_IMPORT_SOURCE_NOT_ELIGIBLE');
end
$f$;

select pg_temp.expect_actual_evidence_rejection(
  'ACTUAL_SOURCE_AMOUNT_NAN','15000000-0000-4000-8000-000000000520',repeat('0',64),20,repeat('0',64),20);
select pg_temp.expect_actual_evidence_rejection(
  'ACTUAL_SOURCE_AMOUNT_NULL','15000000-0000-4000-8000-000000000521',repeat('2',64),21,repeat('1',64),21);
select pg_temp.expect_actual_evidence_rejection(
  'ACTUAL_ROUNDING_UNIT_NULL','15000000-0000-4000-8000-000000000522',repeat('4',64),22,repeat('2',64),22);
select pg_temp.expect_actual_evidence_rejection(
  'ACTUAL_ROUNDING_UNIT_NAN','15000000-0000-4000-8000-000000000523',repeat('6',64),23,repeat('3',64),23);
select pg_temp.expect_actual_evidence_rejection(
  'ACTUAL_ROUNDING_DIFFERENCE_NAN','15000000-0000-4000-8000-000000000524',repeat('8',64),24,repeat('4',64),24);
select pg_temp.expect_actual_evidence_rejection(
  'ACTUAL_ROUNDING_DIFFERENCE_NULL','15000000-0000-4000-8000-000000000525',repeat('a',64),25,repeat('5',64),25);
select pg_temp.expect_actual_evidence_rejection(
  'ACTUAL_REQUIRED_ROUNDING_EVIDENCE_MISSING','15000000-0000-4000-8000-000000000526',repeat('c',64),26,repeat('6',64),26);
select pg_temp.expect_actual_evidence_rejection(
  'ACTUAL_TAX_CATEGORY_UNKNOWN','15000000-0000-4000-8000-000000000527',repeat('e',64),27,repeat('7',64),27);
select pg_temp.expect_actual_evidence_rejection(
  'ACTUAL_TAX_RATE_VERSION_UNKNOWN','15000000-0000-4000-8000-000000000528',repeat('0',64),28,repeat('8',64),28);
select pg_temp.expect_actual_evidence_rejection(
  'ACTUAL_NORMALIZED_OK_SOURCE_INCOMPLETE','15000000-0000-4000-8000-000000000525',repeat('a',64),25,repeat('9',64),29);
select pg_temp.expect_actual_evidence_rejection(
  'ACTUAL_TAX_BASIS_NORMALIZATION_STATUS_MISMATCH','15000000-0000-4000-8000-000000000503',repeat('e',64),2,repeat('a',64),30);

insert into accounting.journal_lines(
  journal_line_id,journal_entry_id,accounting_version_id,source_system,source_batch_id,source_file_id,
  staging_line_id,source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
  account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
  measure_type,posting_side,normalization_evidence_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000000800','15000000-0000-4000-8000-000000000700',
  '15000000-0000-4000-8000-000000000600','m015_source',
  '15000000-0000-4000-8000-000000000500','15000000-0000-4000-8000-000000000501',
  '15000000-0000-4000-8000-000000000502',repeat('a',64),1,repeat('c',64),1,
  '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
  '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
  'corporation','period_flow','debit',repeat('d',64),'audit:m015'
);
select pg_temp.expect_failure('ACTUAL_NAN_NORMALIZED_AMOUNT', $q$
  insert into accounting.journal_lines(
    journal_entry_id,accounting_version_id,source_system,source_batch_id,source_file_id,
    staging_line_id,source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
    account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
    measure_type,posting_side,normalization_evidence_digest,recorded_by
  ) values (
    '15000000-0000-4000-8000-000000000700','15000000-0000-4000-8000-000000000600',
    'm015_source','15000000-0000-4000-8000-000000000500',
    '15000000-0000-4000-8000-000000000501','15000000-0000-4000-8000-000000000505',
    repeat('6',64),3,repeat('7',64),3,
    '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    'corporation','period_flow','debit',repeat('8',64),'audit:m015')
$q$, 'BDF_JOURNAL_LINE_IMPORT_SOURCE_NOT_ELIGIBLE');
insert into accounting.journal_lines(
  journal_line_id,journal_entry_id,accounting_version_id,source_system,
  source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
  account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
  measure_type,posting_side,planning_contract_version,normalization_evidence_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000000810','15000000-0000-4000-8000-000000000710',
  '15000000-0000-4000-8000-000000000610','m015_plan',repeat('e',64),1,repeat('f',64),1,
  '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
  '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
  'corporation','period_flow','debit','planning-v1',repeat('1',64),'audit:m015'
);

select pg_temp.expect_failure('PLANNING_CONTRACT_MISSING', $q$
  insert into accounting.journal_lines(journal_entry_id,accounting_version_id,source_system,
    source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
    account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
    measure_type,posting_side,normalization_evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000720','15000000-0000-4000-8000-000000000620',
    'm015_forecast',repeat('3',64),1,repeat('4',64),1,
    '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    'corporation','period_flow','debit',repeat('5',64),'audit:m015')
$q$, 'accounting_journal_lines_source_shape');

insert into accounting.journal_lines(
  journal_line_id,journal_entry_id,accounting_version_id,source_system,
  source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
  account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
  measure_type,posting_side,planning_contract_version,normalization_evidence_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000000820','15000000-0000-4000-8000-000000000720',
  '15000000-0000-4000-8000-000000000620','m015_forecast',repeat('3',64),1,repeat('4',64),1,
  '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
  '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
  'corporation','period_flow','debit','forecast-v1',repeat('5',64),'audit:m015'
);
insert into accounting.journal_lines(
  journal_line_id,journal_entry_id,accounting_version_id,source_system,
  source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
  account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
  measure_type,posting_side,planning_contract_version,normalization_evidence_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000000830','15000000-0000-4000-8000-000000000720',
  '15000000-0000-4000-8000-000000000620','m015_forecast',repeat('d',64),4,repeat('e',64),4,
  '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
  '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
  'corporation','period_flow','zero','forecast-v1',repeat('f',64),'audit:m015'
);

select pg_temp.expect_failure('CALCULATED_SUBTOTAL_ACCOUNT', $q$
  insert into accounting.journal_lines(journal_entry_id,accounting_version_id,source_system,
    source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
    account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
    measure_type,posting_side,planning_contract_version,normalization_evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000720','15000000-0000-4000-8000-000000000620',
    'm015_forecast',repeat('6',64),2,repeat('7',64),2,
    '15000000-0000-4000-8000-000000000404','15000000-0000-4000-8000-000000000405',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    'corporation','period_flow','credit','forecast-v1',repeat('8',64),'audit:m015')
$q$, 'BDF_JOURNAL_LINE_ACCOUNT_MEASURE_MISMATCH');

select pg_temp.expect_failure('ACCOUNT_PERIOD_NOT_CONTAINED', $q$
  insert into accounting.journal_lines(journal_entry_id,accounting_version_id,source_system,
    source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
    account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
    measure_type,posting_side,planning_contract_version,normalization_evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000720','15000000-0000-4000-8000-000000000620',
    'm015_forecast',repeat('9',64),3,repeat('a',64),3,
    '15000000-0000-4000-8000-000000000406','15000000-0000-4000-8000-000000000407',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    'corporation','period_flow','debit','forecast-v1',repeat('b',64),'audit:m015')
$q$, 'BDF_JOURNAL_LINE_ACCOUNT_MEASURE_MISMATCH');

select pg_temp.expect_failure('INACTIVE_ORGANIZATION_SCOPE', $q$
  insert into accounting.journal_lines(journal_entry_id,accounting_version_id,source_system,
    source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
    account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
    department_id,department_version_id,measure_type,posting_side,planning_contract_version,
    normalization_evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000720','15000000-0000-4000-8000-000000000620',
    'm015_forecast',repeat('c',64),4,repeat('d',64),4,
    '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101','department',
    '15000000-0000-4000-8000-000000000310','15000000-0000-4000-8000-000000000311',
    'period_flow','debit','forecast-v1',repeat('e',64),'audit:m015')
$q$, 'BDF_JOURNAL_LINE_ORGANIZATION_SCOPE_INVALID');

select pg_temp.expect_failure('ORGANIZATION_SCOPE_PERIOD_NOT_CONTAINED', $q$
  insert into accounting.journal_lines(journal_entry_id,accounting_version_id,source_system,
    source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
    account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
    store_id,store_version_id,store_relationship_version_id,measure_type,posting_side,
    planning_contract_version,normalization_evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000720','15000000-0000-4000-8000-000000000620',
    'm015_forecast',repeat('f',64),5,repeat('0',64),5,
    '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101','store',
    '15000000-0000-4000-8000-000000000210','15000000-0000-4000-8000-000000000211',
    '15000000-0000-4000-8000-000000000213','period_flow','debit','forecast-v1',repeat('1',64),'audit:m015')
$q$, 'BDF_JOURNAL_LINE_ORGANIZATION_SCOPE_INVALID');

select pg_temp.expect_failure('ORPHAN_ACCOUNT', $q$
  insert into accounting.journal_lines(journal_entry_id,accounting_version_id,source_system,
    source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
    account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
    measure_type,posting_side,planning_contract_version,normalization_evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000710','15000000-0000-4000-8000-000000000610',
    'm015_plan',repeat('0',64),99,repeat('1',64),99,
    '15999999-0000-4000-8000-000000000998','15999999-0000-4000-8000-000000000999',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    'corporation','period_flow','debit','planning-v1',repeat('2',64),'audit:m015')
$q$, 'BDF_JOURNAL_LINE_ACCOUNT_MEASURE_MISMATCH');

select pg_temp.expect_failure('ACCOUNT_MEASURE_MISMATCH', $q$
  insert into accounting.journal_lines(journal_entry_id,accounting_version_id,source_system,
    source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
    account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
    measure_type,posting_side,planning_contract_version,normalization_evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000710','15000000-0000-4000-8000-000000000610',
    'm015_plan',repeat('2',64),2,repeat('3',64),2,
    '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    'corporation','ending_balance','debit','planning-v1',repeat('4',64),'audit:m015')
$q$, 'BDF_JOURNAL_LINE_ACCOUNT_MEASURE_MISMATCH');

select pg_temp.expect_failure('INVALID_ORGANIZATION_SCOPE', $q$
  insert into accounting.journal_lines(journal_entry_id,accounting_version_id,source_system,
    source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
    account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
    store_id,store_version_id,store_relationship_version_id,measure_type,posting_side,
    planning_contract_version,normalization_evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000710','15000000-0000-4000-8000-000000000610',
    'm015_plan',repeat('5',64),3,repeat('6',64),3,
    '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101','store',
    '15000000-0000-4000-8000-000000000200','15000000-0000-4000-8000-000000000201',
    '15999999-0000-4000-8000-000000000999','period_flow','debit','planning-v1',repeat('7',64),'audit:m015')
$q$, 'BDF_JOURNAL_LINE_ORGANIZATION_SCOPE_INVALID');

select pg_temp.expect_failure('TAX_NORMALIZATION_INCOMPLETE', $q$
  insert into accounting.journal_lines(journal_entry_id,accounting_version_id,source_system,
    source_batch_id,source_file_id,staging_line_id,source_record_key_digest,source_line_no,
    stable_line_key_digest,line_sequence,account_id,account_version_id,corporation_id,
    corporation_version_id,organization_scope_type,measure_type,posting_side,
    normalization_evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000700','15000000-0000-4000-8000-000000000600',
    'm015_source','15000000-0000-4000-8000-000000000500','15000000-0000-4000-8000-000000000501',
    '15000000-0000-4000-8000-000000000503',repeat('e',64),2,repeat('8',64),2,
    '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    'corporation','period_flow','debit',repeat('9',64),'audit:m015')
$q$, 'BDF_JOURNAL_LINE_IMPORT_SOURCE_NOT_ELIGIBLE');

select pg_temp.expect_failure('DUPLICATE_STABLE_LINE', $q$
  insert into accounting.journal_lines(journal_entry_id,accounting_version_id,source_system,
    source_record_key_digest,source_line_no,stable_line_key_digest,line_sequence,
    account_id,account_version_id,corporation_id,corporation_version_id,organization_scope_type,
    measure_type,posting_side,planning_contract_version,normalization_evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000710','15000000-0000-4000-8000-000000000610',
    'm015_plan',repeat('e',64),1,repeat('a',64),4,
    '15000000-0000-4000-8000-000000000400','15000000-0000-4000-8000-000000000401',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    'corporation','period_flow','debit','planning-v1',repeat('b',64),'audit:m015')
$q$, 'accounting_journal_lines_planning_stable_unique');

select pg_temp.expect_failure('FACT_TAX_MISMATCH', $q$
  insert into accounting.accounting_facts(journal_line_id,journal_entry_id,accounting_version_id,
    corporation_id,organization_scope_type,accounting_period,account_id,measure_type,amount,
    currency_code,tax_basis,value_status,attribution_status,derivation_status,source_line_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000800','15000000-0000-4000-8000-000000000700',
    '15000000-0000-4000-8000-000000000600','15000000-0000-4000-8000-000000000100',
    'corporation','2026-04-01','15000000-0000-4000-8000-000000000400','period_flow',99,
    'JPY','exclusive','observed','unallocated','source_normalized',repeat('c',64),'audit:m015')
$q$, 'BDF_ACCOUNTING_FACT_TAX_NORMALIZATION_MISMATCH');

select pg_temp.expect_failure('JOURNAL_FACT_MISMATCH', $q$
  insert into accounting.accounting_facts(journal_line_id,journal_entry_id,accounting_version_id,
    corporation_id,organization_scope_type,accounting_period,account_id,measure_type,amount,
    currency_code,tax_basis,value_status,attribution_status,derivation_status,source_line_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000810','15000000-0000-4000-8000-000000000710',
    '15000000-0000-4000-8000-000000000610','15000000-0000-4000-8000-000000000100',
    'corporation','2026-04-01','15000000-0000-4000-8000-000000000402','period_flow',100,
    'JPY','exclusive','observed','unallocated','planning',repeat('f',64),'audit:m015')
$q$, 'BDF_ACCOUNTING_FACT_JOURNAL_MISMATCH');

select pg_temp.expect_failure('POSTING_SIDE_NULL_MISMATCH', $q$
  insert into accounting.accounting_facts(journal_line_id,journal_entry_id,accounting_version_id,
    corporation_id,organization_scope_type,accounting_period,account_id,measure_type,amount,
    currency_code,tax_basis,value_status,attribution_status,derivation_status,source_line_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000820','15000000-0000-4000-8000-000000000720',
    '15000000-0000-4000-8000-000000000620','15000000-0000-4000-8000-000000000100',
    'corporation','2026-04-01','15000000-0000-4000-8000-000000000400','period_flow',null,
    'JPY','exclusive','not_applicable','not_applicable','planning',repeat('4',64),'audit:m015')
$q$, 'BDF_ACCOUNTING_FACT_POSTING_SIDE_MISMATCH');

select pg_temp.expect_failure('FACT_NAN_REJECTED', $q$
  insert into accounting.accounting_facts(journal_line_id,journal_entry_id,accounting_version_id,
    corporation_id,organization_scope_type,accounting_period,account_id,measure_type,amount,
    currency_code,tax_basis,value_status,attribution_status,derivation_status,source_line_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000820','15000000-0000-4000-8000-000000000720',
    '15000000-0000-4000-8000-000000000620','15000000-0000-4000-8000-000000000100',
    'corporation','2026-04-01','15000000-0000-4000-8000-000000000400','period_flow','NaN'::numeric,
    'JPY','exclusive','observed','directly_attributed','planning',repeat('4',64),'audit:m015')
$q$, 'accounting_facts_amount_finite');

select pg_temp.expect_failure('ZERO_UNALLOCATED_FACT_REJECTED', $q$
  insert into accounting.accounting_facts(journal_line_id,journal_entry_id,accounting_version_id,
    corporation_id,organization_scope_type,accounting_period,account_id,measure_type,amount,
    currency_code,tax_basis,value_status,attribution_status,derivation_status,source_line_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000830','15000000-0000-4000-8000-000000000720',
    '15000000-0000-4000-8000-000000000620','15000000-0000-4000-8000-000000000100',
    'corporation','2026-04-01','15000000-0000-4000-8000-000000000400','period_flow',0,
    'JPY','exclusive','zero','unallocated','planning',repeat('e',64),'audit:m015')
$q$, 'accounting_facts_attribution_check');

insert into accounting.accounting_facts(
  accounting_fact_id,journal_line_id,journal_entry_id,accounting_version_id,corporation_id,
  organization_scope_type,accounting_period,account_id,measure_type,amount,currency_code,tax_basis,
  value_status,attribution_status,derivation_status,source_line_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000000900','15000000-0000-4000-8000-000000000800',
  '15000000-0000-4000-8000-000000000700','15000000-0000-4000-8000-000000000600',
  '15000000-0000-4000-8000-000000000100','corporation','2026-04-01',
  '15000000-0000-4000-8000-000000000400','period_flow',100,'JPY','exclusive','observed',
  'unallocated','source_normalized',repeat('c',64),'audit:m015'
);
do $actual_evidence_pass$
begin
  if not exists (
    select 1
    from accounting.accounting_facts f
    join accounting.journal_lines l on l.journal_line_id = f.journal_line_id
    join accounting.import_staging_lines s on s.staging_line_id = l.staging_line_id
    where f.accounting_fact_id = '15000000-0000-4000-8000-000000000900'
      and s.source_amount = 110
      and s.source_tax_basis = 'inclusive'
      and s.source_tax_category = 'standard'
      and s.source_tax_rate = 0.1
      and s.tax_rate_source_version = 'tax-v1'
      and s.rounding_mode = 'half_up'
      and s.rounding_scope = 'line'
      and s.rounding_unit = 1
      and s.rounding_difference_amount = 0
      and s.normalized_amount = 100
      and s.tax_basis = 'exclusive'
      and s.normalization_status = 'passed'
      and s.mapping_status = 'passed'
      and s.validation_status = 'valid'
  ) then
    raise exception 'M015_ACTUAL_TAX_ROUNDING_COMPLETE_PATH_MISSING';
  end if;
  raise notice 'M015_EXPECTED ACTUAL_TAX_ROUNDING_COMPLETE_PASS';
end
$actual_evidence_pass$;
insert into accounting.accounting_facts(
  accounting_fact_id,journal_line_id,journal_entry_id,accounting_version_id,corporation_id,
  organization_scope_type,accounting_period,account_id,measure_type,amount,currency_code,tax_basis,
  value_status,attribution_status,derivation_status,source_line_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000000910','15000000-0000-4000-8000-000000000810',
  '15000000-0000-4000-8000-000000000710','15000000-0000-4000-8000-000000000610',
  '15000000-0000-4000-8000-000000000100','corporation','2026-04-01',
  '15000000-0000-4000-8000-000000000400','period_flow',100,'JPY','exclusive','observed',
  'unallocated','planning',repeat('f',64),'audit:m015'
);
insert into accounting.accounting_facts(
  accounting_fact_id,journal_line_id,journal_entry_id,accounting_version_id,corporation_id,
  organization_scope_type,accounting_period,account_id,measure_type,amount,currency_code,tax_basis,
  value_status,attribution_status,derivation_status,source_line_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000000920','15000000-0000-4000-8000-000000000820',
  '15000000-0000-4000-8000-000000000720','15000000-0000-4000-8000-000000000620',
  '15000000-0000-4000-8000-000000000100','corporation','2026-04-01',
  '15000000-0000-4000-8000-000000000400','period_flow',120,'JPY','exclusive','observed',
  'directly_attributed','planning',repeat('4',64),'audit:m015'
);

select pg_temp.expect_failure('FACT_ONE_TO_ONE', $q$
  insert into accounting.accounting_facts(journal_line_id,journal_entry_id,accounting_version_id,
    corporation_id,organization_scope_type,accounting_period,account_id,measure_type,amount,
    currency_code,tax_basis,value_status,attribution_status,derivation_status,source_line_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000810','15000000-0000-4000-8000-000000000710',
    '15000000-0000-4000-8000-000000000610','15000000-0000-4000-8000-000000000100',
    'corporation','2026-04-01','15000000-0000-4000-8000-000000000400','period_flow',100,
    'JPY','exclusive','observed','unallocated','planning',repeat('f',64),'audit:m015')
$q$, 'accounting_facts_journal_line_id_key');

select pg_temp.expect_failure('FACT_UPDATE_IMMUTABLE', $q$
  update accounting.accounting_facts set amount=101
  where accounting_fact_id='15000000-0000-4000-8000-000000000910'
$q$, 'BDF_ACCOUNTING_LEDGER_IMMUTABLE');
select pg_temp.expect_failure('FACT_DELETE_IMMUTABLE', $q$
  delete from accounting.accounting_facts
  where accounting_fact_id='15000000-0000-4000-8000-000000000920'
$q$, 'BDF_ACCOUNTING_LEDGER_IMMUTABLE');
select pg_temp.expect_failure('JOURNAL_LINE_UPDATE_IMMUTABLE', $q$
  update accounting.journal_lines set line_sequence=2
  where journal_line_id='15000000-0000-4000-8000-000000000820'
$q$, 'BDF_ACCOUNTING_LEDGER_IMMUTABLE');
select pg_temp.expect_failure('JOURNAL_DELETE_IMMUTABLE', $q$
  delete from accounting.journal_entries
  where journal_entry_id='15000000-0000-4000-8000-000000000710'
$q$, 'BDF_ACCOUNTING_LEDGER_IMMUTABLE');

insert into accounting.allocation_rule_versions(
  allocation_rule_version_id,allocation_rule_id,version_no,rule_code,basis_type,
  source_scope_type,target_scope_type,precision_scale,rounding_mode,remainder_handling,
  effective_from,effective_to,approval_reference,mapping_contract_version,content_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000001001','15000000-0000-4000-8000-000000001000',1,
  'm015.store_ratio','fixed_ratio','corporation','store',4,'half_up','explicit_unallocated',
  '2026-01-01','2027-01-01','APR:M015:ALLOCATION','allocation-v1',repeat('1',64),'audit:m015'
);
insert into accounting.allocation_rule_versions(
  allocation_rule_version_id,allocation_rule_id,version_no,rule_code,basis_type,
  source_scope_type,target_scope_type,precision_scale,rounding_mode,remainder_handling,
  effective_from,effective_to,approval_reference,mapping_contract_version,content_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000001003','15000000-0000-4000-8000-000000001002',1,
  'm015.invalid_source','fixed_ratio','store','store',4,'half_up','explicit_unallocated',
  '2026-01-01','2027-01-01','APR:M015:SOURCE','allocation-v1',repeat('6',64),'audit:m015'
);

select pg_temp.expect_failure('ALLOCATION_RULE_SOURCE_SCOPE_MISMATCH', $q$
  insert into accounting.allocation_sets(
    source_fact_id,allocation_rule_version_id,derived_accounting_version_id,
    allocable_amount,currency_code,tax_basis,rounding_difference_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000910','15000000-0000-4000-8000-000000001003',
    '15000000-0000-4000-8000-000000000611',100,'JPY','exclusive',0,repeat('7',64),'audit:m015')
$q$, 'BDF_ALLOCATION_RULE_NOT_ELIGIBLE');

select pg_temp.expect_failure('DIRECT_CORPORATION_FACT_NOT_ALLOCABLE', $q$
  insert into accounting.allocation_sets(
    source_fact_id,allocation_rule_version_id,derived_accounting_version_id,
    allocable_amount,currency_code,tax_basis,rounding_difference_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000920','15000000-0000-4000-8000-000000001001',
    '15000000-0000-4000-8000-000000000620',120,'JPY','exclusive',0,repeat('8',64),'audit:m015')
$q$, 'BDF_ALLOCATION_SOURCE_FACT_NOT_ALLOCABLE');

select pg_temp.expect_failure('ALLOCATION_SET_ALLOCABLE_NAN_REJECTED', $q$
  insert into accounting.allocation_sets(
    source_fact_id,allocation_rule_version_id,derived_accounting_version_id,
    allocable_amount,currency_code,tax_basis,rounding_difference_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000910','15000000-0000-4000-8000-000000001001',
    '15000000-0000-4000-8000-000000000611','NaN'::numeric,'JPY','exclusive',0,repeat('a',64),'audit:m015')
$q$, 'BDF_ALLOCATION_SET_SOURCE_MISMATCH');

select pg_temp.expect_failure('ALLOCATION_SET_ZERO_REJECTED', $q$
  insert into accounting.allocation_sets(
    source_fact_id,allocation_rule_version_id,derived_accounting_version_id,
    allocable_amount,currency_code,tax_basis,rounding_difference_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000910','15000000-0000-4000-8000-000000001001',
    '15000000-0000-4000-8000-000000000611',0,'JPY','exclusive',0,repeat('f',64),'audit:m015')
$q$, 'BDF_ALLOCATION_SET_SOURCE_MISMATCH');

select pg_temp.expect_failure('ALLOCATION_SET_ROUNDING_NAN_REJECTED', $q$
  insert into accounting.allocation_sets(
    source_fact_id,allocation_rule_version_id,derived_accounting_version_id,
    allocable_amount,currency_code,tax_basis,rounding_difference_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000000910','15000000-0000-4000-8000-000000001001',
    '15000000-0000-4000-8000-000000000611',100,'JPY','exclusive','NaN'::numeric,repeat('b',64),'audit:m015')
$q$, 'accounting_allocation_sets_amount_finite');

insert into accounting.allocation_sets(
  allocation_id,source_fact_id,allocation_rule_version_id,derived_accounting_version_id,
  allocable_amount,currency_code,tax_basis,rounding_difference_amount,evidence_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000001100','15000000-0000-4000-8000-000000000910',
  '15000000-0000-4000-8000-000000001001','15000000-0000-4000-8000-000000000611',
  100,'JPY','exclusive',0,repeat('2',64),'audit:m015'
);

select pg_temp.expect_failure('ALLOCATION_RATIO_NAN_REJECTED', $q$
  insert into accounting.accounting_allocations(
    allocation_id,source_fact_id,derived_accounting_version_id,target_scope_type,
    target_corporation_id,target_corporation_version_id,target_store_id,target_store_version_id,
    target_store_relationship_version_id,attribution_status,allocation_ratio,allocated_amount,
    rounding_adjustment_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000001100','15000000-0000-4000-8000-000000000910',
    '15000000-0000-4000-8000-000000000611','store',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    '15000000-0000-4000-8000-000000000200','15000000-0000-4000-8000-000000000201',
    '15000000-0000-4000-8000-000000000203','allocated','NaN'::numeric,10,0,repeat('c',64),'audit:m015')
$q$, 'accounting_allocations_amount_finite');

select pg_temp.expect_failure('ALLOCATION_AMOUNT_NAN_REJECTED', $q$
  insert into accounting.accounting_allocations(
    allocation_id,source_fact_id,derived_accounting_version_id,target_scope_type,
    target_corporation_id,target_corporation_version_id,target_store_id,target_store_version_id,
    target_store_relationship_version_id,attribution_status,allocation_ratio,allocated_amount,
    rounding_adjustment_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000001100','15000000-0000-4000-8000-000000000910',
    '15000000-0000-4000-8000-000000000611','store',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    '15000000-0000-4000-8000-000000000200','15000000-0000-4000-8000-000000000201',
    '15000000-0000-4000-8000-000000000203','allocated',0.1,'NaN'::numeric,0,repeat('d',64),'audit:m015')
$q$, 'BDF_ACCOUNTING_ALLOCATION_OVERAGE');

select pg_temp.expect_failure('ALLOCATION_ROUNDING_NAN_REJECTED', $q$
  insert into accounting.accounting_allocations(
    allocation_id,source_fact_id,derived_accounting_version_id,target_scope_type,
    target_corporation_id,target_corporation_version_id,target_store_id,target_store_version_id,
    target_store_relationship_version_id,attribution_status,allocation_ratio,allocated_amount,
    rounding_adjustment_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000001100','15000000-0000-4000-8000-000000000910',
    '15000000-0000-4000-8000-000000000611','store',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    '15000000-0000-4000-8000-000000000200','15000000-0000-4000-8000-000000000201',
    '15000000-0000-4000-8000-000000000203','allocated',0.1,10,'NaN'::numeric,repeat('e',64),'audit:m015')
$q$, 'accounting_allocations_amount_finite');

select pg_temp.expect_failure('ALLOCATION_RULE_TARGET_SCOPE_MISMATCH', $q$
  insert into accounting.accounting_allocations(
    allocation_id,source_fact_id,derived_accounting_version_id,target_scope_type,
    target_corporation_id,target_corporation_version_id,target_department_id,target_department_version_id,
    attribution_status,allocation_ratio,allocated_amount,rounding_adjustment_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000001100','15000000-0000-4000-8000-000000000910',
    '15000000-0000-4000-8000-000000000611','department',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    '15000000-0000-4000-8000-000000000300','15000000-0000-4000-8000-000000000301',
    'allocated',0.1,10,0,repeat('9',64),'audit:m015')
$q$, 'BDF_ACCOUNTING_ALLOCATION_RULE_SCOPE_MISMATCH');

select pg_temp.expect_failure('ALLOCATION_RATIO_NULL', $q$
  insert into accounting.accounting_allocations(
    allocation_id,source_fact_id,derived_accounting_version_id,target_scope_type,
    target_corporation_id,target_corporation_version_id,target_store_id,target_store_version_id,
    target_store_relationship_version_id,attribution_status,allocation_ratio,allocated_amount,
    rounding_adjustment_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000001100','15000000-0000-4000-8000-000000000910',
    '15000000-0000-4000-8000-000000000611','store',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    '15000000-0000-4000-8000-000000000200','15000000-0000-4000-8000-000000000201',
    '15000000-0000-4000-8000-000000000203','allocated',null,10,0,repeat('a',64),'audit:m015')
$q$, 'accounting_allocations_attribution_check');
insert into accounting.accounting_allocations(
  accounting_allocation_id,allocation_id,source_fact_id,derived_accounting_version_id,
  target_scope_type,target_corporation_id,target_corporation_version_id,target_store_id,
  target_store_version_id,target_store_relationship_version_id,attribution_status,
  allocation_ratio,allocated_amount,rounding_adjustment_amount,evidence_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000001200','15000000-0000-4000-8000-000000001100',
  '15000000-0000-4000-8000-000000000910','15000000-0000-4000-8000-000000000611',
  'store','15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
  '15000000-0000-4000-8000-000000000200','15000000-0000-4000-8000-000000000201',
  '15000000-0000-4000-8000-000000000203','allocated',0.6,60,0,repeat('3',64),'audit:m015'
);

select pg_temp.expect_failure('ALLOCATION_ROUNDING_TOTAL_MISMATCH', $q$
  do $inner$
  begin
    insert into accounting.accounting_allocations(
      accounting_allocation_id,allocation_id,source_fact_id,derived_accounting_version_id,
      target_scope_type,target_corporation_id,target_corporation_version_id,attribution_status,
      allocation_ratio,allocated_amount,rounding_adjustment_amount,evidence_digest,recorded_by
    ) values (
      '15000000-0000-4000-8000-000000001210','15000000-0000-4000-8000-000000001100',
      '15000000-0000-4000-8000-000000000910','15000000-0000-4000-8000-000000000611',
      'corporation','15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
      'unallocated',null,40,1,repeat('0',64),'audit:m015'
    );
    update accounting.allocation_sets
    set status='balanced',balanced_at=statement_timestamp(),balanced_by='audit:m015'
    where allocation_id='15000000-0000-4000-8000-000000001100';
  end;
  $inner$;
$q$, 'BDF_ALLOCATION_RECONCILIATION_FAILED');

select pg_temp.expect_failure('ALLOCATION_OVERAGE', $q$
  insert into accounting.accounting_allocations(
    allocation_id,source_fact_id,derived_accounting_version_id,target_scope_type,
    target_corporation_id,target_corporation_version_id,target_store_id,target_store_version_id,
    target_store_relationship_version_id,attribution_status,allocation_ratio,allocated_amount,
    rounding_adjustment_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000001100','15000000-0000-4000-8000-000000000910',
    '15000000-0000-4000-8000-000000000611','store',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    '15000000-0000-4000-8000-000000000200','15000000-0000-4000-8000-000000000201',
    '15000000-0000-4000-8000-000000000203','allocated',0.5,50,0,repeat('4',64),'audit:m015')
$q$, 'BDF_ACCOUNTING_ALLOCATION_OVERAGE');

select pg_temp.expect_failure('ALLOCATION_SHORTAGE_FINAL', $q$
  update accounting.allocation_sets set status='balanced',balanced_at=statement_timestamp(),balanced_by='audit:m015'
  where allocation_id='15000000-0000-4000-8000-000000001100'
$q$, 'BDF_ALLOCATION_RECONCILIATION_FAILED');

insert into accounting.accounting_allocations(
  accounting_allocation_id,allocation_id,source_fact_id,derived_accounting_version_id,
  target_scope_type,target_corporation_id,target_corporation_version_id,attribution_status,
  allocation_ratio,allocated_amount,rounding_adjustment_amount,evidence_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000001201','15000000-0000-4000-8000-000000001100',
  '15000000-0000-4000-8000-000000000910','15000000-0000-4000-8000-000000000611',
  'corporation','15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
  'unallocated',null,40,0,repeat('5',64),'audit:m015'
);
update accounting.allocation_sets
set status='balanced',balanced_at=statement_timestamp(),balanced_by='audit:m015'
where allocation_id='15000000-0000-4000-8000-000000001100';

-- Actual allocations stay inside the same draft Accounting Version; no synthetic Import Batch is invented.
insert into accounting.allocation_sets(
  allocation_id,source_fact_id,allocation_rule_version_id,derived_accounting_version_id,
  allocable_amount,currency_code,tax_basis,rounding_difference_amount,evidence_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000001101','15000000-0000-4000-8000-000000000900',
  '15000000-0000-4000-8000-000000001001','15000000-0000-4000-8000-000000000600',
  100,'JPY','exclusive',0,repeat('b',64),'audit:m015'
);
insert into accounting.accounting_allocations(
  accounting_allocation_id,allocation_id,source_fact_id,derived_accounting_version_id,
  target_scope_type,target_corporation_id,target_corporation_version_id,target_store_id,
  target_store_version_id,target_store_relationship_version_id,attribution_status,
  allocation_ratio,allocated_amount,rounding_adjustment_amount,evidence_digest,recorded_by
) values (
  '15000000-0000-4000-8000-000000001202','15000000-0000-4000-8000-000000001101',
  '15000000-0000-4000-8000-000000000900','15000000-0000-4000-8000-000000000600',
  'store','15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
  '15000000-0000-4000-8000-000000000200','15000000-0000-4000-8000-000000000201',
  '15000000-0000-4000-8000-000000000203','allocated',1,100,0,repeat('c',64),'audit:m015'
);
update accounting.allocation_sets
set status='balanced',balanced_at=statement_timestamp(),balanced_by='audit:m015'
where allocation_id='15000000-0000-4000-8000-000000001101';

select pg_temp.expect_failure('ALLOCATION_AFTER_BALANCE', $q$
  insert into accounting.accounting_allocations(
    allocation_id,source_fact_id,derived_accounting_version_id,target_scope_type,
    target_corporation_id,target_corporation_version_id,target_department_id,target_department_version_id,
    attribution_status,allocation_ratio,allocated_amount,rounding_adjustment_amount,evidence_digest,recorded_by)
  values('15000000-0000-4000-8000-000000001100','15000000-0000-4000-8000-000000000910',
    '15000000-0000-4000-8000-000000000611','department',
    '15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000101',
    '15000000-0000-4000-8000-000000000300','15000000-0000-4000-8000-000000000301',
    'allocated',0.1,10,0,repeat('6',64),'audit:m015')
$q$, 'BDF_ALLOCATION_SET_NOT_DRAFT');
select pg_temp.expect_failure('ALLOCATION_DELETE_IMMUTABLE', $q$
  delete from accounting.accounting_allocations
  where accounting_allocation_id='15000000-0000-4000-8000-000000001200'
$q$, 'BDF_ACCOUNTING_ALLOCATION_IMMUTABLE');

do $checks$
begin
  if (select count(*) from accounting.accounting_facts) <> 3 then
    raise exception 'M015_FACT_FIXTURE_COUNT';
  end if;
  if (select count(*) from accounting.accounting_allocations) <> 3
    or (select status from accounting.allocation_sets
        where allocation_id='15000000-0000-4000-8000-000000001100') <> 'balanced'
    or (select status from accounting.allocation_sets
        where allocation_id='15000000-0000-4000-8000-000000001101') <> 'balanced' then
    raise exception 'M015_ALLOCATION_FIXTURE_COUNT';
  end if;
end
$checks$;

rollback;
