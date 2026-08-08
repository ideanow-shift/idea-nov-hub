-- Synthetic M016 lifecycle/negative test. Entire fixture is rolled back.
begin;

create function pg_temp.expect_failure(p_label text,p_sql text,p_reason text)
returns void language plpgsql as $f$
begin
  begin execute p_sql;
  exception when others then
    if position(p_reason in sqlerrm)>0 then raise notice 'M016_EXPECTED %',p_label; return; end if;
    raise exception 'M016_WRONG_REJECTION % expected=% actual=%',p_label,p_reason,sqlerrm;
  end;
  raise exception 'M016_MISPASS %',p_label;
end
$f$;

insert into governance.master_source_snapshots(
  source_snapshot_id,source_system,source_environment,source_version,snapshot_version,
  source_as_of,content_digest,mapping_contract_version,masking_policy_version,
  total_record_count,approval_reference,created_by
) values (
  '16000000-0000-4000-8000-000000000001','m016-fixture','test','source-v1','snapshot-v1',
  '2026-04-01T00:00:00Z',repeat('1',64),'mapping-v1','masking-v1',3,'approval:m016','audit:m016'
);
insert into governance.canonical_entity_registry(canonical_entity_id,entity_type) values
  ('16000000-0000-4000-8000-000000000100','corporation'),
  ('16000000-0000-4000-8000-000000000700','employee'),
  ('16000000-0000-4000-8000-000000000701','employee');
insert into core.corporation_identities(corporation_id) values ('16000000-0000-4000-8000-000000000100');
insert into core.employee_identities(employee_id) values
  ('16000000-0000-4000-8000-000000000700'),('16000000-0000-4000-8000-000000000701');
insert into governance.canonical_version_registry(entity_version_id,canonical_entity_id,entity_type,source_snapshot_id)
values ('16000000-0000-4000-8000-000000000101','16000000-0000-4000-8000-000000000100','corporation','16000000-0000-4000-8000-000000000001');
insert into core.corporations(
  corporation_version_id,corporation_id,corporation_code,display_name,status,effective_from,effective_to,
  source_snapshot_id,source_record_digest
) values (
  '16000000-0000-4000-8000-000000000101','16000000-0000-4000-8000-000000000100',
  'M016-CORP','M016 Corporation','active','2026-01-01','2027-01-01',
  '16000000-0000-4000-8000-000000000001',repeat('2',64)
);

insert into accounting.account_identities(account_id,created_by) values
  ('16000000-0000-4000-8000-000000000200','audit:m016'),
  ('16000000-0000-4000-8000-000000000202','audit:m016');
insert into accounting.accounts(
  account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,
  account_category,normal_balance,sign_policy,measure_type,display_order,effective_from,effective_to,
  status,source_version,mapping_contract_version,content_digest,recorded_by
) values
  ('16000000-0000-4000-8000-000000000201','16000000-0000-4000-8000-000000000200',1,
   'M016-EXP','M016 Expense','posting','pl','operating_expense','debit','debit_positive','period_flow',10,
   '2026-01-01','2027-01-01','active','account-v1','mapping-v1',repeat('3',64),'audit:m016'),
  ('16000000-0000-4000-8000-000000000203','16000000-0000-4000-8000-000000000202',1,
   'M016-REV','M016 Revenue','posting','pl','revenue','credit','credit_positive','period_flow',20,
   '2026-01-01','2027-01-01','active','account-v1','mapping-v1',repeat('4',64),'audit:m016');

insert into accounting.accounting_versions(
  accounting_version_id,corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,
  version_sequence,version_label,source_snapshot_id,parent_version_id,content_hash,created_by
) values
  ('16000000-0000-4000-8000-000000000300','16000000-0000-4000-8000-000000000100','budget','baseline',2026,
   '2026-04-01','2026-05-01',1,'M016 valid','16000000-0000-4000-8000-000000000001',null,repeat('5',64),
   'canonical:16000000-0000-4000-8000-000000000700'),
  ('16000000-0000-4000-8000-000000000301','16000000-0000-4000-8000-000000000100','budget','revision',2026,
   '2026-04-01','2026-05-01',2,'M016 failed','16000000-0000-4000-8000-000000000001',
   '16000000-0000-4000-8000-000000000300',repeat('6',64),'audit:m016-maker'),
  ('16000000-0000-4000-8000-000000000302','16000000-0000-4000-8000-000000000100','budget','revision',2026,
   '2026-04-01','2026-05-01',3,'M016 pending','16000000-0000-4000-8000-000000000001',
   '16000000-0000-4000-8000-000000000301',repeat('7',64),'audit:m016-maker');

-- Balanced valid Version.
insert into accounting.journal_entries(
  journal_entry_id,accounting_version_id,source_kind,source_system,source_reference_digest,
  source_entry_key_digest,entry_date,posting_period,evidence_digest,entry_type,recorded_by
) values ('16000000-0000-4000-8000-000000000400','16000000-0000-4000-8000-000000000300',
  'planning','m016_plan',repeat('8',64),repeat('9',64),'2026-04-30','2026-04-01',repeat('a',64),'planning','audit:m016');
insert into accounting.journal_lines(
  journal_line_id,journal_entry_id,accounting_version_id,source_system,source_record_key_digest,
  source_line_no,stable_line_key_digest,line_sequence,account_id,account_version_id,
  corporation_id,corporation_version_id,organization_scope_type,measure_type,posting_side,
  planning_contract_version,normalization_evidence_digest,recorded_by
) values
  ('16000000-0000-4000-8000-000000000410','16000000-0000-4000-8000-000000000400','16000000-0000-4000-8000-000000000300',
   'm016_plan',repeat('b',64),1,repeat('c',64),1,'16000000-0000-4000-8000-000000000200',
   '16000000-0000-4000-8000-000000000201','16000000-0000-4000-8000-000000000100',
   '16000000-0000-4000-8000-000000000101','corporation','period_flow','debit','planning-v1',repeat('d',64),'audit:m016'),
  ('16000000-0000-4000-8000-000000000411','16000000-0000-4000-8000-000000000400','16000000-0000-4000-8000-000000000300',
   'm016_plan',repeat('e',64),2,repeat('f',64),2,'16000000-0000-4000-8000-000000000202',
   '16000000-0000-4000-8000-000000000203','16000000-0000-4000-8000-000000000100',
   '16000000-0000-4000-8000-000000000101','corporation','period_flow','credit','planning-v1',repeat('1',64),'audit:m016');
insert into accounting.accounting_facts(
  accounting_fact_id,journal_line_id,journal_entry_id,accounting_version_id,corporation_id,
  organization_scope_type,accounting_period,account_id,measure_type,amount,currency_code,tax_basis,
  value_status,attribution_status,derivation_status,source_line_digest,recorded_by
) values
  ('16000000-0000-4000-8000-000000000420','16000000-0000-4000-8000-000000000410','16000000-0000-4000-8000-000000000400',
   '16000000-0000-4000-8000-000000000300','16000000-0000-4000-8000-000000000100','corporation','2026-04-01',
   '16000000-0000-4000-8000-000000000200','period_flow',100,'JPY','exclusive','observed','directly_attributed','planning',repeat('c',64),'audit:m016'),
  ('16000000-0000-4000-8000-000000000421','16000000-0000-4000-8000-000000000411','16000000-0000-4000-8000-000000000400',
   '16000000-0000-4000-8000-000000000300','16000000-0000-4000-8000-000000000100','corporation','2026-04-01',
   '16000000-0000-4000-8000-000000000202','period_flow',-100,'JPY','exclusive','observed','directly_attributed','planning',repeat('f',64),'audit:m016');

-- Unbalanced failure Version.
insert into accounting.journal_entries(
  journal_entry_id,accounting_version_id,source_kind,source_system,source_reference_digest,
  source_entry_key_digest,entry_date,posting_period,evidence_digest,entry_type,recorded_by
) values ('16000000-0000-4000-8000-000000000401','16000000-0000-4000-8000-000000000301',
  'planning','m016_plan',repeat('4',64),repeat('5',64),'2026-04-30','2026-04-01',repeat('6',64),'planning','audit:m016');
insert into accounting.journal_lines(
  journal_line_id,journal_entry_id,accounting_version_id,source_system,source_record_key_digest,
  source_line_no,stable_line_key_digest,line_sequence,account_id,account_version_id,
  corporation_id,corporation_version_id,organization_scope_type,measure_type,posting_side,
  planning_contract_version,normalization_evidence_digest,recorded_by
) values ('16000000-0000-4000-8000-000000000412','16000000-0000-4000-8000-000000000401',
  '16000000-0000-4000-8000-000000000301','m016_plan',repeat('7',64),1,repeat('8',64),1,
  '16000000-0000-4000-8000-000000000200','16000000-0000-4000-8000-000000000201',
  '16000000-0000-4000-8000-000000000100','16000000-0000-4000-8000-000000000101',
  'corporation','period_flow','debit','planning-v1',repeat('9',64),'audit:m016');
insert into accounting.accounting_facts(
  accounting_fact_id,journal_line_id,journal_entry_id,accounting_version_id,corporation_id,
  organization_scope_type,accounting_period,account_id,measure_type,amount,currency_code,tax_basis,
  value_status,attribution_status,derivation_status,source_line_digest,recorded_by
) values ('16000000-0000-4000-8000-000000000422','16000000-0000-4000-8000-000000000412',
  '16000000-0000-4000-8000-000000000401','16000000-0000-4000-8000-000000000301',
  '16000000-0000-4000-8000-000000000100','corporation','2026-04-01','16000000-0000-4000-8000-000000000200',
  'period_flow',50,'JPY','exclusive','observed','directly_attributed','planning',repeat('8',64),'audit:m016');

-- Pending Version has a Journal Line but no Fact.
insert into accounting.journal_entries(
  journal_entry_id,accounting_version_id,source_kind,source_system,source_reference_digest,
  source_entry_key_digest,entry_date,posting_period,evidence_digest,entry_type,recorded_by
) values ('16000000-0000-4000-8000-000000000402','16000000-0000-4000-8000-000000000302',
  'planning','m016_plan',repeat('b',64),repeat('c',64),'2026-04-30','2026-04-01',repeat('d',64),'planning','audit:m016');
insert into accounting.journal_lines(
  journal_line_id,journal_entry_id,accounting_version_id,source_system,source_record_key_digest,
  source_line_no,stable_line_key_digest,line_sequence,account_id,account_version_id,
  corporation_id,corporation_version_id,organization_scope_type,measure_type,posting_side,
  planning_contract_version,normalization_evidence_digest,recorded_by
) values ('16000000-0000-4000-8000-000000000413','16000000-0000-4000-8000-000000000402',
  '16000000-0000-4000-8000-000000000302','m016_plan',repeat('e',64),1,repeat('f',64),1,
  '16000000-0000-4000-8000-000000000200','16000000-0000-4000-8000-000000000201',
  '16000000-0000-4000-8000-000000000100','16000000-0000-4000-8000-000000000101',
  'corporation','period_flow','debit','planning-v1',repeat('1',64),'audit:m016');

update accounting.accounting_versions set status='validating',validating_at=statement_timestamp(),
  validating_by='service:m016-validator' where accounting_version_id in (
    '16000000-0000-4000-8000-000000000300','16000000-0000-4000-8000-000000000301',
    '16000000-0000-4000-8000-000000000302');

select pg_temp.expect_failure('ORPHAN_VERSION',$q$
  select accounting.record_accounting_validation('16000000-0000-4000-8000-000000000399',
    '16000000-0000-4000-8000-000000000500','journal_completeness','service:m016-validator',
    'accounting.validator','validator-v1','evidence:orphan',repeat('0',64),
    '16000000-0000-4000-8000-000000000600')
$q$,'BDF_M016_ORPHAN_ACCOUNTING_VERSION');
select pg_temp.expect_failure('STALE_VERSION',$q$
  select accounting.record_accounting_validation('16000000-0000-4000-8000-000000000300',
    '16000000-0000-4000-8000-000000000500','journal_completeness','service:m016-validator',
    'accounting.validator','validator-v1','evidence:stale',repeat('0',64),
    '16000000-0000-4000-8000-000000000600')
$q$,'BDF_M016_STALE_VERSION');
select pg_temp.expect_failure('EVIDENCE_INSUFFICIENT_PASS',$q$
  insert into accounting.validation_results(
    accounting_version_id,validation_cycle_id,validation_code,severity,result_status,expected_value,
    actual_value,evidence_reference,checked_by,checker_role,validator_version,version_content_hash,
    is_blocking,correlation_id
  ) values ('16000000-0000-4000-8000-000000000300','16000000-0000-4000-8000-000000000599',
    'journal_completeness','info','pass','0',null,'evidence:missing','audit:test','accounting.validator',
    'validator-v1',repeat('5',64),true,'16000000-0000-4000-8000-000000000699')
$q$,'accounting_validation_results_result_evidence_check');

do $do$
declare r record;
begin
  for r in select validation_code from accounting.m016_required_validation_codes('budget') loop
    perform accounting.record_accounting_validation('16000000-0000-4000-8000-000000000300',
      '16000000-0000-4000-8000-000000000500',r.validation_code,'service:m016-validator',
      'accounting.validator','validator-v1','evidence:valid-cycle',repeat('5',64),
      '16000000-0000-4000-8000-000000000600');
    perform accounting.record_accounting_validation('16000000-0000-4000-8000-000000000301',
      '16000000-0000-4000-8000-000000000501',r.validation_code,'service:m016-validator',
      'accounting.validator','validator-v1','evidence:failed-cycle',repeat('6',64),
      '16000000-0000-4000-8000-000000000601');
    perform accounting.record_accounting_validation('16000000-0000-4000-8000-000000000302',
      '16000000-0000-4000-8000-000000000502',r.validation_code,'service:m016-validator',
      'accounting.validator','validator-v1','evidence:pending-cycle',repeat('7',64),
      '16000000-0000-4000-8000-000000000602');
  end loop;
end
$do$;

select pg_temp.expect_failure('VALIDATION_PENDING_APPROVAL',$q$
  select accounting.record_accounting_approval('16000000-0000-4000-8000-000000000302',
    '16000000-0000-4000-8000-000000000502','accounting_confirmed','approved',
    'canonical:16000000-0000-4000-8000-000000000701','accounting.checker','approved',
    'approval:pending',repeat('7',64),'16000000-0000-4000-8000-000000000602')
$q$,'BDF_M016_VALIDATION_PASS_REQUIRED');
select pg_temp.expect_failure('PENDING_FINALIZE',$q$
  select accounting.finalize_accounting_validation('16000000-0000-4000-8000-000000000302',
    '16000000-0000-4000-8000-000000000502','service:m016-validator','accounting.validator',
    'validation_complete','evidence:pending-cycle',repeat('7',64),
    '16000000-0000-4000-8000-000000000602')
$q$,'BDF_M016_VALIDATION_PENDING');

select accounting.finalize_accounting_validation('16000000-0000-4000-8000-000000000301',
  '16000000-0000-4000-8000-000000000501','service:m016-validator','accounting.validator',
  'validation_failed','evidence:failed-cycle',repeat('6',64),'16000000-0000-4000-8000-000000000601');
select pg_temp.expect_failure('FAILED_APPROVAL',$q$
  select accounting.record_accounting_approval('16000000-0000-4000-8000-000000000301',
    '16000000-0000-4000-8000-000000000501','accounting_confirmed','approved',
    'canonical:16000000-0000-4000-8000-000000000701','accounting.checker','approved',
    'approval:failed',repeat('6',64),'16000000-0000-4000-8000-000000000601')
$q$,'BDF_M016_VALIDATION_PASS_REQUIRED');

select accounting.finalize_accounting_validation('16000000-0000-4000-8000-000000000300',
  '16000000-0000-4000-8000-000000000500','service:m016-validator','accounting.validator',
  'validation_complete','evidence:valid-cycle',repeat('5',64),'16000000-0000-4000-8000-000000000600');
select pg_temp.expect_failure('UNAUTHORIZED_ACTOR',$q$
  select accounting.record_accounting_approval('16000000-0000-4000-8000-000000000300',
    '16000000-0000-4000-8000-000000000500','accounting_confirmed','approved',
    'canonical:16000000-0000-4000-8000-000000000799','accounting.checker','approved',
    'approval:unknown','5555555555555555555555555555555555555555555555555555555555555555',
    '16000000-0000-4000-8000-000000000600')
$q$,'BDF_M016_UNAUTHORIZED_ACTOR');
select pg_temp.expect_failure('SELF_APPROVAL',$q$
  select accounting.record_accounting_approval('16000000-0000-4000-8000-000000000300',
    '16000000-0000-4000-8000-000000000500','accounting_confirmed','approved',
    'canonical:16000000-0000-4000-8000-000000000700','accounting.checker','approved',
    'approval:self',repeat('5',64),'16000000-0000-4000-8000-000000000600')
$q$,'BDF_M016_SELF_APPROVAL_FORBIDDEN');

select accounting.record_accounting_approval('16000000-0000-4000-8000-000000000300',
  '16000000-0000-4000-8000-000000000500','accounting_confirmed','approved',
  'canonical:16000000-0000-4000-8000-000000000701','accounting.checker','approved',
  'approval:valid',repeat('5',64),'16000000-0000-4000-8000-000000000600');
select pg_temp.expect_failure('DUPLICATE_APPROVAL',$q$
  select accounting.record_accounting_approval('16000000-0000-4000-8000-000000000300',
    '16000000-0000-4000-8000-000000000500','accounting_confirmed','approved',
    'canonical:16000000-0000-4000-8000-000000000701','accounting.checker','duplicate',
    'approval:duplicate',repeat('5',64),'16000000-0000-4000-8000-000000000600')
$q$,'BDF_M016_DUPLICATE_APPROVAL');
select pg_temp.expect_failure('APPROVED_CONTENT_CHANGE',$q$
  update accounting.accounting_versions set content_hash=repeat('9',64)
  where accounting_version_id='16000000-0000-4000-8000-000000000300'
$q$,'BDF_ACCOUNTING_VERSION_CONTENT_IMMUTABLE');
select pg_temp.expect_failure('DIRECT_PUBLISHED',$q$
  update accounting.accounting_versions set status='published',published_at=statement_timestamp(),
    published_by='audit:m016' where accounting_version_id='16000000-0000-4000-8000-000000000300'
$q$,'BDF_ACCOUNTING_PUBLICATION_NOT_AVAILABLE_BEFORE_M017');
select pg_temp.expect_failure('AUDIT_UPDATE',$q$
  update accounting.audit_events set reason_code='tampered'
$q$,'BDF_M016_EVIDENCE_IMMUTABLE');
select pg_temp.expect_failure('AUDIT_DELETE',$q$
  delete from accounting.audit_events
$q$,'BDF_M016_EVIDENCE_IMMUTABLE');
select pg_temp.expect_failure('APPROVAL_UPDATE',$q$
  update accounting.approvals set reason_code='tampered'
$q$,'BDF_M016_EVIDENCE_IMMUTABLE');
select pg_temp.expect_failure('INVALID_TRANSITION',$q$
  update accounting.accounting_versions set status='rejected',rejected_at=statement_timestamp(),
    rejected_by='audit:m016' where accounting_version_id='16000000-0000-4000-8000-000000000300'
$q$,'BDF_ACCOUNTING_VERSION_INVALID_TRANSITION');

do $assert$
declare n integer;
begin
  select count(*) into n from accounting.validation_results;
  if n<>36 then raise exception 'M016_VALIDATION_RESULT_COUNT %',n; end if;
  if (select status from accounting.accounting_versions where accounting_version_id='16000000-0000-4000-8000-000000000300')<>'approved'
    then raise exception 'M016_APPROVAL_LIFECYCLE_FAILED'; end if;
  if (select status from accounting.accounting_versions where accounting_version_id='16000000-0000-4000-8000-000000000301')<>'rejected'
    then raise exception 'M016_FAIL_LIFECYCLE_FAILED'; end if;
  if (select status from accounting.accounting_versions where accounting_version_id='16000000-0000-4000-8000-000000000302')<>'validating'
    then raise exception 'M016_PENDING_LIFECYCLE_FAILED'; end if;
  select count(*) into n from accounting.approvals;
  if n<>1 then raise exception 'M016_APPROVAL_COUNT %',n; end if;
  select count(*) into n from accounting.audit_events;
  if n<>40 then raise exception 'M016_AUDIT_COUNT %',n; end if;
end
$assert$;

rollback;
