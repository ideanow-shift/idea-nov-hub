import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const forward = read('supabase/migrations/20260807211422_m062_bdf_account_hierarchy_cycle_guard.sql');
const rollback = read('supabase/rollback/pr002/m062_bdf_account_hierarchy_cycle_guard.rollback.sql');
const validation = read('supabase/validation/pr002/validate_m062.sql');
const dbTest = read('supabase/validation/pr002/test_m062_account_hierarchy_cycle.sql');

test('M062 virtualizes NEW and propagates effective-period intersections', () => {
  assert.match(forward, /union all[\s\S]*select p_account_id, p_parent_account_id, p_effective_period/i);
  assert.match(forward, /w\.common_period \* e\.effective_period/);
  assert.match(forward, /e\.effective_period && w\.common_period/);
});
test('M062 serializes writes and revalidates at commit', () => {
  assert.match(forward, /pg_advisory_xact_lock\(13013, 62\)/);
  assert.match(forward, /constraint trigger revalidate_account_hierarchy_deferred/i);
  assert.match(forward, /deferrable initially deferred/i);
});
test('M062 changes no table, RLS, grant, or M013 migration', () => {
  assert.doesNotMatch(forward, /\b(create|alter|drop)\s+table\b/i);
  assert.doesNotMatch(forward, /\b(enable|disable|force|no force)\s+row level security\b/i);
  assert.doesNotMatch(forward, /\bgrant\b/i);
});
test('validation fixes the function and trigger fail closed', () => {
  for (const code of ['BDF_M062_INSERT_GUARD_NOT_CORRECTED','BDF_M062_GRAPH_FUNCTION_MISSING',
    'BDF_M062_DEFERRED_TRIGGER_MISSING','BDF_M062_M013_TABLE_DRIFT','BDF_M062_FORBIDDEN_FUNCTION_GRANT'])
    assert.match(validation, new RegExp(code));
});
test('DB contract covers required cycle, boundary, mapping, and immutability cases', () => {
  for (const marker of ['SELF_CYCLE','TWO_NODE_CYCLE','THREE_NODE_CYCLE','NEW_ROW_BOUNDARY_CYCLE',
    'NON_OVERLAPPING_HISTORY_ALLOWED','PARENT_PERIOD_MISMATCH','MAPPING_PERIOD_MISMATCH',
    'ACCOUNT_OVERLAP','ACCOUNT_CODE_OVERLAP','STATEMENT_TYPE_MISMATCH','DUPLICATE_MAPPING',
    'CASH_FLOW_MAPPING','INVALID_DISPLAY_ORDER','IMMUTABLE_UPDATE','IMMUTABLE_DELETE'])
    assert.match(dbTest, new RegExp(marker));
});
test('rollback is corrective-only and CASCADE-free', () => {
  assert.doesNotMatch(rollback, /cascade/i);
  assert.doesNotMatch(rollback, /drop table/i);
  assert.match(rollback, /create or replace function accounting\.validate_account_version_insert/);
});
