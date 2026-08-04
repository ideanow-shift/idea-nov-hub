import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs', 'nov_talent', 'fair_source_backfill');
const contract = JSON.parse(fs.readFileSync(path.join(dir, 'fair-source-mapping-contract.json'), 'utf8'));
const report = JSON.parse(fs.readFileSync(path.join(dir, 'fair-source-dry-run-report.json'), 'utf8'));

test('fair source is fixed to the approved read-only source', () => {
  assert.equal(contract.source.spreadsheet_id, '1nwlOIdQMmPq4ogXOTf-oinAQKnwSTlb3X7Dw8kWowCM');
  assert.equal(contract.source.sheet_id, 938747439);
  assert.equal(contract.source.access_mode, 'read_only');
});

test('unknown source values cannot be converted to zero', () => {
  assert.equal(contract.derived_metrics.zero_when_unknown, false);
  assert.equal(report.staging_preflight.status, 'BLOCKED');
  assert.equal(report.staging_preflight.write_count, 0);
  assert.ok(report.staging_preflight.reason_codes.includes('FAIR_MASTER_UNKNOWN_NUMERIC_VALUES_COERCE_TO_ZERO'));
});

test('identity and selection rules fail closed', () => {
  assert.deepEqual(contract.identity.automatic_key, ['fair_name', 'event_date']);
  assert.equal(contract.identity.name_only_merge, false);
  assert.equal(contract.identity.date_only_merge, false);
  assert.equal(contract.identity.automatic_merge, false);
  assert.equal(contract.selection_metrics.guessing_allowed, false);
});

test('dry-run counts reconcile without personal values', () => {
  assert.equal(report.business_rows, report.identity_ready_rows + report.identity_key_missing_rows);
  assert.equal(report.source_rows_observed, report.business_rows + report.empty_template_rows);
  assert.equal(report.safety.personal_values_in_artifact, false);
  assert.equal(report.safety.spreadsheet_write_count, 0);
  assert.equal(report.safety.staging_write_count, 0);
  assert.equal(report.safety.production_write_count, 0);
});
