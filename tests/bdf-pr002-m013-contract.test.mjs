import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const migration = await read('supabase/migrations/20260807122604_m013_bdf_account_master_statement_mapping.sql');
const rollback = await read('supabase/rollback/pr002/m013_bdf_account_master_statement_mapping.rollback.sql');
const validation = await read('supabase/validation/pr002/validate_m013.sql');
const dbTest = await read('supabase/validation/pr002/test_m013_account_mapping.sql');

test('M013 owns exactly Account Master and Statement Mapping', () => {
  for (const table of ['account_identities', 'accounts', 'account_statement_mappings']) {
    assert.match(migration, new RegExp(`create table accounting\\.${table}`));
  }
  assert.doesNotMatch(migration, /create table accounting\.(accounting_versions|journal_entries|accounting_facts|cash_flow_facts|approvals|publication_releases)/);
  assert.doesNotMatch(migration, /create (?:or replace )?view/i);
});

test('Canonical identity and immutable effective-dated version metadata are fixed', () => {
  for (const field of ['account_version_id', 'account_id', 'version_no', 'effective_from',
    'effective_to', 'source_snapshot_id', 'source_version', 'mapping_contract_version',
    'content_digest', 'supersedes_account_version_id']) assert.match(migration, new RegExp(field));
  assert.match(migration, /accounting_accounts_identity_period_excl exclude using gist/);
  assert.match(migration, /accounting_accounts_code_period_excl exclude using gist/);
  assert.match(migration, /BDF_ACCOUNT_MASTER_IMMUTABLE/);
});

test('P/L and B/S vocabularies match the frozen Design Package', () => {
  for (const category of ['revenue', 'cost_of_sales', 'gross_profit', 'personnel_cost',
    'operating_expense', 'operating_profit', 'current_asset', 'noncurrent_asset',
    'current_liability', 'noncurrent_liability', 'equity']) assert.match(migration, new RegExp(`'${category}'`));
  assert.match(migration, /statement_type = 'pl' and measure_type = 'period_flow'/);
  assert.match(migration, /statement_type = 'bs' and measure_type = 'ending_balance'/);
});

test('Cash Flow is not an M013 statement mapping', () => {
  assert.match(migration, /accounting_statement_mappings_type_check check \(statement_type in \('pl', 'bs'\)\)/);
  assert.doesNotMatch(migration, /create table accounting\.cash_flow/);
});

test('typed mapping rejects statement mismatch, overlap, and invalid aggregation', () => {
  assert.match(migration, /accounting_statement_mappings_account_version_fk/);
  assert.match(migration, /accounting_statement_mappings_account_period_excl/);
  assert.match(migration, /BDF_ACCOUNT_STATEMENT_MAPPING_MISMATCH/);
  assert.match(migration, /aggregation_behavior in \('add', 'subtract', 'display_only'\)/);
  assert.match(migration, /contribution_sign = -1/);
});

test('parent hierarchy is FK-backed and cycle safe', () => {
  assert.match(migration, /parent_account_id uuid\s+references accounting\.account_identities/);
  assert.match(migration, /with recursive ancestors/);
  assert.match(migration, /BDF_ACCOUNT_HIERARCHY_CYCLE/);
  assert.match(migration, /BDF_ACCOUNT_PARENT_VERSION_NOT_COMPATIBLE/);
});

test('all M013 tables use forced RLS and zero Consumer grants', () => {
  assert.equal((migration.match(/force row level security;/g) ?? []).length, 3);
  assert.equal((migration.match(/revoke all on accounting\.(?:account_identities|accounts|account_statement_mappings)/g) ?? []).length, 3);
  assert.doesNotMatch(migration, /security definer/i);
  assert.match(validation, /BDF_M013_FORBIDDEN_GRANTS/);
  assert.match(validation, /BDF_M013_CONSUMER_VIEW_PROHIBITED/);
});

test('Validation and DB tests cover required fail-closed contracts', () => {
  for (const code of ['BDF_M013_TABLE_COUNT', 'BDF_M013_REQUIRED_COLUMN_COUNT',
    'BDF_M013_EFFECTIVE_OVERLAP_GUARD', 'BDF_M013_RLS_FORCE_COUNT',
    'BDF_M013_SECURITY_INVOKER_FUNCTIONS', 'BDF_M013_PII_OR_PRODUCTION_COLUMN']) {
    assert.match(validation, new RegExp(code));
  }
  for (const code of ['ACCOUNT_OVERLAP', 'ACCOUNT_CODE', 'ORPHAN_PARENT',
    'STATEMENT_MISMATCH', 'CASH_FLOW', 'MAPPING_OVERLAP', 'DISPLAY_ORDER',
    'ACCOUNT_UPDATE', 'MAPPING_DELETE']) assert.match(dbTest, new RegExp(code));
});

test('Rollback is M013-only, reverse ordered, and non-cascading', () => {
  assert.ok(rollback.indexOf('drop table accounting.account_statement_mappings') < rollback.indexOf('drop table accounting.accounts'));
  assert.ok(rollback.indexOf('drop table accounting.accounts') < rollback.indexOf('drop table accounting.account_identities'));
  assert.doesNotMatch(rollback, /\bcascade\b/i);
  assert.doesNotMatch(rollback, /drop schema accounting|\b(core|governance|projection)\./i);
});
