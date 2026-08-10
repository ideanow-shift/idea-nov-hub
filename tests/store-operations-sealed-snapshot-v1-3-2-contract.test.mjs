import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { verifyExecutionPackage } from '../review/store-operations-sealed-snapshot-v1-3-2/execution-package-lock.mjs';
import { verifyExecutionPackage as verifyV131 } from '../review/store-operations-sealed-snapshot-v1-3-1/execution-package-lock.mjs';
import { getFixedQuery } from '../review/store-operations-sealed-snapshot-v1-3-2/query-pack-registry.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
function test(name, fn) { fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }

test('v1.3.2 package integrity is sealed', () => {
  const lock = verifyExecutionPackage();
  assert.equal(lock.packageVersion, '1.3.2');
});

test('QP04 uses Canonical Organization Assignment Foundation', () => {
  const query = getFixedQuery('SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY');
  const sql = readFileSync(join(root, 'review', 'store-operations-sealed-snapshot-v1-3-2', query.sqlFile), 'utf8');
  for (const token of ['employee_organization_assignments', 'organization_assignment_types', "assignment_code = 'department_head'", "department_name = '営業部'"]) assert.equal(sql.includes(token), true);
  for (const forbidden of ['auth.users', 'firebase_uid', 'employee_roles', 'position_id']) assert.equal(sql.includes(forbidden), false);
});

test('v1.3.1 package remains independently sealed', () => {
  assert.equal(verifyV131().packageVersion, '1.3.1');
});

test('documentation fixes the Auth and legacy-role boundary', () => {
  const design = readFileSync(join(root, 'docs', 'architecture', '55_store_operations_sealed_snapshot_v1_3_2_canonical_operator_corrective.md'), 'utf8');
  assert.equal(design.includes('AUTH-01'), true);
  assert.equal(design.includes('does not establish'), true);
});

assert.equal(passed, 4);
process.stdout.write('RESULT 4/4 PASS\n');
