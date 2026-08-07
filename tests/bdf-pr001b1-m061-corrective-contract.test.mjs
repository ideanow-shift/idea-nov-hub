import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const forward = await readFile(path.join(root, 'supabase/migrations/20260807112029_m061_bdf_snapshot_contract_versions_nonblank.sql'), 'utf8');
const rollback = await readFile(path.join(root, 'supabase/rollback/pr001b1/m061_bdf_snapshot_contract_versions_nonblank.rollback.sql'), 'utf8');
const validation = await readFile(path.join(root, 'supabase/validation/pr001b1/validate_m061.sql'), 'utf8');
const dbTest = await readFile(path.join(root, 'supabase/validation/pr001b1/test_m061_nonblank_gate.sql'), 'utf8');

test('M061 adds exact nonblank constraints without changing M011', () => {
  assert.match(forward, /master_source_snapshots_mapping_contract_version_nonblank/);
  assert.match(forward, /master_source_snapshots_masking_policy_version_nonblank/);
  assert.equal((forward.match(/btrim\([^)]+\) <> ''/g) ?? []).length, 2);
  assert.doesNotMatch(forward, /drop constraint|alter migration|migration history/i);
});

test('preflight stops on existing violations and never repairs data', () => {
  assert.match(forward, /BDF_M061_EXISTING_BLANK_CONTRACT_VERSION/);
  assert.match(forward, /BDF_M061_EXISTING_VALIDATION_TRUTH_MISMATCH/);
  assert.doesNotMatch(forward, /\bupdate\b|\bdelete\b/i);
});

test('passed validation evidence must equal expected evidence', () => {
  assert.match(forward, /snapshot_validation_results_status_value_consistency/);
  assert.match(forward, /\(validation_status = 'passed'\) = \(expected_value = actual_value\)/);
});

test('validation fixes exact schema, table, column constraints', () => {
  for (const name of [
    'master_source_snapshots_mapping_contract_version_nonblank',
    'master_source_snapshots_masking_policy_version_nonblank',
    'snapshot_validation_results_status_value_consistency',
  ]) assert.match(validation, new RegExp(name));
  assert.match(validation, /n\.nspname = 'governance'/);
  assert.match(validation, /t\.relname = 'master_source_snapshots'/);
});

test('DB test covers blank, whitespace, valid versions, and mismatch evidence', () => {
  for (const label of [
    'mapping_empty', 'mapping_whitespace', 'masking_empty', 'masking_whitespace',
    'hash_passed_mismatch', 'mapping_passed_mismatch', 'masking_passed_mismatch',
  ]) assert.match(dbTest, new RegExp(label));
  assert.match(dbTest, /'mapping-v1','masking-v1'/);
  assert.match(dbTest, /record_count_mismatch/);
  assert.match(dbTest, /BDF_SNAPSHOT_TOTAL_RECORD_COUNT_MISMATCH/);
  assert.match(dbTest, /rollback;/i);
});

test('rollback is M061-only and has no CASCADE', () => {
  assert.match(rollback, /drop constraint master_source_snapshots_mapping_contract_version_nonblank/);
  assert.match(rollback, /drop constraint master_source_snapshots_masking_policy_version_nonblank/);
  assert.match(rollback, /drop constraint snapshot_validation_results_status_value_consistency/);
  assert.doesNotMatch(rollback, /\bcascade\b|drop table|drop column/i);
});
