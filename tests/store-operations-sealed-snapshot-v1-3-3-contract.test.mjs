import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateExecutionAuthorization, assertAuthorizationGeneratorParity } from '../review/store-operations-sealed-snapshot-v1-3-3/authorization-generator.mjs';
import { verifyExecutionPackage } from '../review/store-operations-sealed-snapshot-v1-3-3/execution-package-lock.mjs';
import { zeroConnectionFormalRunnerPreflight } from '../review/store-operations-sealed-snapshot-v1-3-3/formal-runner-preflight.mjs';
import { generatePrivateQueryPackManifest } from '../review/store-operations-sealed-snapshot-v1-3-3/private-query-registry-generator.mjs';
import { PACKAGE_ID, PACKAGE_VERSION } from '../review/store-operations-sealed-snapshot-v1-3-3/package-metadata.mjs';
import { PUBLIC_QUERY_CATALOG_HASH, QUERY_PACK_IDS, getFixedQuery } from '../review/store-operations-sealed-snapshot-v1-3-3/query-pack-registry.mjs';
import { EXECUTION_AUTHORIZATION_FIELDS } from '../review/store-operations-sealed-snapshot-v1-3-3/run-contract.mjs';
import { generateApprovedSchemaContract } from '../review/store-operations-sealed-snapshot-v1-3-3/schema-contract-generator.mjs';
import { hashSchemaContract } from '../review/store-operations-sealed-snapshot-v1-3-3/schema-contract.mjs';
import { verifyExecutionPackage as verifyV132 } from '../review/store-operations-sealed-snapshot-v1-3-2/execution-package-lock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
function test(name, fn) { fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }

function fixture() {
  const packageLock = verifyExecutionPackage();
  const manifest = generatePrivateQueryPackManifest();
  const contract = generateApprovedSchemaContract({
    approvalReference: 'approval:soce-v133-fixture', packageLock,
    privateQueryPackManifestHash: manifest.contentHash,
    expectedStage0Digest: 'd'.repeat(64),
    targetObjectSet: ['core.corporations', 'core.employee_store_assignments', 'core.employees', 'core.stores'],
    sourceApplicationSchemaCount: 2, sourceApplicationSchemaSetMd5: 'a'.repeat(32),
    targetApplicationSchemaCount: 2, targetApplicationSchemaSetMd5: 'b'.repeat(32),
    roleScope: { sourceSnapshotRole: 'soce_source_snapshot_ro', targetSnapshotRole: 'soce_target_snapshot_ro', membershipCount: 0, ownershipCount: 0 },
    rlsPrivilegeEvidence: { effectiveRoleClosurePassed: true, sourceSelectScopePassed: true, targetSelectScopePassed: true, authSchemaPrivilegeCount: 0 },
  });
  const request = {
    executionPackageId: PACKAGE_ID, packageVersion: PACKAGE_VERSION,
    sourceProjectLabel: 'idea-nov-core', targetProjectLabel: 'idea-nov-staging',
    publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH, privateQueryPackManifestHash: manifest.contentHash,
    noRetry: true, runId: 'run:soce-v133-fixture', packIds: [...QUERY_PACK_IDS],
    authorizationReference: 'approval:soce-v133-fixture', schemaContractHash: contract.schemaContractHash,
  };
  const sourceProfile = { profileReference: 'private:source-profile', profileFingerprint: '1'.repeat(64), brokerReference: 'private:broker', expectedSnapshotRole: 'soce_source_snapshot_ro' };
  const targetProfile = { profileReference: 'private:target-profile', profileFingerprint: '2'.repeat(64), brokerReference: 'private:broker', expectedSnapshotRole: 'soce_target_snapshot_ro' };
  const authorization = {
    authorizationReference: request.authorizationReference, runId: request.runId,
    packageId: PACKAGE_ID, packageVersion: PACKAGE_VERSION, packageSha256: packageLock.packageSha256,
    queryPackSha256: packageLock.queryPackSha256, securityAllowlistSha256: packageLock.securityAllowlistSha256,
    executionPathSecuritySha256: packageLock.executionPathSecuritySha256,
    schemaContractSha256: packageLock.schemaContractSha256, approvedSchemaContractHash: contract.schemaContractHash,
    privateQueryPackManifestHash: manifest.contentHash, publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH,
    sourceProfileReference: sourceProfile.profileReference, sourceProfileFingerprint: sourceProfile.profileFingerprint,
    targetProfileReference: targetProfile.profileReference, targetProfileFingerprint: targetProfile.profileFingerprint,
    brokerReference: 'private:broker', brokerFingerprint: '3'.repeat(64),
    sourceSnapshotRole: sourceProfile.expectedSnapshotRole, targetSnapshotRole: targetProfile.expectedSnapshotRole,
    operatorReference: 'principal:canonical-employee:740fe84f-2bdb-4071-9a03-c790fc391d53',
    reviewerReference: 'principal:idea-nov-os-owner', ownerReference: 'principal:idea-nov-os-owner',
    sourceRoleOwnerReference: 'principal:source-role-owner', targetRoleOwnerReference: 'principal:target-role-owner',
    brokerOwnerReference: 'principal:broker-owner', profileCustodianReference: 'principal:profile-custodian',
    authorizedAt: '2026-08-11T00:00:00.000Z', executionWindowStart: '2026-08-11T00:30:00.000Z',
    executionWindowEnd: '2026-08-11T01:30:00.000Z', snapshotOutputPolicy: 'sealed_private_snapshot_only',
  };
  return { packageLock, manifest, contract, request, sourceProfile, targetProfile, authorization };
}

test('v1.3.3 package and immutable v1.3.2 remain independently sealed', () => {
  assert.equal(verifyExecutionPackage().packageVersion, '1.3.3');
  assert.equal(verifyV132().packageVersion, '1.3.2');
});

test('QP02 covers every Canonical Assignment Foundation relation used by QP04', () => {
  const qp02 = readFileSync(join(root, 'review/store-operations-sealed-snapshot-v1-3-3', getFixedQuery('SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP').sqlFile), 'utf8');
  const qp04 = readFileSync(join(root, 'review/store-operations-sealed-snapshot-v1-3-3', getFixedQuery('SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY').sqlFile), 'utf8');
  for (const relation of ['departments', 'employee_organization_assignments', 'organization_assignment_types']) {
    assert.equal(qp02.includes(`'${relation}'`), true);
    assert.equal(qp04.includes(`public.${relation}`), true);
  }
  assert.equal(qp02.includes('auth.users'), false);
  assert.equal(qp04.includes('auth.users'), false);
});

test('formal Authorization generator is exact 31/31 with missing 0 and unknown 0', () => {
  const f = fixture();
  assert.equal(assertAuthorizationGeneratorParity(), true);
  assert.equal(EXECUTION_AUTHORIZATION_FIELDS.length, 31);
  const result = generateExecutionAuthorization({ source: f.authorization, request: f.request, packageLock: f.packageLock, approvedSchemaContract: f.contract });
  assert.deepEqual(Object.keys(result.authorization), [...EXECUTION_AUTHORIZATION_FIELDS]);
  assert.equal(result.missingFieldCount, 0);
  assert.equal(result.unknownFieldCount, 0);
  assert.throws(() => generateExecutionAuthorization({ source: { ...f.authorization, obsoleteField: 'forbidden' }, request: f.request, packageLock: f.packageLock, approvedSchemaContract: f.contract }), /EXECUTION_AUTHORIZATION_REJECTED|AUTHORIZATION_CONTRACT_DRIFT/);
});

test('approved Schema Contract instance is package, query, role, RLS, and Stage-0 bound', () => {
  const { contract, packageLock, manifest } = fixture();
  assert.equal(contract.packageSha256, packageLock.packageSha256);
  assert.equal(contract.queryPackSha256, packageLock.queryPackSha256);
  assert.equal(contract.privateQueryPackManifestHash, manifest.contentHash);
  assert.equal(contract.sourceObjectSet.includes('public.employee_organization_assignments'), true);
  assert.equal(contract.relationColumnSet.includes('public.organization_assignment_types.assignment_code'), true);
  assert.equal(contract.rlsPrivilegeEvidence.authSchemaPrivilegeCount, 0);
});

test('zero-connection formal runner reaches execution-ready with exact bindings', () => {
  const f = fixture();
  const generated = generateExecutionAuthorization({ source: f.authorization, request: f.request, packageLock: f.packageLock, approvedSchemaContract: f.contract });
  const result = zeroConnectionFormalRunnerPreflight({
    request: f.request, authorizationSource: f.authorization, approvedSchemaContract: f.contract,
    privateQueryPackManifest: f.manifest, sourceProfile: f.sourceProfile, targetProfile: f.targetProfile,
    operatorSummary: { sales_department_head_state: 'resolved', sales_department_head_candidate_count: 1, sales_department_head_employee_key: '740fe84f-2bdb-4071-9a03-c790fc391d53', sales_department_head_employee_number: '69' },
    operatorEmployeeUuid: '740fe84f-2bdb-4071-9a03-c790fc391d53', operatorEmployeeNumber: '69',
    reviewerPrincipal: 'principal:idea-nov-os-owner', trustedNow: new Date('2026-08-11T00:45:00.000Z'),
    executionLedgerBinding: { runId: f.request.runId, authorizationBindingHash: generated.authorizationSha256, outputPolicy: 'sealed_private_snapshot_only', state: 'AUTHORIZED' },
  });
  assert.equal(result.state, 'EXECUTION_READY');
  assert.equal(result.connectionAttemptCount, 0);
  assert.equal(result.queryExecutionCount, 0);
});

test('zero-connection preflight rejects a rehashed stale Package binding', () => {
  const f = fixture();
  const stale = { ...f.contract, packageSha256: '0'.repeat(64) };
  const { schemaContractHash: _old, ...base } = stale;
  stale.schemaContractHash = hashSchemaContract(base);
  assert.throws(() => zeroConnectionFormalRunnerPreflight({
    request: { ...f.request, schemaContractHash: stale.schemaContractHash }, authorizationSource: { ...f.authorization, approvedSchemaContractHash: stale.schemaContractHash },
    approvedSchemaContract: stale, privateQueryPackManifest: f.manifest, sourceProfile: f.sourceProfile, targetProfile: f.targetProfile,
    operatorSummary: {}, operatorEmployeeUuid: '740fe84f-2bdb-4071-9a03-c790fc391d53', operatorEmployeeNumber: '69',
    reviewerPrincipal: 'principal:idea-nov-os-owner', trustedNow: new Date('2026-08-11T00:45:00.000Z'), executionLedgerBinding: {},
  }), /FORMAL_RUNNER_PREFLIGHT_REJECTED/);
});

assert.equal(passed, 6);
process.stdout.write('RESULT 6/6 PASS\n');
