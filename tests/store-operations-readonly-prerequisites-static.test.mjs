import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const report = readFileSync(path.join(root, 'docs', 'security', 'store-operations-production-readonly-prerequisites.md'), 'utf8');

test('report contains the three workstreams and explicit blocking decision', () => {
  assert.match(report, /^# Store Operations Production Read-only Prerequisites/m);
  assert.match(report, /\*\*BLOCKED for Production read-only connection\.\*\*/);
  for (const workstream of ['Core DB workstream', 'HUB Core workstream', 'Accounting Core workstream']) {
    assert.match(report, new RegExp(workstream));
  }
});

test('report preserves source-only and permission boundaries', () => {
  for (const boundary of ['No Production connection', 'direct UI-to-database access prohibited', 'six-layer Permission Model', 'Production-mock rejection']) {
    assert.match(report, new RegExp(boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.doesNotMatch(report, /CREATE POLICY|ALTER TABLE|CREATE TABLE|INSERT INTO|UPDATE\s+\w+|DELETE FROM/i);
  assert.doesNotMatch(report, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.doesNotMatch(report, /[A-Za-z]:\\/);
});

test('report does not promote candidates to approved production facts', () => {
  assert.match(report, /runtime integration candidate/);
  assert.match(report, /Tokorozawa canonical UUID is \*\*unresolved\*\*/);
  assert.match(report, /Official operating-profit source, formula, and confirmed-through period are\s+\*\*unresolved\*\*/);
});
