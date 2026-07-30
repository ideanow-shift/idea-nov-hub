import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const docsRoot = path.join(
  root,
  'docs',
  'core_db_remediation',
  'production_readiness',
  'department_store_mapping',
);

const files = [
  'department-store-mapping-inventory.md',
  'department-store-mapping-approval-table.md',
  'department-store-mapping-options.md',
  'department-store-mapping-human-questions.md',
  'department-store-mapping-summary.md',
];

const read = (name) => readFileSync(path.join(docsRoot, name), 'utf8');

test('approval pack contains all required documents', () => {
  for (const file of files) {
    assert.match(read(file), /^# /m, `${file} needs a title`);
  }
});

test('approval table keeps the bounded schema and six pending candidates', () => {
  const table = read('department-store-mapping-approval-table.md');
  const fields = [
    'department_name', 'department_entity_status', 'proposed_store_scope',
    'proposed_store_count', 'direct_store_count', 'fc_store_count',
    'proposed_data_scope', 'proposed_action_scope', 'effective_from',
    'effective_to', 'confidence', 'approval_status', 'blocking_flag',
    'human_question', 'evidence_source',
  ];
  for (const field of fields) assert.match(table, new RegExp(`\\b${field}\\b`));
  for (const department of ['Sales', 'Education', 'EC', 'HR', 'Accounting', 'FC Business']) {
    assert.match(table, new RegExp(`\\| ${department}`));
  }
  assert.equal((table.match(/PENDING_HUMAN/g) ?? []).length, 7);
  assert.match(table, /Default deny/);
});

test('pack is source-only and has no unsafe identifiers, paths, or markdown links', () => {
  const content = files.map(read).join('\n');
  assert.match(content, /No DB, RLS, API, runtime, migration, seed, UUID, staging, or production change/);
  assert.doesNotMatch(content, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.doesNotMatch(content, /[A-Za-z]:\\/);
  assert.equal([...content.matchAll(/\[[^\]]+\]\([^)]+\)/g)].length, 0);
});
