import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const m=read('supabase/migrations/20260807225540_m015_bdf_journal_accounting_fact_allocation.sql');
const r=read('supabase/rollback/pr002/m015_bdf_journal_accounting_fact_allocation.rollback.sql');
const v=read('supabase/validation/pr002/validate_m015.sql');
const d=read('supabase/validation/pr002/test_m015_journal_accounting_fact_allocation.sql');

test('M015 owns six Journal Fact and Allocation tables only',()=>{
  for(const t of ['journal_entries','journal_lines','accounting_facts','allocation_rule_versions','allocation_sets','accounting_allocations'])
    assert.match(m,new RegExp(`create table accounting\\.${t}`));
  assert.doesNotMatch(m,/create table accounting\.(validation_results|approvals|audit_events|publication|cash_flow_facts)/i);
});
test('Journal and line idempotency never use amount',()=>{
  assert.match(m,/accounting_journal_entries_version_source_unique/);
  assert.match(m,/accounting_journal_lines_import_stable_unique/);
  assert.match(m,/source_record_key_digest[\s\S]*source_line_no[\s\S]*accounting_version_id[\s\S]*account_id[\s\S]*measure_type/);
  const identitySql=[
    m.match(/constraint accounting_journal_entries_version_source_unique[\s\S]*?\);/i)?.[0]??'',
    m.match(/create unique index accounting_journal_lines_import_stable_unique[\s\S]*?;/i)?.[0]??'',
    m.match(/create unique index accounting_journal_lines_planning_stable_unique[\s\S]*?;/i)?.[0]??''
  ].join('\n');
  assert.doesNotMatch(identitySql,/amount/i);
});
test('Actual source route is validated M012 lineage',()=>{
  for(const x of ['validation_status = \'valid\'','normalization_status = \'passed\'','mapping_status = \'passed\'','tax_basis = \'exclusive\'','b.status = \'validated\'']) assert.match(m,new RegExp(x));
  assert.match(m,/BDF_JOURNAL_ACTUAL_IMPORT_REQUIRED/);
  assert.match(m,/s\.normalized_amount is null or s\.normalized_amount not in/);
  assert.match(m,/guard_import_membership_seal_m015/);
  for(const x of ['a_m015_lock_import_batch_membership','a_m015_seal_import_files','a_m015_seal_import_staging_lines','BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED']) assert.match(m,new RegExp(x));
});
test('Fact is one-to-one tax-exclusive Canonical truth',()=>{
  assert.match(m,/journal_line_id uuid not null unique/);
  assert.match(m,/tax_basis = 'exclusive'/);
  assert.match(m,/currency_code = 'JPY'/);
  assert.match(m,/value_status in \('observed', 'zero', 'not_applicable'\)/);
  assert.match(m,/attribution_status = 'directly_attributed'[\s\S]*organization_scope_type in \('corporation', 'store', 'department'\)/);
  assert.match(m,/planning_contract_version is not null/);
  assert.match(m,/accounting_facts_amount_finite/);
  assert.match(m,/'NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric/);
  assert.doesNotMatch(m,/default 0/i);
});
test('Account Measure and full-period Organization pins are fail closed',()=>{
  assert.match(m,/account_version_matches_period/);
  assert.match(m,/organization_scope_is_valid/);
  assert.match(m,/effective_to >= p_period_end/);
  assert.match(m,/relationship_type = 'accounting'/);
  assert.match(m,/account_category not in \('gross_profit', 'operating_profit'\)/);
  assert.match(m,/BDF_JOURNAL_LINE_ACCOUNT_MEASURE_MISMATCH/);
  for(const x of [
    'accounting_journal_lines_account_version_idx','accounting_journal_lines_corporation_version_idx',
    'accounting_journal_lines_store_version_idx','accounting_journal_lines_department_version_idx',
    'accounting_allocations_target_corporation_version_idx','accounting_allocations_target_store_version_idx',
    'accounting_allocations_target_department_version_idx'
  ]) assert.match(m,new RegExp(x));
});
test('Allocation preserves source Fact and balances explicitly',()=>{
  assert.match(m,/source_fact_id uuid not null/);
  assert.match(m,/attribution_status = 'unallocated'/);
  assert.match(m,/amount_total <> new\.allocable_amount/);
  assert.match(m,/BDF_ACCOUNTING_ALLOCATION_OVERAGE/);
  assert.match(m,/allocation_ratio is not null/);
  assert.match(m,/BDF_ACCOUNTING_ALLOCATION_RULE_SCOPE_MISMATCH/);
  assert.match(m,/derived_v\.accounting_version_id = source_v\.accounting_version_id/);
  assert.match(m,/pg_advisory_xact_lock/);
  assert.match(m,/accounting_allocation_sets_amount_finite/);
  assert.match(m,/accounting_allocations_amount_finite/);
});
test('immutable append-only contract covers ledger and allocation',()=>{
  for(const x of ['BDF_ACCOUNTING_LEDGER_IMMUTABLE','BDF_ALLOCATION_RULE_IMMUTABLE','BDF_ALLOCATION_SET_CONTENT_IMMUTABLE','BDF_ACCOUNTING_ALLOCATION_IMMUTABLE']) assert.match(m,new RegExp(x));
});
test('all six tables use forced RLS and zero direct grants',()=>{
  assert.equal((m.match(/enable row level security/g)||[]).length,6);
  assert.equal((m.match(/force row level security/g)||[]).length,6);
  assert.equal((m.match(/revoke all on accounting\.(journal_entries|journal_lines|accounting_facts|allocation_rule_versions|allocation_sets|accounting_allocations)/g)||[]).length,6);
  assert.doesNotMatch(m,/security definer/i);
});
test('validation is fail closed for catalog security and future scope',()=>{
  for(const x of ['BDF_M015_TABLE_COUNT','BDF_M015_DUPLICATE_CONTRACT','BDF_M015_FACT_CONTRACT','BDF_M015_VERSION_FK_INDEX_COUNT','BDF_M015_ALLOCATION_RECONCILIATION_GUARD','BDF_M015_TRIGGER_BINDING_COUNT','BDF_M015_IMPORT_MEMBERSHIP_SEAL_GUARD','BDF_M015_IMPORT_SEAL_TRIGGER_BINDING_COUNT','BDF_M015_SECURITY_INVOKER_FUNCTIONS','BDF_M015_RLS_FORCE_COUNT','BDF_M015_FORBIDDEN_GRANTS','BDF_M015_FORBIDDEN_FUNCTION_GRANT','BDF_M015_FUTURE_SCOPE_LEAK']) assert.match(v,new RegExp(x));
  for(const x of ['accounting_facts_amount_finite','accounting_allocation_sets_amount_finite','accounting_allocations_amount_finite','guard_import_membership_seal_m015']) assert.match(v,new RegExp(x));
});
test('DB negative suite fixes every Owner minimum failure contract',()=>{
  for(const x of [
    'ORPHAN_VERSION','ORPHAN_ACCOUNT','PERIOD_MISMATCH','ACCOUNT_MEASURE_MISMATCH',
    'INVALID_ORGANIZATION_SCOPE','DUPLICATE_JOURNAL','DUPLICATE_STABLE_LINE',
    'ACTUAL_VERSION_BATCH_NOT_VALIDATED','ACTUAL_BATCH_NOT_VALIDATED',
    'TAX_NORMALIZATION_INCOMPLETE','ACTUAL_NAN_NORMALIZED_AMOUNT','JOURNAL_FACT_MISMATCH','PLANNING_CONTRACT_MISSING',
    'LATE_FILE_AFTER_BATCH_VALIDATION','LATE_LINE_AFTER_BATCH_VALIDATION',
    'MUTATE_LINE_AFTER_BATCH_VALIDATION','MOVE_LINE_FROM_VALIDATED_BATCH',
    'CALCULATED_SUBTOTAL_ACCOUNT','ACCOUNT_PERIOD_NOT_CONTAINED','INACTIVE_ORGANIZATION_SCOPE',
    'ORGANIZATION_SCOPE_PERIOD_NOT_CONTAINED','POSTING_SIDE_NULL_MISMATCH','FACT_NAN_REJECTED',
    'ZERO_UNALLOCATED_FACT_REJECTED',
    'ALLOCATION_RULE_SOURCE_SCOPE_MISMATCH','ALLOCATION_RULE_TARGET_SCOPE_MISMATCH',
    'ALLOCATION_RATIO_NULL','DIRECT_CORPORATION_FACT_NOT_ALLOCABLE',
    'ALLOCATION_SET_ALLOCABLE_NAN_REJECTED','ALLOCATION_SET_ZERO_REJECTED','ALLOCATION_SET_ROUNDING_NAN_REJECTED',
    'ALLOCATION_RATIO_NAN_REJECTED','ALLOCATION_AMOUNT_NAN_REJECTED','ALLOCATION_ROUNDING_NAN_REJECTED',
    'ALLOCATION_OVERAGE','ALLOCATION_SHORTAGE_FINAL','ALLOCATION_ROUNDING_TOTAL_MISMATCH','FACT_UPDATE_IMMUTABLE',
    'FACT_DELETE_IMMUTABLE','JOURNAL_LINE_UPDATE_IMMUTABLE','JOURNAL_DELETE_IMMUTABLE',
    'ALLOCATION_DELETE_IMMUTABLE'
  ]) assert.match(d,new RegExp(`'${x}'`));
});
test('rollback is M015-only and non-cascading',()=>{
  assert.doesNotMatch(r,/cascade/i);
  for(const x of ['a_m015_lock_import_batch_membership','a_m015_seal_import_files','a_m015_seal_import_staging_lines','guard_import_membership_seal_m015']) assert.match(r,new RegExp(x));
  for(const t of ['accounting_allocations','allocation_sets','allocation_rule_versions','accounting_facts','journal_lines','journal_entries']) assert.match(r,new RegExp(`drop table accounting\\.${t}`));
  assert.doesNotMatch(r,/drop table accounting\.(accounting_versions|accounts|import_batches)/);
});
