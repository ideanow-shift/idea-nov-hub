import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashCanonical, hashRecordSet } from './canonicalization.mjs';
import { FakePrivateArtifactSink, FakePrivateExecutionLedger, FakeSealedSnapshotBroker, FakeSealedSnapshotConnection } from './fake-broker.mjs';
import { FIXED_QUERY_IDS, FIXED_QUERY_REGISTRY, FIXED_QUERY_PACKS, PUBLIC_QUERY_CATALOG_HASH, QUERY_PACK_IDS, publicQueryCatalogShape } from './query-pack-registry.mjs';
import { assertPrivateRows, sanitizeQueryEvidence } from './sanitizer.mjs';
import { hashPrivateQueryPackManifest, hashSchemaContract, hashStage0Evidence, privateQueryAttestations } from './schema-contract.mjs';
import { runSealedSnapshot } from './sealed-snapshot-runner.mjs';

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
    transaction_read_only: 'on',
    default_transaction_read_only: 'on',
    insert_denied: true,
    update_denied: true,
    delete_denied: true,
    truncate_denied: true,
    ddl_denied: true,
    function_write_denied: true,
    bypassrls_denied: true,
    role_inheritance_denied: true,
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
      canonical_corporation_count: 6,
      official_store_count: 20,
      direct_store_count: 13,
      franchise_store_count: 7,
      non_store_row_count: 1,
      duplicate_store_key_count: 0,
      unresolved_store_count: 0,
      orphan_corporation_relation_count: 0,
      unknown_classification_count: 0,
    }],
    'SOCE-QP03-CANONICAL-STORE-ROWS': Array.from({ length: 20 }, (_, index) => ({
      canonical_corporation_key: `corp-${(index % 6) + 1}`,
      canonical_store_key: `store-${String(index + 1).padStart(2, '0')}`,
      store_label: `Synthetic Store ${String(index + 1).padStart(2, '0')}`,
      store_status: 'active',
      store_classification: index < 13 ? 'direct' : 'franchise',
      corporation_relation_state: 'effective',
      effective_from: '2026-01-01',
      effective_to: null,
      relation_version: 'v1',
      source_lineage_state: 'attested',
    })),
    'SOCE-QP03-TOKOROZAWA-LEGACY-RELATION': [{
      legacy_relation_state: 'confirmed',
      corporation_relation_state: 'effective',
      duplicate_relation_count: 0,
      unresolved_relation_count: 0,
      effective_from: '2026-01-01',
      effective_to: null,
    }],
    'SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY': [{
      representative_candidate_count: 1,
      vice_president_candidate_count: 1,
      sales_department_head_state: 'unresolved',
      area_manager_candidate_count: 2,
      store_manager_coverage_count: 20,
      missing_store_manager_count: 0,
      duplicate_store_manager_count: 0,
      orphan_assignment_count: 0,
    }],
    'SOCE-QP04-AM-ASSIGNMENT-EVIDENCE': [
      { canonical_employee_key: 'employee-am-1', canonical_store_key: 'store-01', assignment_kind: 'primary', assignment_status: 'active', effective_from: '2026-01-01', effective_to: null, relation_version: 'v1' },
      { canonical_employee_key: 'employee-am-2', canonical_store_key: 'store-02', assignment_kind: 'secondary', assignment_status: 'active', effective_from: '2026-01-01', effective_to: null, relation_version: 'v1' },
    ],
    'SOCE-QP04-STORE-MANAGER-COVERAGE': Array.from({ length: 20 }, (_, index) => ({
      canonical_store_key: `store-${String(index + 1).padStart(2, '0')}`,
      canonical_employee_key: `employee-manager-${String(index + 1).padStart(2, '0')}`,
      manager_role_state: 'active',
      assignment_status: 'active',
      effective_from: '2026-01-01',
      effective_to: null,
    })),
    'SOCE-QP05-IDENTITY-CROSSWALK-SUMMARY': [{
      crosswalk_candidate_count: 2,
      email_only_match_count: 0,
      display_name_only_match_count: 0,
      one_to_many_subject_count: 0,
      inactive_employee_count: 0,
      unresolved_crosswalk_count: 0,
    }],
    'SOCE-QP05-CONSUMER-ANCHOR-SOURCE-EVIDENCE': Array.from({ length: 12 }, (_, index) => ({
      canonical_employee_key: index < 6 ? 'employee-exec-1' : 'employee-exec-2',
      canonical_corporation_key: `corp-${(index % 6) + 1}`,
      consumer_application: 'store_operations',
      purpose: 'cross_corporation_consumer_anchor',
      evidence_state: 'attested',
      effective_from: '2026-01-01',
      effective_to: null,
    })),
  };
  const target = {
    'SOCE-QP01-TARGET-IDENTITY': [identityRow('target', 'staging')],
    'SOCE-QP01-TARGET-READONLY': [readOnlyRow('target')],
    'SOCE-QP02-TARGET-SCHEMA-COLUMN-MAP': [schemaRow('target')],
    'SOCE-QP06-TARGET-PRESTATE': [{
      canonical_corporation_count: 0,
      canonical_store_count: 0,
      canonical_employee_count: 0,
      canonical_role_count: 0,
      canonical_assignment_count: 0,
      identity_crosswalk_count: 0,
      auth_subject_count: 0,
      consumer_anchor_count: 0,
      consumer_access_contract_count: 0,
      partial_population_count: 0,
      duplicate_count: 0,
      orphan_count: 0,
    }],
    'SOCE-QP06-M019-PRESENCE': [{
      m019_migration_state: 'present',
      m019_access_contract_count: 0,
      m019_partial_population_count: 0,
    }],
  };
  return { source, target };
}

function queryBinding(query) {
  return {
    queryId: query.queryId,
    queryVersion: query.queryVersion,
    packId: query.packId,
    sqlSha256: hashCanonical({ fixtureOnly: true, queryId: query.queryId, queryVersion: query.queryVersion }),
    expectedColumns: [...query.expectedColumns],
    expectedTypes: structuredClone(query.expectedTypes),
    expectedOutputSchemaVersion: query.expectedOutputSchemaVersion,
  };
}

function buildPrivateQueryRegistry() {
  const queries = FIXED_QUERY_REGISTRY.map(queryBinding);
  const base = {
    manifestId: 'SOCE-PRIVATE-QUERY-REGISTRY-v1',
    executionState: 'sealed',
    publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH,
    packIds: QUERY_PACK_IDS,
    packs: QUERY_PACK_IDS.map((packId) => ({
      packId,
      queryIds: FIXED_QUERY_REGISTRY.filter((query) => query.packId === packId).map((query) => query.queryId),
      queryHashManifestHash: hashCanonical(queries.filter((query) => query.packId === packId)),
    })),
    queries,
  };
  return { ...base, contentHash: hashPrivateQueryPackManifest(base) };
}

function rebuildSchemaContract(fixture, overrides = {}) {
  const base = {
    contractId: 'SOCE-SCHEMA-COLUMN-CONTRACT-v1',
    executionState: 'approved',
    sourceProjectLabel: 'idea-nov-core',
    targetProjectLabel: 'idea-nov-staging',
    approvalReference: 'approval:fixture',
    packIds: QUERY_PACK_IDS,
    publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH,
    expectedObjectSetHash: hashCanonical({ fixture: 'logical-object-set-only' }),
    expectedStage0Digest: hashStage0Evidence(fixture.stage0Records()),
    privateQueryPackManifestHash: fixture.privateQueryPackManifest.contentHash,
    ...overrides,
  };
  fixture.approvedSchemaContract = { ...base, schemaContractHash: hashSchemaContract(base) };
  fixture.request.schemaContractHash = fixture.approvedSchemaContract.schemaContractHash;
  fixture.executionAuthorization.schemaContractHash = fixture.approvedSchemaContract.schemaContractHash;
  fixture.privateExecutionLedger?.authorizeRun({ runId: fixture.request.runId, bindingHash: hashCanonical(fixture.executionAuthorization) });
}

function makeFixture({ runId = 'run:fixture' } = {}) {
  const { source, target } = buildRows();
  const privateQueryPackManifest = buildPrivateQueryRegistry();
  const request = {
    executionPackageId: 'store-operations-consumer-enablement-sealed-snapshot-v1',
    sourceProjectLabel: 'idea-nov-core',
    targetProjectLabel: 'idea-nov-staging',
    publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH,
    noRetry: true,
    runId,
    packIds: QUERY_PACK_IDS,
    authorizationReference: 'approval:fixture',
    schemaContractHash: '0'.repeat(64),
  };
  const executionAuthorization = {
    authorizationReference: 'approval:fixture',
    runId,
    packageId: request.executionPackageId,
    publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH,
    privateQueryPackManifestHash: privateQueryPackManifest.contentHash,
    schemaContractHash: '0'.repeat(64),
    ownerReference: 'principal:owner',
    operatorReference: 'principal:operator',
    reviewerReference: 'principal:reviewer',
    sourceRoleOwnerReference: 'principal:source-role-owner',
    targetRoleOwnerReference: 'principal:target-role-owner',
    brokerOwnerReference: 'principal:broker-owner',
    profileCustodianReference: 'principal:profile-custodian',
    authorizedAt: '2026-08-09T03:00:00.000Z',
    executionWindowStart: '2026-08-09T03:30:00.000Z',
    executionWindowEnd: '2026-08-09T04:30:00.000Z',
  };
  const profiles = {
    sourceProfile: {
      environment: 'production',
      projectLabel: 'idea-nov-core',
      profileRef: 'private:source-profile',
      profileFingerprint: 'a'.repeat(64),
      brokerRef: 'private:sealed-broker',
      brokerFingerprint: 'c'.repeat(64),
      notBefore: '2026-08-09T03:30:00.000Z',
      expiresAt: '2026-08-09T04:30:00.000Z',
      postgresVersionPolicy: { major: 17, minimumServerVersionNum: 170000, maximumServerVersionNum: 179999 },
    },
    targetProfile: {
      environment: 'staging',
      projectLabel: 'idea-nov-staging',
      profileRef: 'private:target-profile',
      profileFingerprint: 'b'.repeat(64),
      brokerRef: 'private:sealed-broker',
      brokerFingerprint: 'c'.repeat(64),
      notBefore: '2026-08-09T03:30:00.000Z',
      expiresAt: '2026-08-09T04:30:00.000Z',
      postgresVersionPolicy: { major: 17, minimumServerVersionNum: 170000, maximumServerVersionNum: 179999 },
    },
  };
  const queryAttestationHash = hashCanonical(privateQueryAttestations(privateQueryPackManifest));
  const sourceConnection = new FakeSealedSnapshotConnection({ rowsByQuery: source, sealedPackManifestHash: privateQueryPackManifest.contentHash, queryAttestationHash });
  const targetConnection = new FakeSealedSnapshotConnection({ rowsByQuery: target, sealedPackManifestHash: privateQueryPackManifest.contentHash, queryAttestationHash });
  const fixture = {
    request,
    executionAuthorization,
    ...profiles,
    privateQueryPackManifest,
    approvedSchemaContract: null,
    source,
    target,
    sourceConnection,
    targetConnection,
    broker: new FakeSealedSnapshotBroker({ source: sourceConnection, target: targetConnection }),
    privateArtifactSink: new FakePrivateArtifactSink(),
    privateExecutionLedger: new FakePrivateExecutionLedger(),
    stage0Records: () => [
      'SOCE-QP01-SOURCE-IDENTITY',
      'SOCE-QP01-TARGET-IDENTITY',
      'SOCE-QP01-SOURCE-READONLY',
      'SOCE-QP01-TARGET-READONLY',
      'SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP',
      'SOCE-QP02-TARGET-SCHEMA-COLUMN-MAP',
    ].map((queryId) => ({ queryId, rows: source[queryId] ?? target[queryId] })),
  };
  rebuildSchemaContract(fixture);
  return fixture;
}

function openedEvents(broker) {
  return broker.events.filter((event) => event.startsWith('open:'));
}

function authorizeFixture(fixture) {
  fixture.privateExecutionLedger.authorizeRun({ runId: fixture.request.runId, bindingHash: hashCanonical(fixture.executionAuthorization) });
}

await test('registry fixes 16 SQL-free query identities, versions, output types, and schemas', () => {
  assert.equal(FIXED_QUERY_PACKS.length, 6);
  assert.equal(FIXED_QUERY_IDS.length, 16);
  assert.equal(Object.hasOwn(publicQueryCatalogShape()[0].outputSchemas[0], 'sqlSha256'), false);
  for (const query of FIXED_QUERY_REGISTRY) {
    assert.equal(query.queryVersion, '1.0.0');
    assert.equal(query.expectedOutputSchemaVersion, '1.0.0');
    assert.equal(Object.keys(query.expectedTypes).length, query.expectedColumns.length);
    assert.equal(Object.hasOwn(query, 'sql'), false);
  }
});

await test('fixture-only happy path verifies all 16 per-query hashes and atomically commits one bundle', async () => {
  const fixture = makeFixture();
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.runStatus, 'complete', `${result.failureCode}:${result.failureQueryId ?? 'none'}`);
  assert.equal(result.queryCount, 16);
  assert.equal(result.stage0, 'pass');
  assert.equal(result.stage1, 'pass');
  assert.equal(fixture.privateArtifactSink.records.length, 1);
  assert.equal(fixture.privateArtifactSink.prepared.size, 0);
  assert.equal(result.sanitizedEvidence.length, 16);
  assert.equal(result.executionLedgerState, 'COMPLETE');
  assert.equal(JSON.stringify(result).includes('employee-am-1'), false);
  assert.equal(fixture.sourceConnection.events.includes('rollback'), true);
  assert.equal(fixture.targetConnection.events.includes('close'), true);
  assert.equal(fixture.privateArtifactSink.events.includes('cleanup:pre_commit'), true);
  assert.equal(fixture.privateArtifactSink.events.includes('cleanup:final'), true);
});

await test('missing PostgreSQL version field stops before any Stage 1 query or artifact', async () => {
  const fixture = makeFixture();
  delete fixture.source['SOCE-QP01-SOURCE-IDENTITY'][0].server_version;
  rebuildSchemaContract(fixture);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.sourceConnection.events.some((event) => event.includes('SOCE-QP03')), false);
  assert.equal(fixture.privateArtifactSink.records.length, 0);
});

await test('PostgreSQL major-version mismatch stops before Stage 1 and Snapshot creation', async () => {
  const fixture = makeFixture();
  fixture.source['SOCE-QP01-SOURCE-IDENTITY'][0].server_version = '16.4';
  fixture.source['SOCE-QP01-SOURCE-IDENTITY'][0].server_version_num = 160004;
  rebuildSchemaContract(fixture);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'POSTGRES_VERSION_REJECTED');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.privateArtifactSink.records.length, 0);
});

await test('private exact/min/max PostgreSQL policy is enforced without a repository patch-version claim', async () => {
  const exact = makeFixture();
  exact.sourceProfile = { ...exact.sourceProfile, postgresVersionPolicy: { major: 17, exactServerVersionNum: 170003 } };
  assert.equal((await runSealedSnapshot(exact)).failureCode, 'POSTGRES_VERSION_REJECTED');

  const bounded = makeFixture();
  bounded.targetProfile = { ...bounded.targetProfile, postgresVersionPolicy: { major: 17, minimumServerVersionNum: 170000, maximumServerVersionNum: 170001 } };
  assert.equal((await runSealedSnapshot(bounded)).failureCode, 'POSTGRES_VERSION_REJECTED');
});

await test('schema digest mismatch stops after Stage 0 and before domain extraction', async () => {
  const fixture = makeFixture();
  rebuildSchemaContract(fixture, { expectedStage0Digest: '0'.repeat(64) });
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'SCHEMA_CONTRACT_MISMATCH');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.sourceConnection.events.some((event) => event.includes('SOCE-QP03')), false);
  assert.equal(fixture.privateArtifactSink.records.length, 0);
});

await test('missing fixed output column or wrong scalar type is rejected before Stage 1', async () => {
  const missing = makeFixture();
  delete missing.source['SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP'][0].column_label;
  rebuildSchemaContract(missing);
  assert.equal((await runSealedSnapshot(missing)).failureCode, 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID');

  const invalidType = makeFixture();
  invalidType.source['SOCE-QP01-SOURCE-IDENTITY'][0].server_version_num = '170002';
  rebuildSchemaContract(invalidType);
  assert.equal((await runSealedSnapshot(invalidType)).failureCode, 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID');
});

await test('wrong source project profile opens no connection', async () => {
  const fixture = makeFixture();
  fixture.sourceProfile = { ...fixture.sourceProfile, projectLabel: 'idea-nov-staging' };
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'PROFILE_REJECTED');
  assert.deepEqual(openedEvents(fixture.broker), []);
  assert.equal(fixture.privateArtifactSink.records.length, 0);
});

await test('expired or not-yet-valid private profile opens no broker connection', async () => {
  const expired = makeFixture();
  expired.sourceProfile = { ...expired.sourceProfile, expiresAt: '2026-08-09T03:59:00.000Z' };
  assert.equal((await runSealedSnapshot(expired)).failureCode, 'PROFILE_REJECTED');
  assert.deepEqual(openedEvents(expired.broker), []);

  const future = makeFixture();
  future.targetProfile = { ...future.targetProfile, notBefore: '2026-08-09T04:01:00.000Z' };
  assert.equal((await runSealedSnapshot(future)).failureCode, 'PROFILE_REJECTED');
  assert.deepEqual(openedEvents(future.broker), []);
});

await test('private broker profile preflight failure opens no database connection', async () => {
  const fixture = makeFixture();
  fixture.broker.profilePreflight.source = false;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'PROFILE_REJECTED');
  assert.deepEqual(openedEvents(fixture.broker), []);
  assert.equal(fixture.privateExecutionLedger.records.get(fixture.request.runId).state, 'FAILED');
});

await test('writable or inherited role attestation is rejected and both sessions are rolled back', async () => {
  for (const change of [{ canUpdate: true }, { inheritsPrivileges: true }]) {
    const fixture = makeFixture();
    fixture.sourceConnection.roleAttestation = { ...fixture.sourceConnection.roleAttestation, ...change };
    const result = await runSealedSnapshot(fixture);
    assert.equal(result.failureCode, 'READ_ONLY_ROLE_REJECTED');
    assert.equal(fixture.sourceConnection.events.includes('rollback'), true);
    assert.equal(fixture.targetConnection.events.includes('rollback'), true);
    assert.equal(fixture.privateArtifactSink.records.length, 0);
  }
});

await test('private per-query SQL hash mismatch is rejected before opening either connection', async () => {
  const fixture = makeFixture();
  fixture.privateQueryPackManifest.queries[0].sqlSha256 = '0'.repeat(64);
  const { contentHash: _oldHash, ...base } = fixture.privateQueryPackManifest;
  fixture.privateQueryPackManifest = { ...base, contentHash: hashPrivateQueryPackManifest(base) };
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'PRIVATE_QUERY_PACK_REJECTED');
  assert.deepEqual(openedEvents(fixture.broker), []);
});

await test('broker-side SQL hash attestation mismatch rolls back before QP01', async () => {
  const fixture = makeFixture();
  fixture.targetConnection.queryAttestationHash = '0'.repeat(64);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'PRIVATE_QUERY_PACK_REJECTED');
  assert.equal(result.stage0, 'not_started');
  assert.equal(fixture.sourceConnection.events.includes('rollback'), true);
  assert.equal(fixture.targetConnection.events.includes('rollback'), true);
});

await test('sanitizer rejects PII-like output fields and exposes only count and digest', () => {
  const query = FIXED_QUERY_REGISTRY.find((entry) => entry.queryId === 'SOCE-QP04-AM-ASSIGNMENT-EVIDENCE');
  assert.throws(() => assertPrivateRows(query, [{ employee_email: 'not-allowed' }]), /PRIVATE_OUTPUT_FIELD_REJECTED/);
  const evidence = sanitizeQueryEvidence(query, [{ canonical_employee_key: 'employee-a', canonical_store_key: 'store-a', assignment_kind: 'primary', assignment_status: 'active', effective_from: '2026-01-01', effective_to: null, relation_version: 'v1' }]);
  assert.deepEqual(Object.keys(evidence).sort(), ['entity_digest', 'output_schema_digest', 'query_id', 'result_category', 'row_count', 'status']);
});

await test('canonical hashes are deterministic despite object and record order', () => {
  const left = [{ a: 'A', b: null }, { a: 'B', b: 'x' }];
  const right = [{ b: 'x', a: 'B' }, { b: null, a: 'A' }];
  assert.equal(hashRecordSet(left, ['a']), hashRecordSet(right, ['a']));
  assert.equal(hashCanonical({ alpha: 'e\u0301', beta: '\r\n' }), hashCanonical({ beta: '\n', alpha: '\u00e9' }));
});

await test('duplicate or orphan source evidence fails closed before artifact preparation', async () => {
  const fixture = makeFixture();
  fixture.source['SOCE-QP03-CLASSIFICATION-SUMMARY'][0].duplicate_store_key_count = 1;
  rebuildSchemaContract(fixture);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'DOMAIN_VALIDATION_REJECTED');
  assert.equal(fixture.privateArtifactSink.records.length, 0);
  assert.equal(fixture.privateArtifactSink.prepared.size, 0);
});

await test('target pre-state mismatch fails closed before artifact preparation', async () => {
  const fixture = makeFixture();
  fixture.target['SOCE-QP06-TARGET-PRESTATE'][0].canonical_employee_count = 1;
  rebuildSchemaContract(fixture);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'DOMAIN_VALIDATION_REJECTED');
  assert.equal(fixture.privateArtifactSink.records.length, 0);
});

await test('query failure clears temporary state, creates no artifact, and marks run FAILED', async () => {
  const fixture = makeFixture();
  fixture.sourceConnection.failQuery = 'SOCE-QP03-CLASSIFICATION-SUMMARY';
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.runStatus, 'safe_stop');
  assert.equal(fixture.privateArtifactSink.records.length, 0);
  assert.equal(fixture.privateArtifactSink.prepared.size, 0);
  assert.equal(result.executionLedgerState, 'FAILED');
  assert.equal(fixture.privateArtifactSink.events.includes('cleanup:failure'), true);
});

await test('unregistered Owner execution binding is rejected before a broker connection', async () => {
  const fixture = makeFixture({ runId: 'run:unregistered' });
  fixture.privateExecutionLedger.authorizedBindings.delete(fixture.request.runId);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'RUN_ID_REJECTED');
  assert.deepEqual(openedEvents(fixture.broker), []);
});

await test('duplicate COMPLETE run_id is rejected before a second connection attempt', async () => {
  const fixture = makeFixture({ runId: 'run:duplicate-complete' });
  assert.equal((await runSealedSnapshot(fixture)).runStatus, 'complete');
  const opensBefore = openedEvents(fixture.broker).length;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'RUN_ID_REJECTED');
  assert.equal(openedEvents(fixture.broker).length, opensBefore);
});

await test('FAILED run_id cannot be retried under the same authorization', async () => {
  const fixture = makeFixture({ runId: 'run:failed-no-retry' });
  fixture.sourceConnection.failQuery = 'SOCE-QP03-CLASSIFICATION-SUMMARY';
  assert.equal((await runSealedSnapshot(fixture)).executionLedgerState, 'FAILED');
  fixture.sourceConnection.failQuery = null;
  const opensBefore = openedEvents(fixture.broker).length;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'RUN_ID_REJECTED');
  assert.equal(openedEvents(fixture.broker).length, opensBefore);
});

await test('concurrent claims for the same run_id permit exactly one run', async () => {
  const first = makeFixture({ runId: 'run:concurrent' });
  const second = makeFixture({ runId: 'run:concurrent' });
  second.privateExecutionLedger = first.privateExecutionLedger;
  const [left, right] = await Promise.all([runSealedSnapshot(first), runSealedSnapshot(second)]);
  assert.equal([left.runStatus, right.runStatus].filter((state) => state === 'complete').length, 1);
  assert.equal([left.failureCode, right.failureCode].filter((code) => code === 'RUN_ID_REJECTED').length, 1, JSON.stringify({ left, right }));
});

await test('prepare or verification failure aborts the bundle with no final artifact', async () => {
  const prepareFailure = makeFixture();
  prepareFailure.privateArtifactSink = new FakePrivateArtifactSink({ failure: { prepare: true } });
  assert.equal((await runSealedSnapshot(prepareFailure)).failureCode, 'SEALED_ARTIFACT_REJECTED');
  assert.equal(prepareFailure.privateArtifactSink.records.length, 0);

  const verifyFailure = makeFixture();
  verifyFailure.privateArtifactSink = new FakePrivateArtifactSink({ failure: { verify: true } });
  assert.equal((await runSealedSnapshot(verifyFailure)).failureCode, 'SEALED_ARTIFACT_REJECTED');
  assert.equal(verifyFailure.privateArtifactSink.records.length, 0);
  assert.equal(verifyFailure.privateArtifactSink.prepared.size, 0);
  assert.equal(verifyFailure.privateArtifactSink.events.includes('abort'), true);
});

await test('commit failure or invalid committed reference leaves no final artifact', async () => {
  const commitFailure = makeFixture();
  commitFailure.privateArtifactSink = new FakePrivateArtifactSink({ failure: { commit: true } });
  assert.equal((await runSealedSnapshot(commitFailure)).failureCode, 'SEALED_ARTIFACT_REJECTED');
  assert.equal(commitFailure.privateArtifactSink.records.length, 0);

  const invalidReference = makeFixture();
  invalidReference.privateArtifactSink = new FakePrivateArtifactSink({ failure: { invalidCommitReference: true } });
  assert.equal((await runSealedSnapshot(invalidReference)).failureCode, 'SEALED_ARTIFACT_REJECTED');
  assert.equal(invalidReference.privateArtifactSink.records.length, 0);
  assert.equal(invalidReference.privateArtifactSink.events.includes('revoke'), true);
});

await test('cleanup receipt covers every component and cleanup failure revokes a committed bundle', async () => {
  const fixture = makeFixture();
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.connectionCleanup, 'pass');

  const cleanupFailure = makeFixture();
  cleanupFailure.privateArtifactSink = new FakePrivateArtifactSink({ failure: { 'cleanup:final': true } });
  const failed = await runSealedSnapshot(cleanupFailure);
  assert.equal(failed.failureCode, 'RUNNER_CLEANUP_FAILED');
  assert.equal(failed.executionLedgerState, 'FAILED');
  assert.equal(cleanupFailure.privateArtifactSink.records.length, 0);
  assert.equal(cleanupFailure.privateArtifactSink.events.includes('revoke'), true);

  const failureCleanup = makeFixture();
  failureCleanup.sourceConnection.failQuery = 'SOCE-QP03-CLASSIFICATION-SUMMARY';
  failureCleanup.privateArtifactSink = new FakePrivateArtifactSink({ failure: { 'cleanup:failure': true } });
  const stopped = await runSealedSnapshot(failureCleanup);
  assert.equal(stopped.failureCode, 'RUNNER_CLEANUP_FAILED');
  assert.equal(stopped.executionLedgerState, 'FAILED');
});

await test('operator cannot be reviewer or self-approve role, broker, or profile custody', async () => {
  const sameReviewer = makeFixture();
  sameReviewer.executionAuthorization.reviewerReference = sameReviewer.executionAuthorization.operatorReference;
  authorizeFixture(sameReviewer);
  assert.equal((await runSealedSnapshot(sameReviewer)).failureCode, 'EXECUTION_AUTHORIZATION_REJECTED');

  const selfApprovedRole = makeFixture();
  selfApprovedRole.executionAuthorization.sourceRoleOwnerReference = selfApprovedRole.executionAuthorization.operatorReference;
  authorizeFixture(selfApprovedRole);
  assert.equal((await runSealedSnapshot(selfApprovedRole)).failureCode, 'EXECUTION_AUTHORIZATION_REJECTED');
});

await test('missing Source/Target role-owner or Broker-owner attestation is rejected', async () => {
  const missingRoleOwner = makeFixture();
  delete missingRoleOwner.executionAuthorization.targetRoleOwnerReference;
  authorizeFixture(missingRoleOwner);
  assert.equal((await runSealedSnapshot(missingRoleOwner)).failureCode, 'EXECUTION_AUTHORIZATION_REJECTED');

  const missingBrokerOwner = makeFixture();
  delete missingBrokerOwner.executionAuthorization.brokerOwnerReference;
  authorizeFixture(missingBrokerOwner);
  assert.equal((await runSealedSnapshot(missingBrokerOwner)).failureCode, 'EXECUTION_AUTHORIZATION_REJECTED');
});

await test('package source and documentation contain no concrete secret, UUID, or PII literal', () => {
  const files = ['canonicalization.mjs', 'query-pack-registry.mjs', 'sanitizer.mjs', 'schema-contract.mjs', 'manifest.mjs', 'fake-broker.mjs', 'sealed-snapshot-runner.mjs'];
  const docsDirectory = join(dirname(dirname(here)), 'docs', 'security', 'store_operations_sealed_snapshot_v1');
  const docFiles = readdirSync(docsDirectory).filter((file) => file.endsWith('.md'));
  const source = files.map((file) => readFileSync(join(here, file), 'utf8'))
    .concat(docFiles.map((file) => readFileSync(join(docsDirectory, file), 'utf8'))).join('\n');
  for (const marker of ['postgresql://', 'postgres://', 'supabase.co', 'sbp_', 'eyJhbGciOi']) assert.equal(source.includes(marker), false);
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(source), false);
  assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(source), false);
});

assert.equal(passed, 28);
process.stdout.write(`RESULT ${passed}/28 PASS\n`);
