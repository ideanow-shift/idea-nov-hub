import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const migrationPath='supabase/migrations/20260808101153_m016_bdf_accounting_validation_approval_audit.sql';
const rollbackPath='supabase/rollback/pr002/m016_bdf_accounting_validation_approval_audit.rollback.sql';

test('M016 scope is exactly Validation Approval Audit',async()=>{
  const sql=await read(migrationPath);
  const tables=[...sql.matchAll(/create table accounting\.([a-z_]+)/gi)].map(x=>x[1]);
  assert.deepEqual(tables,['validation_results','approvals','audit_events']);
  assert.doesNotMatch(sql,/create (?:table|view) (?:accounting|projection)\.(?:publication|consumer|cash_flow)/i);
});

test('M016 validation matrix separates Actual and planning',async()=>{
  const sql=await read(migrationPath);
  for(const code of ['journal_completeness','debit_credit_integrity','account_validity',
    'organization_scope_validity','period_validity','measure_type_integrity',
    'allocation_completeness','unallocated_state','duplicate_prevention','source_lineage',
    'fact_completeness','actual_source_completeness','tax_rounding_evidence',
    'planning_contract_completeness']) assert.match(sql,new RegExp(`'${code}'`));
  assert.match(sql,/p_scenario in \('budget','forecast'\)/i);
  assert.doesNotMatch(sql,/previous[_ ]year/i);
});

test('M016 PASS is derived and evidence is fail closed',async()=>{
  const sql=await read(migrationPath);
  assert.match(sql,/m016_validation_violation_count/i);
  assert.match(sql,/result_status in \('pass','fail','pending'\)/i);
  assert.match(sql,/result_status = 'pass' and actual_value is not null and actual_value = expected_value/i);
  assert.match(sql,/BDF_M016_VALIDATION_INCOMPLETE/);
  assert.match(sql,/BDF_M016_VALIDATION_PENDING/);
  assert.match(sql,/BDF_M016_STALE_VERSION/);
});

test('M016 one-stage checker contract prevents self approval',async()=>{
  const sql=await read(migrationPath);
  assert.match(sql,/p_actor=v\.created_by or p_actor=v\.validated_by/i);
  assert.match(sql,/BDF_M016_SELF_APPROVAL_FORBIDDEN/);
  assert.match(sql,/core\.employee_identities/i);
  assert.match(sql,/p_approval_type='accounting_confirmed'/i);
  assert.match(sql,/BDF_M016_DUPLICATE_APPROVAL/);
});

test('M016 lifecycle ends at approved and publication stays closed',async()=>{
  const sql=await read(migrationPath);
  assert.match(sql,/old\.status='validating' and new\.status='validated'/i);
  assert.match(sql,/old\.status='validating' and new\.status='rejected'/i);
  assert.match(sql,/old\.status='validated' and new\.status='approved'/i);
  assert.match(sql,/BDF_ACCOUNTING_PUBLICATION_NOT_AVAILABLE_BEFORE_M017/);
});

test('M016 evidence and audit are append only',async()=>{
  const sql=await read(migrationPath);
  assert.equal((sql.match(/before update or delete on accounting\.(?:validation_results|approvals|audit_events)/gi)||[]).length,3);
  assert.match(sql,/BDF_M016_EVIDENCE_IMMUTABLE/);
  for(const action of ['validation_result_recorded','validation_passed','validation_failed','approval_recorded','version_approved'])
    assert.match(sql,new RegExp(`'${action}'`));
});

test('M016 security is default deny',async()=>{
  const sql=await read(migrationPath);
  assert.equal((sql.match(/enable row level security/gi)||[]).length,3);
  assert.equal((sql.match(/force row level security/gi)||[]).length,3);
  assert.equal((sql.match(/revoke all on accounting\.(?:validation_results|approvals|audit_events)/gi)||[]).length,3);
  assert.doesNotMatch(sql,/security definer/i);
  assert.doesNotMatch(sql,/grant\s+/i);
  assert.doesNotMatch(sql,/\bproduction\./i);
});

test('M016 rollback is exact and non-CASCADE',async()=>{
  const sql=await read(rollbackPath);
  assert.doesNotMatch(sql,/cascade/i);
  assert.match(sql,/drop table accounting\.audit_events/);
  assert.match(sql,/drop table accounting\.approvals/);
  assert.match(sql,/drop table accounting\.validation_results/);
  assert.match(sql,/BDF_ACCOUNTING_VALIDATION_NOT_AVAILABLE_BEFORE_M016/);
  assert.doesNotMatch(sql,/drop table accounting\.(?:journal|accounting_facts|import_|accounting_versions)/i);
});

test('M016 validation fixes catalog and future-scope boundaries',async()=>{
  const sql=await read('supabase/validation/pr002/validate_m016.sql');
  assert.match(sql,/BDF_M016_TABLE_COUNT/);
  assert.match(sql,/BDF_M016_FUNCTION_SECURITY_COUNT/);
  assert.match(sql,/BDF_M016_TRIGGER_BINDING_COUNT/);
  assert.match(sql,/BDF_M016_FORBIDDEN_TABLE_GRANT/);
  assert.match(sql,/BDF_M016_FUTURE_SCOPE_OBJECT/);
});
