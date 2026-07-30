import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const docsRoot = path.join(root, 'docs', 'security');
const docs = [
  'permission-model-overview.md',
  'permission-role-matrix.md',
  'permission-store-scope-matrix.md',
  'permission-data-scope-matrix.md',
  'permission-action-scope-matrix.md',
  'permission-jwt-claims.md',
  'permission-rls-mapping.md',
  'permission-api-contract.md',
  'permission-human-decisions.md',
];
const read = (file) => readFileSync(path.join(docsRoot, file), 'utf8');

test('permission architecture contains the required source-only documents', () => {
  for (const file of docs) assert.match(read(file), /^# /m, `${file} needs a title`);
});

test('common model covers six layers, twelve roles, scopes, domains, and actions', () => {
  const all = docs.map(read).join('\n');
  for (const layer of ['Employee', 'Role', 'Organization', 'Store Scope', 'Data Scope', 'Action Scope']) {
    assert.match(all, new RegExp(layer));
  }
  const roles = ['Representative Director', 'Director', 'Executive Officer', 'Sales Head', 'Education Head', 'EC Head', 'HR Head', 'Accounting Head', 'Area Manager', 'Store Manager', 'FC Owner', 'Employee'];
  for (const role of roles) assert.match(read('permission-role-matrix.md'), new RegExp(`\\| ${role}`));
  for (const scope of ['ALL_20_STORES', 'DIRECT_13_STORES', 'FC_7_STORES', 'ASSIGNED_STORES', 'NONE']) assert.match(all, new RegExp(scope));
  for (const domain of ['SALES', 'PROFIT', 'PL', 'BS', 'KPI', 'EDUCATION', 'HR', 'RECRUITING', 'EC', 'ATTENDANCE', 'SHIFT', 'TASKS', 'THANKS']) assert.match(all, new RegExp(`\\b${domain}\\b`));
  for (const action of ['NONE', 'READ', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT', 'ADMIN']) assert.match(read('permission-action-scope-matrix.md'), new RegExp(`\\| ${action}`));
});

test('architecture remains implementation-free and default-deny', () => {
  const all = docs.map(read).join('\n');
  assert.match(all, /default deny/i);
  assert.match(all, /does\s+not\s+change\s+a\s+database,\s+RLS,\s+JWT,\s+API,\s+Runtime,\s+migration,\s+staging,\s+production,\s+or\s+deployment/i);
  assert.doesNotMatch(all, /CREATE POLICY|ALTER TABLE|CREATE TABLE|supabase\/functions|Bearer\s+[A-Za-z0-9]/i);
  assert.doesNotMatch(all, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.doesNotMatch(all, /[A-Za-z]:\\/);
});
