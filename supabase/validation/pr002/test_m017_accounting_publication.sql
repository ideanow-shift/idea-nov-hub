-- Synthetic M017 Publication contract test. Entire fixture is rolled back.
begin;

create function pg_temp.expect_failure(p_label text,p_sql text,p_reason text)
returns void language plpgsql as $f$
begin
  begin execute p_sql;
  exception when others then
    if position(p_reason in sqlerrm)>0 then raise notice 'M017_EXPECTED %',p_label; return; end if;
    raise exception 'M017_WRONG_REJECTION % expected=% actual=%',p_label,p_reason,sqlerrm;
  end;
  raise exception 'M017_MISPASS %',p_label;
end
$f$;

insert into governance.master_source_snapshots(
  source_snapshot_id,source_system,source_environment,source_version,snapshot_version,
  source_as_of,content_digest,mapping_contract_version,masking_policy_version,
  total_record_count,approval_reference,created_by
) values (
  '17000000-0000-4000-8000-000000000001','m017-fixture','test','source-v1','snapshot-v1',
  '2026-05-01T00:00:00Z',repeat('1',64),'mapping-v1','masking-v1',3,'approval:m017','audit:m017'
);
insert into governance.canonical_entity_registry(canonical_entity_id,entity_type) values
  ('17000000-0000-4000-8000-000000000100','corporation'),
  ('17000000-0000-4000-8000-000000000700','employee'),
  ('17000000-0000-4000-8000-000000000701','employee'),
  ('17000000-0000-4000-8000-000000000702','employee');
insert into core.corporation_identities(corporation_id) values ('17000000-0000-4000-8000-000000000100');
insert into core.employee_identities(employee_id) values
  ('17000000-0000-4000-8000-000000000700'),
  ('17000000-0000-4000-8000-000000000701'),
  ('17000000-0000-4000-8000-000000000702');
insert into governance.canonical_version_registry(entity_version_id,canonical_entity_id,entity_type,source_snapshot_id)
values ('17000000-0000-4000-8000-000000000101','17000000-0000-4000-8000-000000000100',
  'corporation','17000000-0000-4000-8000-000000000001');
insert into core.corporations(
  corporation_version_id,corporation_id,corporation_code,display_name,status,effective_from,effective_to,
  source_snapshot_id,source_record_digest
) values (
  '17000000-0000-4000-8000-000000000101','17000000-0000-4000-8000-000000000100',
  'M017-CORP','M017 Corporation','active','2026-01-01','2027-01-01',
  '17000000-0000-4000-8000-000000000001',repeat('2',64)
);

insert into accounting.account_identities(account_id,created_by) values
  ('17000000-0000-4000-8000-000000000200','audit:m017'),
  ('17000000-0000-4000-8000-000000000202','audit:m017');
insert into accounting.accounts(
  account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,
  account_category,normal_balance,sign_policy,measure_type,display_order,effective_from,effective_to,
  status,source_version,mapping_contract_version,content_digest,recorded_by
) values
  ('17000000-0000-4000-8000-000000000201','17000000-0000-4000-8000-000000000200',1,
   'M017-EXP','M017 Expense','posting','pl','operating_expense','debit','debit_positive','period_flow',10,
   '2026-01-01','2027-01-01','active','account-v1','mapping-v1',repeat('3',64),'audit:m017'),
  ('17000000-0000-4000-8000-000000000203','17000000-0000-4000-8000-000000000202',1,
   'M017-REV','M017 Revenue','posting','pl','revenue','credit','credit_positive','period_flow',20,
   '2026-01-01','2027-01-01','active','account-v1','mapping-v1',repeat('4',64),'audit:m017');

insert into accounting.accounting_versions(
  accounting_version_id,corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,
  version_sequence,version_label,source_snapshot_id,parent_version_id,content_hash,created_by
) values (
  '17000000-0000-4000-8000-000000000300','17000000-0000-4000-8000-000000000100','budget','baseline',2026,
  '2026-05-01','2026-06-01',1,'M017 initial','17000000-0000-4000-8000-000000000001',null,repeat('5',64),
  'canonical:17000000-0000-4000-8000-000000000700'
);
insert into accounting.journal_entries(
  journal_entry_id,accounting_version_id,source_kind,source_system,source_reference_digest,
  source_entry_key_digest,entry_date,posting_period,evidence_digest,entry_type,recorded_by
) values ('17000000-0000-4000-8000-000000000400','17000000-0000-4000-8000-000000000300',
  'planning','m017_plan',repeat('6',64),repeat('7',64),'2026-05-31','2026-05-01',repeat('8',64),'planning','audit:m017');
insert into accounting.journal_lines(
  journal_line_id,journal_entry_id,accounting_version_id,source_system,source_record_key_digest,
  source_line_no,stable_line_key_digest,line_sequence,account_id,account_version_id,
  corporation_id,corporation_version_id,organization_scope_type,measure_type,posting_side,
  planning_contract_version,normalization_evidence_digest,recorded_by
) values
  ('17000000-0000-4000-8000-000000000410','17000000-0000-4000-8000-000000000400',
   '17000000-0000-4000-8000-000000000300','m017_plan',repeat('9',64),1,repeat('a',64),1,
   '17000000-0000-4000-8000-000000000200','17000000-0000-4000-8000-000000000201',
   '17000000-0000-4000-8000-000000000100','17000000-0000-4000-8000-000000000101',
   'corporation','period_flow','debit','planning-v1',repeat('b',64),'audit:m017'),
  ('17000000-0000-4000-8000-000000000411','17000000-0000-4000-8000-000000000400',
   '17000000-0000-4000-8000-000000000300','m017_plan',repeat('c',64),2,repeat('d',64),2,
   '17000000-0000-4000-8000-000000000202','17000000-0000-4000-8000-000000000203',
   '17000000-0000-4000-8000-000000000100','17000000-0000-4000-8000-000000000101',
   'corporation','period_flow','credit','planning-v1',repeat('e',64),'audit:m017');
insert into accounting.accounting_facts(
  accounting_fact_id,journal_line_id,journal_entry_id,accounting_version_id,corporation_id,
  organization_scope_type,accounting_period,account_id,measure_type,amount,currency_code,tax_basis,
  value_status,attribution_status,derivation_status,source_line_digest,recorded_by
) values
  ('17000000-0000-4000-8000-000000000420','17000000-0000-4000-8000-000000000410',
   '17000000-0000-4000-8000-000000000400','17000000-0000-4000-8000-000000000300',
   '17000000-0000-4000-8000-000000000100','corporation','2026-05-01',
   '17000000-0000-4000-8000-000000000200','period_flow',100,'JPY','exclusive','observed',
   'directly_attributed','planning',repeat('a',64),'audit:m017'),
  ('17000000-0000-4000-8000-000000000421','17000000-0000-4000-8000-000000000411',
   '17000000-0000-4000-8000-000000000400','17000000-0000-4000-8000-000000000300',
   '17000000-0000-4000-8000-000000000100','corporation','2026-05-01',
   '17000000-0000-4000-8000-000000000202','period_flow',-100,'JPY','exclusive','observed',
   'directly_attributed','planning',repeat('d',64),'audit:m017');

select pg_temp.expect_failure('DRAFT_PUBLISH',$q$
  select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000300',
    'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','monthly_publish',
    'evidence:draft','request:draft',repeat('5',64),null,'17000000-0000-4000-8000-000000000600')
$q$,'BDF_M017_APPROVED_VERSION_REQUIRED');

update accounting.accounting_versions set status='validating',validating_at=statement_timestamp(),
  validating_by='service:m017-validator' where accounting_version_id='17000000-0000-4000-8000-000000000300';
do $do$
declare r record;
begin
  for r in select validation_code from accounting.m016_required_validation_codes('budget') loop
    perform accounting.record_accounting_validation('17000000-0000-4000-8000-000000000300',
      '17000000-0000-4000-8000-000000000500',r.validation_code,'service:m017-validator',
      'accounting.validator','validator-v1','evidence:m017-cycle',repeat('5',64),
      '17000000-0000-4000-8000-000000000600');
  end loop;
end
$do$;
select accounting.finalize_accounting_validation('17000000-0000-4000-8000-000000000300',
  '17000000-0000-4000-8000-000000000500','service:m017-validator','accounting.validator',
  'validation_complete','evidence:m017-cycle',repeat('5',64),'17000000-0000-4000-8000-000000000600');

select pg_temp.expect_failure('VALIDATED_UNAPPROVED_PUBLISH',$q$
  select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000300',
    'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','monthly_publish',
    'evidence:unapproved','request:unapproved',repeat('5',64),null,'17000000-0000-4000-8000-000000000601')
$q$,'BDF_M017_APPROVED_VERSION_REQUIRED');

select accounting.record_accounting_approval('17000000-0000-4000-8000-000000000300',
  '17000000-0000-4000-8000-000000000500','publication_approved','approved',
  'canonical:17000000-0000-4000-8000-000000000701','accounting.checker','publication_ready',
  'approval:m017-publication',repeat('5',64),'17000000-0000-4000-8000-000000000602');
select accounting.record_accounting_approval('17000000-0000-4000-8000-000000000300',
  '17000000-0000-4000-8000-000000000500','accounting_confirmed','approved',
  'canonical:17000000-0000-4000-8000-000000000701','accounting.checker','accounting_ready',
  'approval:m017-accounting',repeat('5',64),'17000000-0000-4000-8000-000000000603');

select pg_temp.expect_failure('UNAUTHORIZED_PUBLISHER',$q$
  select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000300',
    'canonical:17000000-0000-4000-8000-000000000799','accounting.publisher','monthly_publish',
    'evidence:unauthorized','request:unauthorized',repeat('5',64),null,'17000000-0000-4000-8000-000000000604')
$q$,'BDF_M016_UNAUTHORIZED_ACTOR');
select pg_temp.expect_failure('STALE_HASH',$q$
  select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000300',
    'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','monthly_publish',
    'evidence:stale','request:stale',repeat('0',64),null,'17000000-0000-4000-8000-000000000605')
$q$,'BDF_M017_STALE_VERSION');
select pg_temp.expect_failure('INVALID_INITIAL_PRIOR',$q$
  select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000300',
    'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','monthly_publish',
    'evidence:prior','request:prior',repeat('5',64),'17000000-0000-4000-8000-000000000999',
    '17000000-0000-4000-8000-000000000606')
$q$,'BDF_M017_PRIOR_PUBLICATION_MISMATCH');

select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000300',
  'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','monthly_publish',
  'evidence:initial','request:initial',repeat('5',64),null,'17000000-0000-4000-8000-000000000607');
set constraints all immediate;
set constraints all deferred;

select pg_temp.expect_failure('DUPLICATE_VERSION_PUBLISH',$q$
  select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000300',
    'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','monthly_publish',
    'evidence:duplicate','request:duplicate',repeat('5',64),null,'17000000-0000-4000-8000-000000000608')
$q$,'BDF_M017_APPROVED_VERSION_REQUIRED');
select pg_temp.expect_failure('IDEMPOTENCY_KEY_CONFLICT',$q$
  select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000399',
    'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','monthly_publish',
    'evidence:conflict','request:initial',repeat('9',64),null,'17000000-0000-4000-8000-000000000609')
$q$,'BDF_M017_IDEMPOTENCY_KEY_CONFLICT');
select pg_temp.expect_failure('PUBLISHED_CONTENT_UPDATE',$q$
  update accounting.accounting_versions set content_hash=repeat('9',64)
  where accounting_version_id='17000000-0000-4000-8000-000000000300'
$q$,'BDF_ACCOUNTING_VERSION_CONTENT_IMMUTABLE');
select pg_temp.expect_failure('PUBLICATION_UPDATE',$q$
  update accounting.publication_releases set release_reason='tampered'
$q$,'BDF_M017_PUBLICATION_IMMUTABLE');
select pg_temp.expect_failure('PUBLICATION_DELETE',$q$
  delete from accounting.publication_members
$q$,'BDF_M017_PUBLICATION_IMMUTABLE');
select pg_temp.expect_failure('APPROVAL_MUTATION',$q$
  update accounting.approvals set reason_code='tampered'
$q$,'BDF_M016_EVIDENCE_IMMUTABLE');

-- A fully controlled higher Version supersedes the first Publication.
insert into accounting.accounting_versions(
  accounting_version_id,corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,
  version_sequence,version_label,source_snapshot_id,parent_version_id,content_hash,created_by
) values (
  '17000000-0000-4000-8000-000000000310','17000000-0000-4000-8000-000000000100','budget','revision',2026,
  '2026-05-01','2026-06-01',2,'M017 revision','17000000-0000-4000-8000-000000000001',
  '17000000-0000-4000-8000-000000000300',repeat('f',64),
  'canonical:17000000-0000-4000-8000-000000000700'
);
insert into accounting.journal_entries(
  journal_entry_id,accounting_version_id,source_kind,source_system,source_reference_digest,
  source_entry_key_digest,entry_date,posting_period,evidence_digest,entry_type,recorded_by
) values ('17000000-0000-4000-8000-000000000430','17000000-0000-4000-8000-000000000310',
  'planning','m017_revision',repeat('1',64),repeat('2',64),'2026-05-31','2026-05-01',
  repeat('3',64),'planning','audit:m017');
insert into accounting.journal_lines(
  journal_line_id,journal_entry_id,accounting_version_id,source_system,source_record_key_digest,
  source_line_no,stable_line_key_digest,line_sequence,account_id,account_version_id,
  corporation_id,corporation_version_id,organization_scope_type,measure_type,posting_side,
  planning_contract_version,normalization_evidence_digest,recorded_by
) values
  ('17000000-0000-4000-8000-000000000431','17000000-0000-4000-8000-000000000430',
   '17000000-0000-4000-8000-000000000310','m017_revision',repeat('4',64),1,repeat('5',64),1,
   '17000000-0000-4000-8000-000000000200','17000000-0000-4000-8000-000000000201',
   '17000000-0000-4000-8000-000000000100','17000000-0000-4000-8000-000000000101',
   'corporation','period_flow','debit','planning-v2',repeat('6',64),'audit:m017'),
  ('17000000-0000-4000-8000-000000000432','17000000-0000-4000-8000-000000000430',
   '17000000-0000-4000-8000-000000000310','m017_revision',repeat('7',64),2,repeat('8',64),2,
   '17000000-0000-4000-8000-000000000202','17000000-0000-4000-8000-000000000203',
   '17000000-0000-4000-8000-000000000100','17000000-0000-4000-8000-000000000101',
   'corporation','period_flow','credit','planning-v2',repeat('9',64),'audit:m017');
insert into accounting.accounting_facts(
  accounting_fact_id,journal_line_id,journal_entry_id,accounting_version_id,corporation_id,
  organization_scope_type,accounting_period,account_id,measure_type,amount,currency_code,tax_basis,
  value_status,attribution_status,derivation_status,source_line_digest,recorded_by
) values
  ('17000000-0000-4000-8000-000000000433','17000000-0000-4000-8000-000000000431',
   '17000000-0000-4000-8000-000000000430','17000000-0000-4000-8000-000000000310',
   '17000000-0000-4000-8000-000000000100','corporation','2026-05-01',
   '17000000-0000-4000-8000-000000000200','period_flow',110,'JPY','exclusive','observed',
   'directly_attributed','planning',repeat('5',64),'audit:m017'),
  ('17000000-0000-4000-8000-000000000434','17000000-0000-4000-8000-000000000432',
   '17000000-0000-4000-8000-000000000430','17000000-0000-4000-8000-000000000310',
   '17000000-0000-4000-8000-000000000100','corporation','2026-05-01',
   '17000000-0000-4000-8000-000000000202','period_flow',-110,'JPY','exclusive','observed',
   'directly_attributed','planning',repeat('8',64),'audit:m017');
update accounting.accounting_versions set status='validating',validating_at=statement_timestamp(),
  validating_by='service:m017-validator' where accounting_version_id='17000000-0000-4000-8000-000000000310';
do $do$
declare r record;
begin
  for r in select validation_code from accounting.m016_required_validation_codes('budget') loop
    perform accounting.record_accounting_validation('17000000-0000-4000-8000-000000000310',
      '17000000-0000-4000-8000-000000000510',r.validation_code,'service:m017-validator',
      'accounting.validator','validator-v1','evidence:m017-revision',repeat('f',64),
      '17000000-0000-4000-8000-000000000610');
  end loop;
end
$do$;
select accounting.finalize_accounting_validation('17000000-0000-4000-8000-000000000310',
  '17000000-0000-4000-8000-000000000510','service:m017-validator','accounting.validator',
  'validation_complete','evidence:m017-revision',repeat('f',64),'17000000-0000-4000-8000-000000000610');
select accounting.record_accounting_approval('17000000-0000-4000-8000-000000000310',
  '17000000-0000-4000-8000-000000000510','publication_approved','approved',
  'canonical:17000000-0000-4000-8000-000000000701','accounting.checker','publication_ready',
  'approval:m017-revision-publication',repeat('f',64),'17000000-0000-4000-8000-000000000611');
select accounting.record_accounting_approval('17000000-0000-4000-8000-000000000310',
  '17000000-0000-4000-8000-000000000510','accounting_confirmed','approved',
  'canonical:17000000-0000-4000-8000-000000000701','accounting.checker','accounting_ready',
  'approval:m017-revision-accounting',repeat('f',64),'17000000-0000-4000-8000-000000000612');
select pg_temp.expect_failure('INVALID_SUPERSEDE',$q$
  select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000310',
    'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','revision_publish',
    'evidence:revision','request:revision-wrong',repeat('f',64),null,
    '17000000-0000-4000-8000-000000000613')
$q$,'BDF_M017_PRIOR_PUBLICATION_MISMATCH');
select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000310',
  'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','revision_publish',
  'evidence:revision','request:revision',repeat('f',64),
  (select publication_id from accounting.publication_releases where request_key='request:initial'),
  '17000000-0000-4000-8000-000000000614');
set constraints all immediate;
set constraints all deferred;

insert into accounting.accounting_versions(
  accounting_version_id,corporation_id,scenario_type,version_type,fiscal_year,period_start,period_end,
  version_sequence,version_label,source_snapshot_id,parent_version_id,content_hash,created_by
) values
  ('17000000-0000-4000-8000-000000000320','17000000-0000-4000-8000-000000000100','budget','revision',2026,
   '2026-05-01','2026-06-01',3,'M017 rejected','17000000-0000-4000-8000-000000000001',
   '17000000-0000-4000-8000-000000000310',repeat('a',64),'audit:m017-maker'),
  ('17000000-0000-4000-8000-000000000321','17000000-0000-4000-8000-000000000100','budget','revision',2026,
   '2026-05-01','2026-06-01',4,'M017 pending','17000000-0000-4000-8000-000000000001',
   '17000000-0000-4000-8000-000000000320',repeat('b',64),'audit:m017-maker');
update accounting.accounting_versions set status='validating',validating_at=statement_timestamp(),
  validating_by='service:m017-validator'
where accounting_version_id in (
  '17000000-0000-4000-8000-000000000320','17000000-0000-4000-8000-000000000321'
);
insert into accounting.validation_results(
  accounting_version_id,validation_cycle_id,validation_code,severity,result_status,expected_value,
  actual_value,evidence_reference,checked_by,checker_role,validator_version,version_content_hash,
  is_blocking,correlation_id
) values (
  '17000000-0000-4000-8000-000000000320','17000000-0000-4000-8000-000000000520',
  'journal_completeness','critical','fail','0','1','evidence:rejected',
  'service:m017-validator','accounting.validator','validator-v1',repeat('a',64),true,
  '17000000-0000-4000-8000-000000000620'
);
update accounting.accounting_versions set status='rejected',rejected_at=statement_timestamp(),
  rejected_by='service:m017-validator'
where accounting_version_id='17000000-0000-4000-8000-000000000320';
select pg_temp.expect_failure('REJECTED_PUBLISH',$q$
  select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000320',
    'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','rejected_publish',
    'evidence:rejected','request:rejected',repeat('a',64),null,
    '17000000-0000-4000-8000-000000000621')
$q$,'BDF_M017_APPROVED_VERSION_REQUIRED');
select pg_temp.expect_failure('PENDING_VALIDATION_PUBLISH',$q$
  select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000321',
    'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','pending_publish',
    'evidence:pending','request:pending',repeat('b',64),null,
    '17000000-0000-4000-8000-000000000622')
$q$,'BDF_M017_APPROVED_VERSION_REQUIRED');

insert into accounting.comparison_rules(
  comparison_rule_id,rule_code,rule_version,period_shift_months,comparison_scenario,
  selection_policy,corporation_continuity,store_continuity,account_mapping_version,
  effective_from,effective_to,status,evidence_reference,recorded_by
) values (
  '17000000-0000-4000-8000-000000000800','prior_year_actual',1,-12,'actual',
  'published_accounting_confirmed','same_canonical','mapping_required','mapping-v1',
  '2026-01-01',null,'active','approval:comparison-v1','audit:m017'
);
select pg_temp.expect_failure('PREVIOUS_YEAR_SCENARIO',$q$
  insert into accounting.comparison_rules(
    rule_code,rule_version,period_shift_months,comparison_scenario,selection_policy,
    corporation_continuity,store_continuity,account_mapping_version,effective_from,status,
    evidence_reference,recorded_by
  ) values ('bad_previous_year',1,-12,'previous_year','published_accounting_confirmed',
    'same_canonical','not_applicable','mapping-v1','2026-01-01','draft','evidence:bad','audit:m017')
$q$,'accounting_comparison_rules_scenario_check');
select pg_temp.expect_failure('COMPARISON_UPDATE',$q$
  update accounting.comparison_rules set status='retired'
$q$,'BDF_M017_PUBLICATION_IMMUTABLE');

do $assert$
declare n integer; p uuid; p2 uuid;
begin
  select publication_id into p from accounting.publication_releases where request_key='request:initial';
  select accounting.publish_accounting_version('17000000-0000-4000-8000-000000000300',
    'canonical:17000000-0000-4000-8000-000000000702','accounting.publisher','monthly_publish',
    'evidence:initial','request:initial',repeat('5',64),null,'17000000-0000-4000-8000-000000000607') into p2;
  if p is distinct from p2 then raise exception 'M017_IDEMPOTENT_RETRY_FAILED'; end if;
  select count(*) into n from accounting.publication_releases;
  if n<>2 then raise exception 'M017_RELEASE_COUNT %',n; end if;
  select count(*) into n from accounting.publication_members;
  if n<>2 then raise exception 'M017_MEMBER_COUNT %',n; end if;
  if (select status from accounting.accounting_versions
      where accounting_version_id='17000000-0000-4000-8000-000000000300')<>'superseded'
    then raise exception 'M017_PRIOR_VERSION_NOT_SUPERSEDED'; end if;
  if (select status from accounting.accounting_versions
      where accounting_version_id='17000000-0000-4000-8000-000000000310')<>'published'
    then raise exception 'M017_CURRENT_VERSION_NOT_PUBLISHED'; end if;
  if (select count(*) from accounting.audit_events where publication_id is not null)<>5
    then raise exception 'M017_PUBLICATION_AUDIT_COUNT'; end if;
  if has_table_privilege('anon','accounting.publication_releases','select')
    or has_table_privilege('authenticated','accounting.publication_members','select')
    or has_table_privilege('service_role','accounting.publication_releases','insert')
    then raise exception 'M017_CONSUMER_DIRECT_ACCESS'; end if;
end
$assert$;

rollback;
