import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const forward=read('supabase/migrations/20260808085452_m063_bdf_import_batch_local_concurrency.sql');
const rollback=read('supabase/rollback/pr002/m063_bdf_import_batch_local_concurrency.rollback.sql');
const validation=read('supabase/validation/pr002/validate_m063.sql');
const dbTest=read('supabase/validation/pr002/test_m063_import_batch_local_concurrency.sql');
const amendment=read('docs/architecture/33_migration_program_v1_1c_m063_corrective_amendment.md');
const design=read('docs/architecture/34_pr002_m063_import_batch_local_concurrency_design_package.md');
const gate=read('docs/architecture/35_pr002_m063_import_batch_local_concurrency_release_gate.md');

test('M063 is collision-free and preserves every reservation',()=>{
  assert.match(amendment,/M015 -> M063 -> M016/);
  assert.match(amendment,/M016–M019/);
  assert.match(amendment,/M020–M060/);
});
test('M063 uses deterministic Batch-row locking and no global table lock',()=>{
  assert.match(forward,/order by b\.import_batch_id[\s\S]*for update/i);
  assert.doesNotMatch(forward,/lock table/i);
  assert.match(design,/Batch row\(s\), ascending UUID -> File\/Staging Line row operation/);
});
test('M063 rebinds all seal triggers and adds deferred revalidation',()=>{
  for(const marker of ['a_m015_lock_import_batch_membership','a_m015_seal_import_files',
    'a_m015_seal_import_staging_lines','constraint trigger revalidate_import_batch_membership_m063',
    'deferrable initially deferred']) assert.match(forward,new RegExp(marker,'i'));
});
test('M063 commit-time check retains the complete M012 membership contract',()=>{
  for(const marker of ['f.validation_status <> \'validated\'','s.validation_status not in',
    "s.validation_status = 'valid'",'f.row_count','BDF_ACCOUNTING_IMPORT_BATCH_VALIDATION_INCOMPLETE'])
    assert.match(forward,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});
test('M063 functions are least privilege',()=>{
  assert.equal((forward.match(/security invoker/gi)||[]).length,2);
  assert.equal((forward.match(/set search_path = ''/gi)||[]).length,2);
  assert.match(forward,/revoke execute[\s\S]*public, anon, authenticated, service_role/i);
  assert.doesNotMatch(forward,/security definer/i);
});
test('M063 validation fixes active bindings, no global guard, and no future scope',()=>{
  for(const code of ['BDF_M063_BATCH_LOCAL_GUARD_INVALID','BDF_M063_DEFERRED_REVALIDATION_INVALID',
    'BDF_M063_ACTIVE_TRIGGER_BINDING_COUNT','BDF_M063_DEFERRED_TRIGGER_MISSING',
    'BDF_M063_GLOBAL_GUARD_STILL_BOUND','BDF_M063_SECURITY_INVOKER_FUNCTIONS',
    'BDF_M063_FORBIDDEN_FUNCTION_GRANT','BDF_M063_M015_TABLE_DRIFT','BDF_M063_FUTURE_SCOPE_LEAK'])
    assert.match(validation,new RegExp(code));
});
test('M063 DB fixture retains terminal membership sealing',()=>{
  assert.match(dbTest,/TERMINAL_FILE_INSERT/);
  assert.match(dbTest,/TERMINAL_LINE_DELETE/);
  assert.match(dbTest,/set constraints accounting\.revalidate_import_batch_membership_m063 immediate/i);
  assert.match(dbTest,/rollback;/i);
});
test('M063-only rollback restores M015 exactly and is CASCADE-free',()=>{
  assert.doesNotMatch(rollback,/cascade/i);
  assert.doesNotMatch(rollback,/drop table/i);
  assert.match(rollback,/guard_import_membership_seal_m015/);
  assert.match(rollback,/drop function accounting\.guard_import_membership_seal_m063/);
  assert.match(gate,/M015 Negative 60\/60/);
});
