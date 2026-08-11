import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { hashCanonical, hashRecordSet } from './canonicalization.mjs';
import { assertCleanupReceipt, buildCleanupReceipt, CLEANUP_RECEIPT_FIELDS } from './cleanup-receipt.mjs';
import { deriveExecutionPackageLock, verifyExecutionPackage } from './execution-package-lock.mjs';
import { FakePrivateArtifactSink, FakePrivateExecutionLedger, FakeSealedSnapshotBroker, FakeSealedSnapshotConnection } from './fake-broker.mjs';
import { PACKAGE_ID, PACKAGE_VERSION } from './package-metadata.mjs';
import { resolveCanonicalOperator } from './operator-resolver.mjs';
import { FIXED_QUERY_IDS, FIXED_QUERY_REGISTRY, FIXED_QUERY_PACKS, PUBLIC_QUERY_CATALOG_HASH, QUERY_PACK_IDS, assertFixedQueryRegistry, getFixedQuery, publicQueryCatalogShape } from './query-pack-registry.mjs';
import { assertPrivateRows, assertSanitizedEvidence, sanitizeQueryEvidence } from './sanitizer.mjs';
import { hashPrivateQueryPackManifest, hashSchemaContract, hashStage0Evidence, privateQueryAttestations } from './schema-contract.mjs';
import { generateApprovedSchemaContract } from './schema-contract-generator.mjs';
import { runSealedSnapshot } from './sealed-snapshot-runner.mjs';
import { verifySqlArtifact } from './sql-artifacts.mjs';
import { SECURITY_ALLOWLIST, SECURITY_ALLOWLIST_HASH } from './execution-path-security.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let passed = 0;

async function test(name, fn) {
  await fn();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function readOnlyRow(side) {
  return {
    attestation_side: side,
    current_user_state: 'verified',
    current_role_reference: 'f'.repeat(32),
    transaction_read_only: 'on',
    default_transaction_read_only: 'on',
    application_schema_count: 2,
    application_schema_set_md5: 'e'.repeat(32),
    reachable_role_count: 1,
    settable_role_count: 1,
    inherited_role_count: 1,
    unsafe_reachable_role_count: 0,
    superuser_count: 0,
    createdb_role_count: 0,
    createrole_role_count: 0,
    replication_role_count: 0,
    bypassrls_role_count: 0,
    login_role_count: 1,
    noinherit_violation_count: 0,
    connection_limit_violation_count: 0,
    valid_until_violation_count: 0,
    membership_edge_count: 0,
    service_role_count: 0,
    owned_database_count: 0,
    owned_application_schema_count: 0,
    owned_relation_count: 0,
    owned_function_count: 0,
    owned_type_count: 0,
    owned_extension_count: 0,
    effective_temp_privilege_count: 0,
    effective_database_create_count: 0,
    effective_schema_create_count: 0,
    effective_insert_privilege_count: 0,
    effective_update_privilege_count: 0,
    effective_delete_privilege_count: 0,
    effective_truncate_privilege_count: 0,
    effective_references_privilege_count: 0,
    effective_trigger_privilege_count: 0,
    effective_sequence_usage_count: 0,
    effective_sequence_update_count: 0,
    effective_dml_privilege_count: 0,
    effective_sequence_write_count: 0,
    executable_application_routine_count: 0,
    direct_application_routine_execute_count: 0,
    membership_admin_option_count: 0,
    role_closure_checked: true,
    ownership_gate_checked: true,
    temp_gate_checked: true,
    routine_execute_gate_checked: true,
    read_only_role_contract_passed: true,
  };
}

function identityRow(side, environment) {
  return {
    attestation_side: side,
    environment_state: environment,
    project_identity_state: 'match',
    region_state: 'match',
    profile_state: 'match',
    server_version: '17.2',
    server_version_num: 170002,
  };
}

function schemaRow(side) {
  return {
    attestation_side: side,
    object_namespace: side === 'source' ? 'public' : 'core',
    object_label: 'logical_master',
    object_kind: 'table',
    column_label: 'logical_key',
    data_type: 'uuid',
    nullable: false,
    constraint_kind: 'primary_key',
    relation_label: 'logical_relation',
  };
}

function buildRows() {
  const source = {
    'SOCE-QP01-SOURCE-IDENTITY': [identityRow('source', 'production')],
    'SOCE-QP01-SOURCE-READONLY': [readOnlyRow('source')],
    'SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP': [schemaRow('source')],
    'SOCE-QP03-CLASSIFICATION-SUMMARY': [{
      canonical_corporation_count: 6, official_store_count: 20, direct_store_count: 13, franchise_store_count: 7, non_store_row_count: 1,
      duplicate_store_key_count: 0, unresolved_store_count: 0, orphan_corporation_relation_count: 0, unknown_classification_count: 0,
    }],
    'SOCE-QP03-CANONICAL-STORE-ROWS': Array.from({ length: 20 }, (_, index) => ({
      canonical_corporation_key: `corp-${(index % 6) + 1}`,
      canonical_store_key: `store-${String(index + 1).padStart(2, '0')}`,
      store_label: `Synthetic Store ${String(index + 1).padStart(2, '0')}`,
      store_status: 'active', store_classification: index < 13 ? 'direct' : 'franchise', corporation_relation_state: 'effective',
      effective_from: '2026-01-01', effective_to: null, relation_version: 'v1', source_lineage_state: 'attested',
    })),
    'SOCE-QP03-TOKOROZAWA-LEGACY-RELATION': [{
      legacy_relation_state: 'confirmed', corporation_relation_state: 'effective', duplicate_relation_count: 0, unresolved_relation_count: 0,
      effective_from: '2026-01-01', effective_to: null,
    }],
    'SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY': [{
      representative_candidate_count: 1, vice_president_candidate_count: 1, sales_department_head_candidate_count: 1,
      sales_department_head_state: 'resolved', sales_department_head_employee_key: '740fe84f-2bdb-4071-9a03-c790fc391d53',
      sales_department_head_employee_number: '69', area_manager_candidate_count: 2,
      store_manager_coverage_count: 20, missing_store_manager_count: 0, duplicate_store_manager_count: 0, orphan_assignment_count: 0,
    }],
    'SOCE-QP04-AM-ASSIGNMENT-EVIDENCE': [
      { canonical_employee_key: 'employee-am-1', canonical_store_key: 'store-01', assignment_kind: 'primary', assignment_status: 'active', effective_from: '2026-01-01', effective_to: null, relation_version: 'v1' },
      { canonical_employee_key: 'employee-am-2', canonical_store_key: 'store-02', assignment_kind: 'secondary', assignment_status: 'active', effective_from: '2026-01-01', effective_to: null, relation_version: 'v1' },
    ],
    'SOCE-QP04-STORE-MANAGER-COVERAGE': Array.from({ length: 20 }, (_, index) => ({
      canonical_store_key: `store-${String(index + 1).padStart(2, '0')}`, canonical_employee_key: `employee-manager-${String(index + 1).padStart(2, '0')}`,
      manager_role_state: 'active', assignment_status: 'active', effective_from: '2026-01-01', effective_to: null,
    })),
    'SOCE-QP05-IDENTITY-CROSSWALK-SUMMARY': [{
      crosswalk_candidate_count: 2, email_only_match_count: 0, display_name_only_match_count: 0, one_to_many_subject_count: 0, inactive_employee_count: 0, unresolved_crosswalk_count: 0,
    }],
    'SOCE-QP05-CONSUMER-ANCHOR-SOURCE-EVIDENCE': Array.from({ length: 12 }, (_, index) => ({
      canonical_employee_key: index < 6 ? 'employee-exec-1' : 'employee-exec-2', canonical_corporation_key: `corp-${(index % 6) + 1}`,
      consumer_application: 'store_operations', purpose: 'cross_corporation_consumer_anchor', evidence_state: 'attested', effective_from: '2026-01-01', effective_to: null,
    })),
  };
  const target = {
    'SOCE-QP01-TARGET-IDENTITY': [identityRow('target', 'staging')],
    'SOCE-QP01-TARGET-READONLY': [readOnlyRow('target')],
    'SOCE-QP02-TARGET-SCHEMA-COLUMN-MAP': [schemaRow('target')],
    'SOCE-QP06-TARGET-PRESTATE': [{
      canonical_corporation_count: 0, canonical_store_count: 0, canonical_employee_count: 0, canonical_role_count: 0, canonical_assignment_count: 0,
      identity_crosswalk_count: 0, consumer_anchor_count: 0, consumer_access_contract_count: 0,
      partial_population_count: 0, duplicate_count: 0, orphan_count: 0,
    }],
    'SOCE-QP06-M019-PRESENCE': [{ m019_migration_state: 'present', m019_access_contract_count: 0, m019_partial_population_count: 0 }],
  };
  return { source, target };
}

function queryBinding(query) {
  return {
    queryId: query.queryId,
    queryVersion: query.queryVersion,
    packId: query.packId,
    sqlFile: query.sqlFile,
    sqlSha256: query.sqlSha256,
    astSha256: SECURITY_ALLOWLIST.queries.find((entry) => entry.queryId === query.queryId)?.astSha256,
    expectedColumns: [...query.expectedColumns],
    expectedTypes: structuredClone(query.expectedTypes),
    expectedOutputSchemaVersion: query.expectedOutputSchemaVersion,
  };
}

function buildPrivateQueryRegistry() {
  const queries = FIXED_QUERY_REGISTRY.map(queryBinding);
  const base = {
    manifestId: 'SOCE-PRIVATE-QUERY-REGISTRY-v1', executionState: 'sealed', publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH, securityAllowlistHash: SECURITY_ALLOWLIST_HASH, packIds: QUERY_PACK_IDS,
    packs: QUERY_PACK_IDS.map((packId) => ({
      packId, queryIds: FIXED_QUERY_REGISTRY.filter((query) => query.packId === packId).map((query) => query.queryId),
      queryHashManifestHash: hashCanonical(queries.filter((query) => query.packId === packId)),
    })),
    queries,
  };
  return { ...base, contentHash: hashPrivateQueryPackManifest(base) };
}

function rebuildSchemaContract(fixture, overrides = {}) {
  const generated = generateApprovedSchemaContract({
    approvalReference: 'approval:fixture', packageLock: verifyExecutionPackage(),
    privateQueryPackManifestHash: fixture.privateQueryPackManifest.contentHash,
    expectedStage0Digest: overrides.expectedStage0Digest ?? hashStage0Evidence(fixture.stage0Records()),
    targetObjectSet: ['core.corporations', 'core.employee_store_assignments', 'core.employees', 'core.stores'],
    sourceApplicationSchemaCount: overrides.sourceApplicationSchemaCount ?? fixture.source['SOCE-QP01-SOURCE-READONLY'][0].application_schema_count,
    sourceApplicationSchemaSetMd5: fixture.source['SOCE-QP01-SOURCE-READONLY'][0].application_schema_set_md5,
    targetApplicationSchemaCount: fixture.target['SOCE-QP01-TARGET-READONLY'][0].application_schema_count,
    targetApplicationSchemaSetMd5: fixture.target['SOCE-QP01-TARGET-READONLY'][0].application_schema_set_md5,
    roleScope: { sourceSnapshotRole: 'soce_source_snapshot_ro', targetSnapshotRole: 'soce_target_snapshot_ro', membershipCount: 0, ownershipCount: 0 },
    rlsPrivilegeEvidence: { effectiveRoleClosurePassed: true, sourceSelectScopePassed: true, targetSelectScopePassed: true, authSchemaPrivilegeCount: 0 },
  });
  fixture.approvedSchemaContract = generated;
  fixture.request.schemaContractHash = fixture.approvedSchemaContract.schemaContractHash;
  fixture.request.privateQueryPackManifestHash = fixture.privateQueryPackManifest.contentHash;
  fixture.executionAuthorization.approvedSchemaContractHash = fixture.approvedSchemaContract.schemaContractHash;
  fixture.executionAuthorization.privateQueryPackManifestHash = fixture.privateQueryPackManifest.contentHash;
  fixture.privateExecutionLedger.authorizeRun({ runId: fixture.request.runId, bindingHash: hashCanonical(fixture.executionAuthorization) });
}

function makeFixture({ runId = 'run:fixture' } = {}) {
  const { source, target } = buildRows();
  const packageLock = verifyExecutionPackage();
  const privateQueryPackManifest = buildPrivateQueryRegistry();
  const sourceProfile = {
    profileReference: 'private:source-profile', profileFingerprint: 'a'.repeat(64), environment: 'production', projectIdentityReference: 'private:source-project-identity',
    brokerReference: 'private:sealed-broker', expectedSnapshotRole: 'soce_source_snapshot_ro', notBefore: '2026-08-09T03:30:00.000Z', expiresAt: '2026-08-09T04:30:00.000Z',
    postgresVersionPolicy: { major: 17, minimumServerVersionNum: 170000, maximumServerVersionNum: 179999 },
  };
  const targetProfile = {
    profileReference: 'private:target-profile', profileFingerprint: 'b'.repeat(64), environment: 'staging', projectIdentityReference: 'private:target-project-identity',
    brokerReference: 'private:sealed-broker', expectedSnapshotRole: 'soce_target_snapshot_ro', notBefore: '2026-08-09T03:30:00.000Z', expiresAt: '2026-08-09T04:30:00.000Z',
    postgresVersionPolicy: { major: 17, minimumServerVersionNum: 170000, maximumServerVersionNum: 179999 },
  };
  const request = {
    executionPackageId: PACKAGE_ID, packageVersion: PACKAGE_VERSION, sourceProjectLabel: 'idea-nov-core', targetProjectLabel: 'idea-nov-staging',
    publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH, privateQueryPackManifestHash: '0'.repeat(64), noRetry: true, runId, packIds: QUERY_PACK_IDS,
    authorizationReference: 'approval:fixture', schemaContractHash: '0'.repeat(64),
  };
  const executionAuthorization = {
    authorizationReference: 'approval:fixture', runId, packageId: PACKAGE_ID, packageVersion: PACKAGE_VERSION,
    packageSha256: packageLock.packageSha256, queryPackSha256: packageLock.queryPackSha256, securityAllowlistSha256: packageLock.securityAllowlistSha256, executionPathSecuritySha256: packageLock.executionPathSecuritySha256, schemaContractSha256: packageLock.schemaContractSha256,
    approvedSchemaContractHash: '0'.repeat(64), privateQueryPackManifestHash: '0'.repeat(64), publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH,
    sourceProfileReference: sourceProfile.profileReference, sourceProfileFingerprint: sourceProfile.profileFingerprint,
    targetProfileReference: targetProfile.profileReference, targetProfileFingerprint: targetProfile.profileFingerprint,
    brokerReference: 'private:sealed-broker', brokerFingerprint: 'c'.repeat(64),
    sourceSnapshotRole: sourceProfile.expectedSnapshotRole, targetSnapshotRole: targetProfile.expectedSnapshotRole,
    operatorReference: 'principal:operator', reviewerReference: 'principal:reviewer', ownerReference: 'principal:owner',
    sourceRoleOwnerReference: 'principal:source-role-owner', targetRoleOwnerReference: 'principal:target-role-owner',
    brokerOwnerReference: 'principal:broker-owner', profileCustodianReference: 'principal:profile-custodian',
    authorizedAt: '2026-08-09T03:00:00.000Z', executionWindowStart: '2026-08-09T03:30:00.000Z', executionWindowEnd: '2026-08-09T04:30:00.000Z',
    snapshotOutputPolicy: 'sealed_private_snapshot_only',
  };
  const expectedSqlHashes = Object.fromEntries(FIXED_QUERY_REGISTRY.map((query) => [query.queryId, query.sqlSha256]));
  const expectedAstHashes = Object.fromEntries(SECURITY_ALLOWLIST.queries.map((query) => [query.queryId, query.astSha256]));
  const queryAttestationHash = hashCanonical(privateQueryAttestations(privateQueryPackManifest));
  const sourceConnection = new FakeSealedSnapshotConnection({ rowsByQuery: source, sealedPackManifestHash: privateQueryPackManifest.contentHash, queryAttestationHash, expectedSqlHashes, expectedAstHashes, expectedRole: sourceProfile.expectedSnapshotRole });
  const targetConnection = new FakeSealedSnapshotConnection({ rowsByQuery: target, sealedPackManifestHash: privateQueryPackManifest.contentHash, queryAttestationHash, expectedSqlHashes, expectedAstHashes, expectedRole: targetProfile.expectedSnapshotRole });
  const fixture = {
    request, executionAuthorization, sourceProfile, targetProfile, privateQueryPackManifest, approvedSchemaContract: null, source, target, sourceConnection, targetConnection,
    privateArtifactSink: new FakePrivateArtifactSink(), privateExecutionLedger: new FakePrivateExecutionLedger(),
    broker: new FakeSealedSnapshotBroker({ source: sourceConnection, target: targetConnection, profileMetadata: { source: structuredClone(sourceProfile), target: structuredClone(targetProfile) }, brokerMetadata: { brokerReference: 'private:sealed-broker', brokerFingerprint: 'c'.repeat(64) } }),
    stage0Records: () => ['SOCE-QP01-SOURCE-IDENTITY', 'SOCE-QP01-TARGET-IDENTITY', 'SOCE-QP01-SOURCE-READONLY', 'SOCE-QP01-TARGET-READONLY', 'SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP', 'SOCE-QP02-TARGET-SCHEMA-COLUMN-MAP'].map((queryId) => ({ queryId, rows: source[queryId] ?? target[queryId] })),
  };
  rebuildSchemaContract(fixture);
  return fixture;
}

function connectionAttempts(fixture) {
  return {
    broker: fixture.broker.brokerConnectionAttempts,
    source: fixture.broker.sourceConnectionAttempts,
    target: fixture.broker.targetConnectionAttempts,
    query: fixture.sourceConnection.executionCount + fixture.targetConnection.executionCount,
  };
}

function clonePackageFixture() {
  const root = mkdtempSync(join(tmpdir(), 'soce-package-'));
  cpSync(here, root, { recursive: true, filter: (path) => !path.endsWith('sealed-snapshot-package.test.mjs') });
  return root;
}

function replaceSingleCharacter(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const index = content.indexOf('SELECT');
  writeFileSync(filePath, `${content.slice(0, index)}s${content.slice(index + 1)}`, 'utf8');
}

await test('registry fixes 16 actual SQL artifacts, versions, schemas, and byte hashes', () => {
  assert.equal(FIXED_QUERY_PACKS.length, 6);
  assert.equal(FIXED_QUERY_IDS.length, 16);
  assert.equal(Object.hasOwn(publicQueryCatalogShape()[0].outputSchemas[0], 'sqlSha256'), true);
  assert.doesNotThrow(() => assertFixedQueryRegistry());
  for (const query of FIXED_QUERY_REGISTRY) {
    const isReadOnlyRoleAttestation = query.queryId.endsWith('-READONLY');
    const isTargetPrestateCorrective = query.queryId === 'SOCE-QP06-TARGET-PRESTATE';
    const isCanonicalOperatorCorrective = query.queryId === 'SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY';
    const isSourceSchemaCorrective = query.queryId === 'SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP';
    assert.equal(query.queryVersion, isReadOnlyRoleAttestation ? '1.2.0' : isTargetPrestateCorrective || isSourceSchemaCorrective ? '1.0.1' : isCanonicalOperatorCorrective ? '1.0.2' : '1.0.0');
    assert.equal(query.expectedOutputSchemaVersion, isReadOnlyRoleAttestation ? '1.2.0' : isTargetPrestateCorrective || isSourceSchemaCorrective ? '1.0.1' : isCanonicalOperatorCorrective ? '1.0.2' : '1.0.0');
    assert.equal(Object.keys(query.expectedTypes).length, query.expectedColumns.length);
    assert.equal(typeof query.sqlFile, 'string');
    assert.equal(verifySqlArtifact(query).sqlSha256, query.sqlSha256);
  }
  for (const queryId of ['SOCE-QP01-SOURCE-READONLY', 'SOCE-QP01-TARGET-READONLY']) {
    const sqlText = verifySqlArtifact(getFixedQuery(queryId)).sqlText;
    for (const requiredToken of [
      'WITH RECURSIVE',
      'pg_auth_members',
      'inherit_option',
      'set_option',
      'admin_option',
      'pg_database',
      'pg_namespace',
      'pg_class',
      'pg_proc',
      'pg_type',
      'pg_extension',
      "'TEMPORARY'",
      "'REFERENCES'",
      "'TRIGGER'",
      'has_sequence_privilege',
      'has_function_privilege',
      'application_schema_set_md5',
      'read_only_role_contract_passed',
    ]) assert.equal(sqlText.includes(requiredToken), true, `${queryId} missing ${requiredToken}`);
  }
});

await test('missing query version, SQL path, or SQL hash is rejected by the registry contract', () => {
  for (const field of ['queryVersion', 'sqlFile', 'sqlSha256']) {
    const registry = FIXED_QUERY_REGISTRY.map((query) => ({ ...query }));
    delete registry[0][field];
    assert.throws(() => assertFixedQueryRegistry(registry), /FIXED_QUERY_REGISTRY_REJECTED/);
  }
});

await test('fixture-only happy path executes exactly 16 fixed SQL artifacts and atomically commits one final bundle', async () => {
  const fixture = makeFixture();
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.runStatus, 'complete', result.failureCode);
  assert.equal(result.queryCount, 16);
  assert.equal(result.stage0, 'pass');
  assert.equal(result.stage1, 'pass');
  assert.equal(fixture.privateArtifactSink.stateCounts().prepared, 0);
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 1);
  assert.equal(fixture.privateArtifactSink.stateCounts().readable, 1);
  assert.equal(result.sanitizedEvidence.length, 17);
  assert.equal(result.executionLedgerState, 'COMPLETE');
  assert.equal(JSON.stringify(result).includes('employee-am-1'), false);
  assert.equal(connectionAttempts(fixture).query, 16);
  const executedSqlByteHashes = fixture.sourceConnection.sqlByteHashes.concat(fixture.targetConnection.sqlByteHashes)
    .sort((left, right) => left.queryId.localeCompare(right.queryId));
  assert.deepEqual(executedSqlByteHashes, FIXED_QUERY_REGISTRY.map(({ queryId, sqlSha256 }) => ({ queryId, sqlSha256, astSha256: SECURITY_ALLOWLIST.queries.find((entry) => entry.queryId === queryId).astSha256 }))
    .sort((left, right) => left.queryId.localeCompare(right.queryId)));
  assert.equal(fixture.sourceConnection.events.includes('rollback'), true);
  assert.equal(fixture.targetConnection.events.includes('close'), true);
});

await test('cleanup receipt is hash-bound in both manifest and sanitized evidence', async () => {
  const fixture = makeFixture();
  const result = await runSealedSnapshot(fixture);
  const record = fixture.privateArtifactSink.records.find((entry) => entry.status === 'committed');
  const evidence = record.sanitizedEvidence.find((entry) => entry.evidence_type === 'cleanup_receipt');
  assert.equal(result.runStatus, 'complete');
  assert.doesNotThrow(() => assertCleanupReceipt(evidence.cleanupReceipt, { requirePassing: true }));
  assert.equal(record.privateManifest.canonicalPayload.cleanupReceiptSha256, evidence.cleanupReceiptSha256);
  assert.equal(record.privateManifest.canonicalPayload.cleanupOverallStatus, 'pass');
  assert.equal(record.privateManifest.canonicalPayload.failedCleanupCount, 0);
});

await test('SQL character mutation is rejected by the static query hash before run claim or any connection', async () => {
  const root = clonePackageFixture();
  try {
    const file = join(root, FIXED_QUERY_REGISTRY[0].sqlFile);
    replaceSingleCharacter(file);
    writeFileSync(join(root, 'execution-package-lock-v1-3-3.json'), `${JSON.stringify(deriveExecutionPackageLock({ packageRoot: root }), null, 2)}\n`, 'utf8');
    const fixture = makeFixture();
    const result = await runSealedSnapshot({ ...fixture, packageRoot: root });
    assert.equal(result.failureCode, 'FIXED_SQL_HASH_MISMATCH');
    assert.equal(fixture.privateExecutionLedger.records.size, 0);
    assert.deepEqual(connectionAttempts(fixture), { broker: 0, source: 0, target: 0, query: 0 });
    assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

await test('Package artifact mutation is rejected before run claim, broker connection, and database connection', async () => {
  const root = clonePackageFixture();
  try {
    replaceSingleCharacter(join(root, 'sanitizer.mjs'));
    assert.throws(() => verifyExecutionPackage({ packageRoot: root }), /PACKAGE_INTEGRITY_REJECTED/);
    const fixture = makeFixture();
    const result = await runSealedSnapshot({ ...fixture, packageRoot: root });
    assert.equal(result.failureCode, 'PACKAGE_INTEGRITY_REJECTED');
    assert.equal(fixture.privateExecutionLedger.records.size, 0);
    assert.deepEqual(connectionAttempts(fixture), { broker: 0, source: 0, target: 0, query: 0 });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

await test('run authorization package hash mismatch is rejected before run claim', async () => {
  const fixture = makeFixture();
  fixture.executionAuthorization.packageSha256 = '0'.repeat(64);
  fixture.privateExecutionLedger.authorizeRun({ runId: fixture.request.runId, bindingHash: hashCanonical(fixture.executionAuthorization) });
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'EXECUTION_AUTHORIZATION_REJECTED');
  assert.equal(fixture.privateExecutionLedger.records.size, 0);
  assert.deepEqual(connectionAttempts(fixture), { broker: 0, source: 0, target: 0, query: 0 });
});

await test('Stage 0 schema mismatch stops before domain queries and any artifact', async () => {
  const fixture = makeFixture();
  rebuildSchemaContract(fixture, { expectedStage0Digest: '0'.repeat(64) });
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'SCHEMA_CONTRACT_MISMATCH');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.sourceConnection.events.some((event) => event.includes('SOCE-QP03')), false);
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
});

await test('writable role attestation is rejected and both opened sessions roll back', async () => {
  const fixture = makeFixture();
  fixture.sourceConnection.roleAttestation = { ...fixture.sourceConnection.roleAttestation, canUpdate: true };
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'READ_ONLY_ROLE_REJECTED');
  assert.equal(result.stage1, 'not_started');
  assert.deepEqual(connectionAttempts(fixture), { broker: 2, source: 1, target: 1, query: 0 });
  assert.equal(fixture.sourceConnection.events.includes('rollback'), true);
  assert.equal(fixture.targetConnection.events.includes('rollback'), true);
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
});

async function assertReadOnlyEvidenceRejects(field, value = 1) {
  const fixture = makeFixture({ runId: `run:readonly-${field}` });
  fixture.source['SOCE-QP01-SOURCE-READONLY'][0][field] = value;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'READ_ONLY_ROLE_REJECTED');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.sourceConnection.events.some((event) => event.includes('SOCE-QP03')), false);
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
}

for (const [name, field] of [
  ['database owner', 'owned_database_count'],
  ['application schema owner', 'owned_application_schema_count'],
  ['relation owner', 'owned_relation_count'],
  ['function owner', 'owned_function_count'],
  ['type owner', 'owned_type_count'],
  ['NOINHERIT SET ROLE writer', 'unsafe_reachable_role_count'],
  ['INHERIT writer', 'effective_update_privilege_count'],
  ['nested writer membership', 'effective_dml_privilege_count'],
]) {
  await test(`${name} read-only evidence rejects before Stage 1`, async () => {
    await assertReadOnlyEvidenceRejects(field);
  });
}

await test('PUBLIC-derived TEMP and routine EXECUTE evidence is observed but does not weaken the sealed path', async () => {
  const fixture = makeFixture({ runId: 'run:public-capability-observed' });
  fixture.source['SOCE-QP01-SOURCE-READONLY'][0].effective_temp_privilege_count = 1;
  fixture.source['SOCE-QP01-SOURCE-READONLY'][0].executable_application_routine_count = 17;
  rebuildSchemaContract(fixture);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.runStatus, 'complete', result.failureCode);
  assert.equal(fixture.sourceConnection.roleAttestation.executionPathTempBlocked, true);
  assert.equal(fixture.sourceConnection.roleAttestation.executionPathRoutineBlocked, true);
});

await test('any role membership is rejected even when the reached role is otherwise safe', async () => {
  const fixture = makeFixture({ runId: 'run:safe-membership' });
  const row = fixture.source['SOCE-QP01-SOURCE-READONLY'][0];
  row.reachable_role_count = 2;
  row.settable_role_count = 2;
  row.inherited_role_count = 2;
  row.membership_edge_count = 1;
  rebuildSchemaContract(fixture);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'READ_ONLY_ROLE_REJECTED');
  assert.equal(result.stage1, 'not_started');
});

await test('cycle-safe role path guard is fixed in both QP01 SQL artifacts', () => {
  for (const queryId of ['SOCE-QP01-SOURCE-READONLY', 'SOCE-QP01-TARGET-READONLY']) {
    const sqlText = verifySqlArtifact(getFixedQuery(queryId)).sqlText;
    assert.match(sqlText, /NOT membership\.roleid = ANY\(path\.role_path\)/);
  }
});

await test('QP01 missing field rejects before Stage 1 and final artifact creation', async () => {
  const fixture = makeFixture();
  delete fixture.source['SOCE-QP01-SOURCE-READONLY'][0].owned_database_count;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
});

await test('QP01 NULL field rejects before Stage 1 and final artifact creation', async () => {
  const fixture = makeFixture();
  fixture.source['SOCE-QP01-SOURCE-READONLY'][0].effective_temp_privilege_count = null;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
});

await test('QP01 application schema contract mismatch rejects before Stage 1', async () => {
  const fixture = makeFixture();
  rebuildSchemaContract(fixture, { sourceApplicationSchemaCount: 3 });
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'READ_ONLY_ROLE_REJECTED');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
});

await test('QP01 unsafe reachable role count rejects before Stage 1', async () => {
  await assertReadOnlyEvidenceRejects('unsafe_reachable_role_count');
});

await test('missing fixed output column stops before Stage 1 and final artifact creation', async () => {
  const fixture = makeFixture();
  delete fixture.source['SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP'][0].column_label;
  rebuildSchemaContract(fixture);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
});

await test('wrong fixed output type stops before Stage 1 and final artifact creation', async () => {
  const fixture = makeFixture();
  fixture.source['SOCE-QP01-SOURCE-IDENTITY'][0].server_version_num = '170002';
  rebuildSchemaContract(fixture);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
});

await test('PostgreSQL major version mismatch stops before Stage 1', async () => {
  const fixture = makeFixture();
  fixture.source['SOCE-QP01-SOURCE-IDENTITY'][0].server_version = '16.4';
  fixture.source['SOCE-QP01-SOURCE-IDENTITY'][0].server_version_num = 160004;
  rebuildSchemaContract(fixture);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'POSTGRES_VERSION_REJECTED');
  assert.equal(result.stage1, 'not_started');
});

await test('private exact PostgreSQL version policy is enforced', async () => {
  const fixture = makeFixture();
  fixture.sourceProfile.postgresVersionPolicy = { major: 17, exactServerVersionNum: 170003 };
  fixture.broker.profileMetadata.source.postgresVersionPolicy = structuredClone(fixture.sourceProfile.postgresVersionPolicy);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'POSTGRES_VERSION_REJECTED');
  assert.equal(result.stage1, 'not_started');
});

await test('private query manifest SQL hash mismatch is rejected before any connection', async () => {
  const fixture = makeFixture();
  fixture.privateQueryPackManifest.queries[0].sqlSha256 = '0'.repeat(64);
  const { contentHash: _oldHash, ...base } = fixture.privateQueryPackManifest;
  fixture.privateQueryPackManifest = { ...base, contentHash: hashPrivateQueryPackManifest(base) };
  fixture.request.privateQueryPackManifestHash = fixture.privateQueryPackManifest.contentHash;
  fixture.executionAuthorization.privateQueryPackManifestHash = fixture.privateQueryPackManifest.contentHash;
  fixture.privateExecutionLedger.authorizeRun({ runId: fixture.request.runId, bindingHash: hashCanonical(fixture.executionAuthorization) });
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'PRIVATE_QUERY_PACK_REJECTED');
  assert.deepEqual(connectionAttempts(fixture), { broker: 0, source: 0, target: 0, query: 0 });
});

await test('broker-side query attestation mismatch stops before QP01', async () => {
  const fixture = makeFixture();
  fixture.targetConnection.queryAttestationHash = '0'.repeat(64);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'PRIVATE_QUERY_PACK_REJECTED');
  assert.equal(result.stage0, 'not_started');
  assert.equal(connectionAttempts(fixture).query, 0);
});

await test('canonical record hashing is deterministic despite object and record order', () => {
  const left = [{ a: 'A', b: null }, { a: 'B', b: 'x' }];
  const right = [{ b: 'x', a: 'B' }, { b: null, a: 'A' }];
  assert.equal(hashRecordSet(left, ['a']), hashRecordSet(right, ['a']));
  assert.equal(hashCanonical({ alpha: 'e\u0301', beta: '\r\n' }), hashCanonical({ beta: '\n', alpha: '\u00e9' }));
});

await test('duplicate Store source evidence fails closed before local bundle creation', async () => {
  const fixture = makeFixture();
  fixture.source['SOCE-QP03-CLASSIFICATION-SUMMARY'][0].duplicate_store_key_count = 1;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'DOMAIN_VALIDATION_REJECTED');
  assert.equal(fixture.privateArtifactSink.stateCounts().localEphemeral, 0);
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
});

await test('Target pre-state mismatch fails closed before local bundle creation', async () => {
  const fixture = makeFixture();
  fixture.target['SOCE-QP06-TARGET-PRESTATE'][0].canonical_employee_count = 1;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'DOMAIN_VALIDATION_REJECTED');
  assert.equal(fixture.privateArtifactSink.stateCounts().localEphemeral, 0);
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
});

await test('Target pre-state rejects legacy Auth-subject evidence', async () => {
  const fixture = makeFixture({ runId: 'run:target-auth-boundary' });
  fixture.target['SOCE-QP06-TARGET-PRESTATE'][0].auth_subject_count = 0;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.executionLedgerState, 'FAILED');
  assert.equal(result.failureCode, 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID');
});

await test('query failure stops later queries, creates no final artifact, and marks the run FAILED', async () => {
  const fixture = makeFixture();
  fixture.sourceConnection.failQuery = 'SOCE-QP03-CLASSIFICATION-SUMMARY';
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.runStatus, 'safe_stop');
  assert.equal(fixture.sourceConnection.events.some((event) => event.includes('SOCE-QP04')), false);
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
  assert.equal(result.executionLedgerState, 'FAILED');
});

await test('unregistered Owner run is rejected before profile resolution or connection', async () => {
  const fixture = makeFixture({ runId: 'run:unregistered' });
  fixture.privateExecutionLedger.authorizedBindings.delete(fixture.request.runId);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'RUN_ID_REJECTED');
  assert.equal(fixture.broker.profileResolutionAttempts.source, 0);
  assert.deepEqual(connectionAttempts(fixture), { broker: 0, source: 0, target: 0, query: 0 });
});

await test('concurrent claims permit exactly one fixed execution', async () => {
  const first = makeFixture({ runId: 'run:concurrent' });
  const second = makeFixture({ runId: 'run:concurrent' });
  second.privateExecutionLedger = first.privateExecutionLedger;
  const [left, right] = await Promise.all([runSealedSnapshot(first), runSealedSnapshot(second)]);
  assert.equal([left.runStatus, right.runStatus].filter((state) => state === 'complete').length, 1);
  assert.equal([left.failureCode, right.failureCode].filter((code) => code === 'RUN_ID_REJECTED').length, 1);
});

await test('operator cannot also be reviewer', async () => {
  const fixture = makeFixture();
  fixture.executionAuthorization.reviewerReference = fixture.executionAuthorization.operatorReference;
  fixture.privateExecutionLedger.authorizeRun({ runId: fixture.request.runId, bindingHash: hashCanonical(fixture.executionAuthorization) });
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'EXECUTION_AUTHORIZATION_REJECTED');
  assert.equal(fixture.broker.profileResolutionAttempts.source, 0);
});

await test('missing role-owner attestation is rejected before a connection', async () => {
  const fixture = makeFixture();
  delete fixture.executionAuthorization.targetRoleOwnerReference;
  fixture.privateExecutionLedger.authorizeRun({ runId: fixture.request.runId, bindingHash: hashCanonical(fixture.executionAuthorization) });
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'EXECUTION_AUTHORIZATION_REJECTED');
  assert.deepEqual(connectionAttempts(fixture), { broker: 0, source: 0, target: 0, query: 0 });
});

await test('local bundle build failure leaves no remote prepared or valid final artifact', async () => {
  const fixture = makeFixture();
  fixture.privateArtifactSink = new FakePrivateArtifactSink({ failure: { build: true } });
  const result = await runSealedSnapshot(fixture);
  const counts = fixture.privateArtifactSink.stateCounts();
  assert.equal(result.runStatus, 'safe_stop');
  assert.equal(counts.prepared, 0);
  assert.equal(counts.validCommitted, 0);
  assert.equal(counts.readable, 0);
});

await test('local bundle digest mismatch leaves no valid final artifact', async () => {
  const fixture = makeFixture();
  fixture.privateArtifactSink = new FakePrivateArtifactSink({ failure: { digestMismatch: true } });
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.runStatus, 'safe_stop');
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
  assert.equal(fixture.privateArtifactSink.stateCounts().readable, 0);
});

await test('tampered cleanup evidence is rejected by the sanitizer contract', async () => {
  const fixture = makeFixture();
  await runSealedSnapshot(fixture);
  const record = fixture.privateArtifactSink.records.find((entry) => entry.status === 'committed');
  const evidence = structuredClone(record.sanitizedEvidence);
  evidence.at(-1).cleanupReceipt.rawResultsDeleted = 'failed';
  assert.throws(() => assertSanitizedEvidence(evidence), /SANITIZED_EVIDENCE_REJECTED/);
});

await test('project identity mismatch resolves metadata only and opens no connection', async () => {
  const fixture = makeFixture();
  fixture.broker.profileMetadata.source.projectIdentityReference = 'private:other-project';
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'PROFILE_REJECTED');
  assert.deepEqual(connectionAttempts(fixture), { broker: 0, source: 0, target: 0, query: 0 });
});

await test('missing broker-held profile metadata resolves only and opens no connection', async () => {
  const fixture = makeFixture();
  delete fixture.broker.profileMetadata.target.expiresAt;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'PROFILE_REJECTED');
  assert.equal(fixture.broker.profileResolutionAttempts.target, 1);
  assert.deepEqual(connectionAttempts(fixture), { broker: 0, source: 0, target: 0, query: 0 });
});

await test('changed Pack order is rejected before run claim', async () => {
  const fixture = makeFixture();
  fixture.request.packIds = [...fixture.request.packIds].reverse();
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'REQUEST_REJECTED');
  assert.equal(fixture.privateExecutionLedger.records.size, 0);
  assert.deepEqual(connectionAttempts(fixture), { broker: 0, source: 0, target: 0, query: 0 });
});

for (const [name, mutate] of [
  ['source reference', (fixture) => { fixture.broker.profileMetadata.source.profileReference = 'private:other-source'; }],
  ['target reference', (fixture) => { fixture.broker.profileMetadata.target.profileReference = 'private:other-target'; }],
  ['source fingerprint', (fixture) => { fixture.broker.profileMetadata.source.profileFingerprint = 'd'.repeat(64); }],
  ['target fingerprint', (fixture) => { fixture.broker.profileMetadata.target.profileFingerprint = 'e'.repeat(64); }],
  ['environment', (fixture) => { fixture.broker.profileMetadata.source.environment = 'staging'; }],
  ['broker reference', (fixture) => { fixture.broker.brokerMetadata.brokerReference = 'private:other-broker'; }],
  ['not-before', (fixture) => { fixture.targetProfile.notBefore = '2026-08-09T04:01:00.000Z'; fixture.broker.profileMetadata.target.notBefore = fixture.targetProfile.notBefore; }],
  ['expired', (fixture) => { fixture.sourceProfile.expiresAt = '2026-08-09T03:59:00.000Z'; fixture.broker.profileMetadata.source.expiresAt = fixture.sourceProfile.expiresAt; }],
]) {
  await test(`profile ${name} mismatch resolves metadata only and opens no connection`, async () => {
    const fixture = makeFixture({ runId: `run:profile-${name.replaceAll(' ', '-')}` });
    mutate(fixture);
    const result = await runSealedSnapshot(fixture);
    assert.equal(result.failureCode, 'PROFILE_REJECTED', name);
    assert.equal(fixture.broker.profileResolutionAttempts.source >= 1, true, name);
    assert.equal(fixture.broker.brokerConnectionAttempts, 0, name);
    assert.equal(fixture.broker.sourceConnectionAttempts, 0, name);
    assert.equal(fixture.broker.targetConnectionAttempts, 0, name);
    assert.equal(connectionAttempts(fixture).query, 0, name);
    assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0, name);
  });
}

await test('valid profile metadata permits the fixture path without exposing a profile value', async () => {
  const fixture = makeFixture();
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.runStatus, 'complete');
  assert.equal(fixture.broker.profileResolutionAttempts.source, 1);
  assert.equal(fixture.broker.profileResolutionAttempts.target, 1);
});

await test('local bundle validation and abort failure quarantine an unreadable non-final artifact', async () => {
  const fixture = makeFixture();
  fixture.privateArtifactSink = new FakePrivateArtifactSink({ failure: { validation: true, abort: true } });
  const result = await runSealedSnapshot(fixture);
  const counts = fixture.privateArtifactSink.stateCounts();
  assert.equal(result.runStatus, 'safe_stop');
  assert.equal(counts.prepared, 0);
  assert.equal(counts.validCommitted, 0);
  assert.equal(counts.readable, 0);
  assert.equal(counts.quarantined, 1);
  assert.equal(counts.cleanupQueue, 1);
  assert.equal(result.executionLedgerState, 'FAILED');
});

await test('commit or post-commit verification failure leaves no valid readable artifact', async () => {
  for (const failure of [{ commit: true }, { commitPostverify: true }]) {
    const fixture = makeFixture();
    fixture.privateArtifactSink = new FakePrivateArtifactSink({ failure });
    const result = await runSealedSnapshot(fixture);
    const counts = fixture.privateArtifactSink.stateCounts();
    assert.equal(result.runStatus, 'safe_stop');
    assert.equal(counts.validCommitted, 0);
    assert.equal(counts.readable, 0);
  }
});

await test('cleanup receipt accepts legitimate not_created fields and rejects failed, missing, or modified receipts', () => {
  const allPass = buildCleanupReceipt(Object.fromEntries(CLEANUP_RECEIPT_FIELDS.map((field) => [field, 'pass'])));
  assert.doesNotThrow(() => assertCleanupReceipt(allPass, { requirePassing: true }));
  const notCreated = buildCleanupReceipt(Object.fromEntries(CLEANUP_RECEIPT_FIELDS.map((field, index) => [field, index === 0 ? 'not_created' : 'pass'])));
  assert.doesNotThrow(() => assertCleanupReceipt(notCreated, { requirePassing: true }));
  const failed = buildCleanupReceipt(Object.fromEntries(CLEANUP_RECEIPT_FIELDS.map((field, index) => [field, index === 0 ? 'failed' : 'pass'])));
  assert.throws(() => assertCleanupReceipt(failed, { requirePassing: true }), /RUNNER_CLEANUP_FAILED/);
  const tampered = { ...allPass, rawResultsDeleted: 'failed' };
  assert.throws(() => assertCleanupReceipt(tampered), /RUNNER_CLEANUP_FAILED/);
  const missing = { ...allPass };
  delete missing.cleanupReceiptSha256;
  assert.throws(() => assertCleanupReceipt(missing), /RUNNER_CLEANUP_FAILED/);
});

await test('pre-commit cleanup failure blocks final bundle commit', async () => {
  const fixture = makeFixture();
  fixture.privateArtifactSink = new FakePrivateArtifactSink({ failure: { 'cleanup:pre_commit': true } });
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.runStatus, 'safe_stop');
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
  assert.equal(fixture.privateArtifactSink.stateCounts().readable, 0);
});

await test('final cleanup failure revokes an already committed bundle and fails the run', async () => {
  const fixture = makeFixture();
  fixture.privateArtifactSink = new FakePrivateArtifactSink({ failure: { 'cleanup:final': true } });
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.runStatus, 'safe_stop');
  assert.equal(fixture.privateArtifactSink.stateCounts().validCommitted, 0);
  assert.equal(fixture.privateArtifactSink.stateCounts().revoked, 1);
  assert.equal(result.executionLedgerState, 'FAILED');
});

await test('duplicate and failed run IDs cannot be retried', async () => {
  const fixture = makeFixture({ runId: 'run:complete-no-retry' });
  assert.equal((await runSealedSnapshot(fixture)).runStatus, 'complete');
  assert.equal((await runSealedSnapshot(fixture)).failureCode, 'RUN_ID_REJECTED');
  const failed = makeFixture({ runId: 'run:failed-no-retry' });
  failed.sourceConnection.failQuery = 'SOCE-QP03-CLASSIFICATION-SUMMARY';
  assert.equal((await runSealedSnapshot(failed)).executionLedgerState, 'FAILED');
  failed.sourceConnection.failQuery = null;
  assert.equal((await runSealedSnapshot(failed)).failureCode, 'RUN_ID_REJECTED');
});

await test('sanitizer exposes only query digests and cleanup receipt metadata', () => {
  const query = FIXED_QUERY_REGISTRY.find((entry) => entry.queryId === 'SOCE-QP04-AM-ASSIGNMENT-EVIDENCE');
  assert.throws(() => assertPrivateRows(query, [{ employee_email: 'not-allowed' }]), /PRIVATE_OUTPUT_FIELD_REJECTED/);
  const evidence = sanitizeQueryEvidence(query, [{ canonical_employee_key: 'employee-a', canonical_store_key: 'store-a', assignment_kind: 'primary', assignment_status: 'active', effective_from: '2026-01-01', effective_to: null, relation_version: 'v1' }]);
  assert.deepEqual(Object.keys(evidence).sort(), ['entity_digest', 'output_schema_digest', 'query_id', 'result_category', 'row_count', 'status']);
  assert.equal(hashRecordSet([{ a: 'A' }, { a: 'B' }], ['a']), hashRecordSet([{ a: 'B' }, { a: 'A' }], ['a']));
});

await test('canonical assignment resolves exactly one operator without Auth principal evidence', () => {
  const summary = buildRows().source['SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY'][0];
  const operator = resolveCanonicalOperator({
    summary,
    expectedEmployeeUuid: summary.sales_department_head_employee_key,
    expectedEmployeeNumber: '69',
    reviewerPrincipal: 'principal:idea-nov-os-owner',
  });
  assert.equal(operator.assignmentCode, 'department_head');
  assert.equal(Object.hasOwn(operator, 'authSubjectId'), false);
});

await test('duplicate, inactive, expired, wrong department, or wrong assignment cannot resolve', () => {
  const base = buildRows().source['SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY'][0];
  for (const patch of [
    { sales_department_head_candidate_count: 2 },
    { sales_department_head_candidate_count: 0, sales_department_head_state: 'unresolved' },
    { sales_department_head_employee_key: null },
    { sales_department_head_employee_number: null },
  ]) assert.throws(() => resolveCanonicalOperator({ summary: { ...base, ...patch }, expectedEmployeeUuid: base.sales_department_head_employee_key, expectedEmployeeNumber: '69', reviewerPrincipal: 'principal:idea-nov-os-owner' }), /OPERATOR_CANONICAL_BINDING_REJECTED/);
});

await test('reviewer cannot be the resolved operator', () => {
  const summary = buildRows().source['SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY'][0];
  assert.throws(() => resolveCanonicalOperator({ summary, expectedEmployeeUuid: summary.sales_department_head_employee_key, expectedEmployeeNumber: '69', reviewerPrincipal: `canonical-employee:${summary.sales_department_head_employee_key}` }), /OPERATOR_REVIEWER_SEPARATION_REJECTED/);
});

await test('package source, SQL artifacts, and execution documentation contain no concrete secret, UUID, or PII literal', () => {
  const packageFiles = readdirSync(here, { recursive: true }).filter((file) => typeof file === 'string' && (file.endsWith('.mjs') || file.endsWith('.sql') || file.endsWith('.json')));
  const docsDirectory = join(dirname(dirname(here)), 'docs', 'security', 'store_operations_sealed_snapshot_v1');
  const docFiles = readdirSync(docsDirectory).filter((file) => file.endsWith('.md'));
  const source = packageFiles.filter((file) => !file.endsWith('.test.mjs')).map((file) => readFileSync(join(here, file), 'utf8'))
    .concat(docFiles.map((file) => readFileSync(join(docsDirectory, file), 'utf8'))).join('\n');
  for (const marker of ['postgresql://', 'postgres://', 'supabase.co', 'sbp_', 'eyJhbGciOi']) assert.equal(source.includes(marker), false);
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(source), false);
  assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(source), false);
});

assert.equal(passed, 65);
process.stdout.write(`RESULT ${passed}/65 PASS\n`);
