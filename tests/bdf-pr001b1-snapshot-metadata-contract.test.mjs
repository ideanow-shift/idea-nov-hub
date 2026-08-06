import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const migrationPath = path.join(
  root,
  'supabase/migrations/20260806201417_m011_bdf_snapshot_metadata_foundation.sql',
);
const rollbackPath = path.join(
  root,
  'supabase/rollback/pr001b1/m011_bdf_snapshot_metadata_foundation.rollback.sql',
);
const validationPath = path.join(
  root,
  'supabase/validation/pr001b1/validate_pr001b1.sql',
);
const baseSnapshotPath = path.join(
  root,
  'supabase/migrations/20260806090908_m002_bdf_source_identity_envelope.sql',
);

const migration = await readFile(migrationPath, 'utf8');
const rollback = await readFile(rollbackPath, 'utf8');
const validation = await readFile(validationPath, 'utf8');
const baseSnapshot = await readFile(baseSnapshotPath, 'utf8');

const requiredMasters = [
  'corporations',
  'stores',
  'departments',
  'employees',
  'employee_store_assignments',
];

test('required Snapshot header metadata is physical and constrained', () => {
  for (const column of ['total_record_count', 'approval_reference', 'created_by']) {
    assert.match(migration, new RegExp(`add column ${column} `));
  }
  assert.match(migration, /total_record_count bigint not null/);
  assert.match(migration, /total_record_count >= 0/);
  assert.match(baseSnapshot, /content_digest text not null/);
  assert.match(baseSnapshot, /mapping_contract_version text not null/);
  assert.match(baseSnapshot, /masking_policy_version text not null/);
});

test('five and only five Master types are accepted by manifest and validation', () => {
  for (const master of requiredMasters) {
    const occurrences = migration.match(new RegExp(`'${master}'`, 'g')) ?? [];
    assert.ok(occurrences.length >= 2, `${master} must exist in both contracts`);
  }
  assert.match(migration, /manifest_count <> 5/);
  assert.match(migration, /passed_validation_count <> 25/);
});

test('Snapshot and child facts are immutable', () => {
  assert.match(migration, /reject_snapshot_master_manifest_mutation/);
  assert.match(migration, /reject_snapshot_approval_mutation/);
  assert.match(migration, /reject_snapshot_validation_result_mutation/);
  assert.match(migration, /governance\.reject_immutable_mutation\(\)/);
  assert.match(migration, /BDF_SNAPSHOT_CONTENT_IMMUTABLE/);
  assert.match(migration, /BDF_SNAPSHOT_CONFIRMED_IMMUTABLE/);
});

test('duplicate source versions and duplicate manifests remain rejected', () => {
  assert.match(baseSnapshot, /master_source_snapshots_source_version_unique unique/);
  assert.match(migration, /primary key \(source_snapshot_id, master_type\)/);
  assert.match(migration, /snapshot_approvals_type_unique unique/);
  assert.match(migration, /snapshot_validation_results_unique unique/);
  assert.match(validation, /master_source_snapshots/);
});

test('activation fails closed on manifests, counts, validation, and approval', () => {
  for (const code of [
    'BDF_SNAPSHOT_REQUIRES_FIVE_PASSED_MANIFESTS',
    'BDF_SNAPSHOT_TOTAL_RECORD_COUNT_MISMATCH',
    'BDF_SNAPSHOT_REQUIRES_ALL_MASTER_VALIDATIONS',
    'BDF_SNAPSHOT_HAS_FAILED_VALIDATION',
    'BDF_SNAPSHOT_APPROVAL_INCOMPLETE',
    'BDF_SNAPSHOT_APPROVAL_REJECTED',
  ]) assert.match(migration, new RegExp(code));
  assert.match(migration, /if new\.status = 'activated'/);
});

test('unknown Master types and negative counts are rejected', () => {
  assert.match(migration, /snapshot_master_manifests_master_type_check/);
  assert.match(migration, /snapshot_validation_results_master_type_check/);
  assert.match(migration, /record_count >= 0/);
});

test('actor references cannot be raw Production employee IDs', () => {
  assert.match(migration, /\^\(canonical\|service\|audit\):/);
  assert.match(migration, /Production employee IDs and credentials are prohibited/);
});

test('PUBLIC, anon, authenticated and service_role receive no direct access', () => {
  assert.match(migration, /force row level security/g);
  for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
    assert.match(migration, new RegExp(`from public, anon, authenticated, service_role`));
  }
  assert.match(validation, /BDF_B1_FORBIDDEN_GRANTS/);
});

test('validation storage explicitly prohibits raw data and PII', () => {
  assert.match(migration, /Raw records, PII, credentials, host names, and secrets are prohibited/);
  assert.match(migration, /expected_value text not null/);
  assert.match(migration, /actual_value text not null/);
  assert.match(migration, /\^sha256:\[0-9a-f\]\{64\}\$/);
  assert.match(migration, /\^count:\[0-9\]\+\$/);
  assert.match(migration, /\^version:/);
  assert.match(validation, /BDF_B1_PII_OR_SECRET_COLUMN_DETECTED/);
});

test('M011 refuses to retrofit metadata over an existing Snapshot row', () => {
  assert.match(migration, /BDF_B1_REQUIRES_EMPTY_SNAPSHOT_HEADER/);
  assert.match(migration, /exists \(select 1 from governance\.master_source_snapshots\)/);
});

test('rollback is exact, non-cascading, and preserves PR001 base tables', () => {
  for (const table of [
    'snapshot_validation_results',
    'snapshot_approvals',
    'snapshot_master_manifests',
  ]) assert.match(rollback, new RegExp(`drop table governance\\.${table}`));
  for (const column of ['created_by', 'approval_reference', 'total_record_count']) {
    assert.match(rollback, new RegExp(`drop column ${column}`));
  }
  assert.doesNotMatch(rollback, /drop\s+[^;]*\bcascade\b/i);
  assert.doesNotMatch(rollback, /drop table governance\.master_source_snapshots/i);
});

test('M001-M010 migration files are not referenced as editable targets', () => {
  assert.doesNotMatch(migration, /alter migration|202608060909(?:05|08|11|15|18|21|25|28|31|35)/i);
});
