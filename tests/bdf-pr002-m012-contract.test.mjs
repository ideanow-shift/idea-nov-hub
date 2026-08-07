import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const migrationPath = path.join(
  root,
  'supabase/migrations/20260806223721_m012_bdf_accounting_import_boundary.sql',
);
const rollbackPath = path.join(
  root,
  'supabase/rollback/pr002/m012_bdf_accounting_import_boundary.rollback.sql',
);
const validationPath = path.join(
  root,
  'supabase/validation/pr002/validate_m012.sql',
);

const migration = await readFile(migrationPath, 'utf8');
const rollback = await readFile(rollbackPath, 'utf8');
const validation = await readFile(validationPath, 'utf8');

test('M012 owns only the Accounting import boundary', () => {
  assert.match(migration, /create schema accounting;/);
  for (const table of ['import_batches', 'import_files', 'import_staging_lines']) {
    assert.match(migration, new RegExp(`create table accounting\\.${table}`));
  }
  assert.doesNotMatch(migration, /create table accounting\.(accounts|accounting_versions|journal_entries|accounting_facts|approvals|publication_releases)/);
});

test('Import Batch freezes identity, period, hash, contract versions, and actor', () => {
  for (const field of [
    'source_system', 'source_version', 'source_file', 'source_period',
    'source_hash', 'schema_version', 'mapping_contract_version',
    'tax_normalization_contract_version', 'created_by',
  ]) assert.match(migration, new RegExp(`${field} text|${field} daterange`));
  assert.match(migration, /source_version_unique/);
  assert.match(migration, /source_digest_unique/);
});

test('Import File is batch-scoped and duplicate-safe', () => {
  assert.match(migration, /references accounting\.import_batches\(import_batch_id\) on delete restrict/);
  assert.match(migration, /accounting_import_files_batch_hash_unique/);
  assert.match(migration, /row_count >= 0/);
});

test('staging lines use a deterministic stable source key', () => {
  for (const field of ['source_record_key_digest', 'source_line_no', 'row_digest']) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(migration, /accounting_import_staging_lines_stable_key_unique/);
  assert.match(migration, /references accounting\.import_files\(import_batch_id, import_file_id\)/);
});

test('tax normalization is exclusive and unknown tax cannot pass', () => {
  assert.match(migration, /tax_basis text,/);
  assert.doesNotMatch(migration, /tax_basis text[^\n]*default 'exclusive'/);
  assert.match(migration, /tax_basis is null or tax_basis = 'exclusive'/);
  assert.match(migration, /normalization_status = 'passed'[\s\S]*tax_basis = 'exclusive'/);
  assert.match(migration, /source_tax_basis <> 'unknown'/);
  for (const field of [
    'source_tax_rate', 'tax_rate_source_version', 'rounding_mode',
    'rounding_scope', 'rounding_unit', 'rounding_difference_amount',
  ]) assert.match(migration, new RegExp(field));
  assert.match(migration, /tax_rate_source_version <> 'unknown'/);
  assert.match(migration, /rounding_mode <> 'unknown'/);
  assert.match(migration, /rounding_scope <> 'unknown'/);
  assert.match(migration, /normalization_status in \('pending', 'passed', 'failed'\)/);
});

test('NULL and formal zero remain distinct', () => {
  assert.match(migration, /value_status = 'zero' and normalized_amount = 0/);
  assert.match(migration, /value_status = 'observed' and normalized_amount is not null and normalized_amount <> 0/);
  assert.match(migration, /value_status in \('missing', 'not_applicable', 'pending', 'validation_failed'\) and normalized_amount is null/);
});

test('source lineage is immutable and lifecycle transitions fail closed', () => {
  for (const state of ['received', 'validating', 'validated', 'rejected']) {
    assert.match(migration, new RegExp(`'${state}'`));
  }
  for (const state of ['valid', 'invalid', 'excluded']) {
    assert.match(migration, new RegExp(`'${state}'`));
  }
  assert.match(migration, /BDF_ACCOUNTING_IMPORT_BATCH_IMMUTABLE/);
  assert.match(migration, /BDF_ACCOUNTING_IMPORT_BATCH_INITIAL_STATUS_INVALID/);
  assert.match(migration, /BDF_ACCOUNTING_IMPORT_FILE_INITIAL_STATUS_INVALID/);
  assert.match(migration, /BDF_ACCOUNTING_STAGING_LINE_INITIAL_STATUS_INVALID/);
  assert.match(migration, /BDF_ACCOUNTING_STAGING_SOURCE_FIELDS_IMMUTABLE/);
  assert.match(migration, /- 'normalized_amount' - 'tax_basis' - 'value_status'/);
  assert.match(migration, /BDF_ACCOUNTING_IMPORT_BATCH_INVALID_TRANSITION/);
  assert.match(migration, /BDF_ACCOUNTING_IMPORT_BATCH_VALIDATION_INCOMPLETE/);
  assert.match(migration, /BDF_ACCOUNTING_IMPORT_PROMOTION_NOT_AVAILABLE_BEFORE_M014/);
  assert.match(migration, /BDF_ACCOUNTING_STAGING_GATE_INCOMPLETE/);
  assert.match(migration, /BDF_ACCOUNTING_STAGING_FILE_NOT_VALIDATED/);
  assert.match(migration, /f\.row_count <> \(/);
  assert.equal((migration.match(/before insert or update or delete on accounting\./g) ?? []).length, 3);
  assert.doesNotMatch(migration, /tg_table_name = 'import_(?:batches|files|staging_lines)' and new\./);
  assert.doesNotMatch(migration, /old\.status = 'received' and new\.status in \('validating', 'rejected'\)/);
  assert.doesNotMatch(migration, /old\.validation_status = 'received' and new\.validation_status in \('validating', 'rejected'\)/);
  assert.match(migration, /BDF_ACCOUNTING_IMPORT_DELETE_FORBIDDEN/);
});

test('all M012 tables have forced RLS and no direct public roles', () => {
  assert.equal((migration.match(/force row level security;/g) ?? []).length, 3);
  assert.match(migration, /from public, anon, authenticated, service_role/);
  assert.match(validation, /BDF_M012_FORBIDDEN_GRANTS/);
});

test('M012 privileged function is security invoker with safe search_path', () => {
  assert.match(migration, /security invoker\s+set search_path = ''/);
  assert.doesNotMatch(migration, /security definer/i);
  assert.match(validation, /not p\.prosecdef/);
});

test('raw payload, PII, credentials, and Production IDs are prohibited', () => {
  assert.match(migration, /No free-form payload, source identifier, Production internal ID, PII, credential, or secret/);
  assert.match(validation, /BDF_M012_PII_OR_SECRET_COLUMN_DETECTED/);
  assert.doesNotMatch(migration, /\b(email|phone|address|firebase_uid|bank_account|raw_payload|production_id)\s+(text|uuid|jsonb)/i);
});

test('validation fails closed on exact table, column, constraint, RLS, and grant contracts', () => {
  for (const code of [
    'BDF_M012_TABLE_COUNT', 'BDF_M012_REQUIRED_COLUMN_COUNT',
    'BDF_M012_RLS_FORCE_COUNT', 'BDF_M012_REQUIRED_CONSTRAINT_COUNT',
    'BDF_M012_SECURITY_INVOKER_FUNCTION', 'BDF_M012_REQUIRED_INDEX_COUNT',
    'BDF_M012_REQUIRED_TRIGGER_EVENT_COUNT',
    'BDF_M012_LIFECYCLE_OR_IMMUTABILITY_GATE_MISSING',
    'BDF_M012_FORBIDDEN_SCHEMA_PRIVILEGES',
    'BDF_M012_FORBIDDEN_FUNCTION_PRIVILEGES',
  ]) assert.match(validation, new RegExp(code));
});

test('rollback is exact, reverse ordered, and non-cascading', () => {
  const staging = rollback.indexOf('drop table accounting.import_staging_lines');
  const files = rollback.indexOf('drop table accounting.import_files');
  const batches = rollback.indexOf('drop table accounting.import_batches');
  const schema = rollback.indexOf('drop schema accounting');
  assert.ok(staging < files && files < batches && batches < schema);
  assert.doesNotMatch(rollback, /\bcascade\b/i);
  assert.doesNotMatch(rollback, /\b(core|governance|projection)\./i);
});
