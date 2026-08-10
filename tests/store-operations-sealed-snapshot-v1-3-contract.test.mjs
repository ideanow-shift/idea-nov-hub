import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { verifyExecutionPackage } from '../review/store-operations-sealed-snapshot-v1-3/execution-package-lock.mjs';
import { SECURITY_ALLOWLIST } from '../review/store-operations-sealed-snapshot-v1-3/execution-path-security.mjs';
import { PACKAGE_ID, PACKAGE_VERSION } from '../review/store-operations-sealed-snapshot-v1-3/package-metadata.mjs';

const root = resolve(import.meta.dirname, '..');
const v12 = join(root, 'review', 'store-operations-sealed-snapshot-v1');
const v13 = join(root, 'review', 'store-operations-sealed-snapshot-v1-3');

test('v1.2.0 remains the immutable sealed baseline', () => {
  const metadata = readFileSync(join(v12, 'package-metadata.mjs'), 'utf8');
  const lock = JSON.parse(readFileSync(join(v12, 'execution-package-lock-v1.json'), 'utf8'));
  assert.match(metadata, /PACKAGE_VERSION = '1\.2\.0'/);
  assert.equal(lock.packageSha256, 'b80a7c12e2a7dd251d7611b8124954d400f996e2487bd07ab24a27274092a7af');
});

test('v1.3.0 is additive and package integrity is sealed', () => {
  assert.equal(PACKAGE_ID, 'store-operations-consumer-enablement-sealed-snapshot-v1');
  assert.equal(PACKAGE_VERSION, '1.3.0');
  const lock = verifyExecutionPackage({ packageRoot: v13 });
  assert.match(lock.packageSha256, /^[a-f0-9]{64}$/);
  assert.match(lock.securityAllowlistSha256, /^[a-f0-9]{64}$/);
  assert.match(lock.executionPathSecuritySha256, /^[a-f0-9]{64}$/);
});

test('global PUBLIC hardening is not required but direct dangerous grants remain visible', () => {
  assert.equal(SECURITY_ALLOWLIST.globalPublicHardeningRequired, false);
  const runner = readFileSync(join(v13, 'sealed-snapshot-runner.mjs'), 'utf8');
  const readonly = readFileSync(join(v13, 'queries', 'SOCE-QP01-SOURCE-READONLY.sql'), 'utf8');
  assert.match(runner, /direct_application_routine_execute_count/);
  assert.match(readonly, /effective_temp_privilege_count/);
  assert.match(readonly, /executable_application_routine_count/);
  assert.match(readonly, /direct_application_routine_execute_count = 0/);
});

test('broker surface is Query-ID-only and cleanup is rollback then close', () => {
  const broker = readFileSync(join(v13, 'broker-interface.mjs'), 'utf8');
  const runner = readFileSync(join(v13, 'sealed-snapshot-runner.mjs'), 'utf8');
  assert.match(broker, /executeFixedQuery/);
  assert.match(broker, /'query', 'execute', 'executeSql', 'raw', 'prepare', 'interactive'/);
  assert.match(runner, /await connection\.rollback\(\)/);
  assert.match(runner, /await connection\.close\(\)/);
  assert.match(runner, /retryCount: 0/);
});

test('all functions and operators are explicit signatures with no namespace wildcard', () => {
  const functions = Object.values(SECURITY_ALLOWLIST.functionSignatures).flat();
  assert.ok(functions.length > 0);
  assert.ok(functions.every((signature) => signature.startsWith('pg_catalog.') && !signature.includes('*') || signature === 'pg_catalog.count()'));
  assert.equal(functions.includes('pg_catalog.*'), false);
  assert.equal(SECURITY_ALLOWLIST.operatorSignatures.includes('pg_catalog.*'), false);
});

test('the release gate fixes zero DB change and separate provisioning', () => {
  const design = readFileSync(join(root, 'docs', 'architecture', '51_store_operations_sealed_snapshot_v1_3_security_corrective.md'), 'utf8');
  const gate = readFileSync(join(root, 'docs', 'architecture', '52_store_operations_sealed_snapshot_v1_3_security_release_gate.md'), 'utf8');
  assert.match(design, /changes zero Production or Staging database objects/);
  assert.match(gate, /Global PUBLIC hardening required: NO/);
  assert.match(gate, /Source\/Target roles, grants, RLS policies and credentials provisioned \(separate authorization\)/);
});
