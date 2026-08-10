import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { verifyExecutionPackage } from '../review/store-operations-sealed-snapshot-v1-3-1/execution-package-lock.mjs';
import { SECURITY_ALLOWLIST } from '../review/store-operations-sealed-snapshot-v1-3-1/execution-path-security.mjs';
import { PACKAGE_ID, PACKAGE_VERSION } from '../review/store-operations-sealed-snapshot-v1-3-1/package-metadata.mjs';

const root = resolve(import.meta.dirname, '..');
const v12 = join(root, 'review', 'store-operations-sealed-snapshot-v1');
const v13 = join(root, 'review', 'store-operations-sealed-snapshot-v1-3');
const v131 = join(root, 'review', 'store-operations-sealed-snapshot-v1-3-1');

test('v1.2.0 remains the immutable sealed baseline', () => {
  const metadata = readFileSync(join(v12, 'package-metadata.mjs'), 'utf8');
  const lock = JSON.parse(readFileSync(join(v12, 'execution-package-lock-v1.json'), 'utf8'));
  assert.match(metadata, /PACKAGE_VERSION = '1\.2\.0'/);
  assert.equal(lock.packageSha256, 'b80a7c12e2a7dd251d7611b8124954d400f996e2487bd07ab24a27274092a7af');
});

test('v1.3.0 remains the immutable security-corrective baseline', () => {
  const metadata = readFileSync(join(v13, 'package-metadata.mjs'), 'utf8');
  const lock = JSON.parse(readFileSync(join(v13, 'execution-package-lock-v1-3.json'), 'utf8'));
  assert.match(metadata, /PACKAGE_VERSION = '1\.3\.0'/);
  assert.equal(lock.packageSha256, '5cd8330387162679875b933edd2d5d66104c21c05e263af081f99b378ca00ccf');
});

test('v1.3.1 is additive and package integrity is sealed', () => {
  assert.equal(PACKAGE_ID, 'store-operations-consumer-enablement-sealed-snapshot-v1');
  assert.equal(PACKAGE_VERSION, '1.3.1');
  const lock = verifyExecutionPackage({ packageRoot: v131 });
  assert.match(lock.packageSha256, /^[a-f0-9]{64}$/);
  assert.match(lock.securityAllowlistSha256, /^[a-f0-9]{64}$/);
  assert.match(lock.executionPathSecuritySha256, /^[a-f0-9]{64}$/);
});

test('global PUBLIC hardening is not required but direct dangerous grants remain visible', () => {
  assert.equal(SECURITY_ALLOWLIST.globalPublicHardeningRequired, false);
  const runner = readFileSync(join(v131, 'sealed-snapshot-runner.mjs'), 'utf8');
  const readonly = readFileSync(join(v131, 'queries', 'SOCE-QP01-SOURCE-READONLY.sql'), 'utf8');
  assert.match(runner, /direct_application_routine_execute_count/);
  assert.match(readonly, /effective_temp_privilege_count/);
  assert.match(readonly, /executable_application_routine_count/);
  assert.match(readonly, /direct_application_routine_execute_count = 0/);
});

test('broker surface is Query-ID-only and cleanup is rollback then close', () => {
  const broker = readFileSync(join(v131, 'broker-interface.mjs'), 'utf8');
  const runner = readFileSync(join(v131, 'sealed-snapshot-runner.mjs'), 'utf8');
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
  const design = readFileSync(join(root, 'docs', 'architecture', '53_store_operations_sealed_snapshot_v1_3_1_auth_boundary_corrective.md'), 'utf8');
  const gate = readFileSync(join(root, 'docs', 'architecture', '54_store_operations_sealed_snapshot_v1_3_1_release_gate.md'), 'utf8');
  assert.match(design, /changes zero Production or Staging database objects/);
  assert.match(gate, /Global PUBLIC hardening required: NO/);
  assert.match(gate, /Source\/Target roles, grants, RLS policies and credentials provisioned \(separate authorization\)/);
});

test('QP06 excludes auth.users and delegates Auth subject evidence to AUTH-01', () => {
  const sql = readFileSync(join(v131, 'queries', 'SOCE-QP06-TARGET-PRESTATE.sql'), 'utf8');
  const registry = readFileSync(join(v131, 'query-pack-registry.mjs'), 'utf8');
  const allowlist = readFileSync(join(v131, 'security-allowlist-v1.json'), 'utf8');
  const catalog = readFileSync(join(root, 'docs', 'security', 'store_operations_sealed_snapshot_v1', 'query-pack-catalog-v1-3-1.md'), 'utf8');
  const schema = readFileSync(join(root, 'docs', 'security', 'store_operations_sealed_snapshot_v1', 'schema-column-contract-v1-3-1.md'), 'utf8');
  assert.doesNotMatch(sql, /auth\.users|auth_subject_count/);
  assert.doesNotMatch(registry, /auth_subject_count/);
  assert.doesNotMatch(allowlist, /auth\.users|auth_subject_count/);
  assert.match(registry, /queryVersion: '1\.0\.1'/);
  assert.match(registry, /outputSchemaVersion: '1\.0\.1'/);
  assert.match(catalog, /AUTH-01/);
  assert.match(schema, /does not require `auth` schema/);
});
