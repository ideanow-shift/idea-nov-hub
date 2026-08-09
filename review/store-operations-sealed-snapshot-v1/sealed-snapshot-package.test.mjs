import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashCanonical, hashRecordSet } from './canonicalization.mjs';
import { FakePrivateArtifactSink, FakeSealedSnapshotBroker, FakeSealedSnapshotConnection } from './fake-broker.mjs';
import { FIXED_QUERY_REGISTRY, FIXED_QUERY_PACKS, PUBLIC_QUERY_CATALOG_HASH, QUERY_PACK_IDS, publicQueryCatalogShape } from './query-pack-registry.mjs';
import { assertPrivateRows, sanitizeQueryEvidence } from './sanitizer.mjs';
import { hashPrivateQueryPackManifest, hashSchemaContract, hashStage0Evidence } from './schema-contract.mjs';
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
    'SOCE-QP01-SOURCE-IDENTITY': [{
      attestation_side: 'source', environment_state: 'production', project_identity_state: 'match', region_state: 'match', profile_state: 'match',
    }],
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
    'SOCE-QP01-TARGET-IDENTITY': [{
      attestation_side: 'target', environment_state: 'staging', project_identity_state: 'match', region_state: 'match', profile_state: 'match',
    }],
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

function makeFixture() {
  const { source, target } = buildRows();
  const stage0Records = [
    'SOCE-QP01-SOURCE-IDENTITY',
    'SOCE-QP01-TARGET-IDENTITY',
    'SOCE-QP01-SOURCE-READONLY',
    'SOCE-QP01-TARGET-READONLY',
    'SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP',
    'SOCE-QP02-TARGET-SCHEMA-COLUMN-MAP',
  ].map((queryId) => ({ queryId, rows: source[queryId] ?? target[queryId] }));
  const privateManifestBase = {
    manifestId: 'SOCE-PRIVATE-QUERY-PACK-MANIFEST-v1',
    executionState: 'sealed',
    publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH,
    packIds: QUERY_PACK_IDS,
    packs: QUERY_PACK_IDS.map((packId) => ({
      packId,
      queryIds: FIXED_QUERY_REGISTRY.filter((query) => query.packId === packId).map((query) => query.queryId),
      sealedQueryPackHash: hashCanonical({ packId, fixture: 'sealed-private-query-pack-v1' }),
    })),
  };
  const privateQueryPackManifest = { ...privateManifestBase, contentHash: hashPrivateQueryPackManifest(privateManifestBase) };
  const contractBase = {
    contractId: 'SOCE-SCHEMA-COLUMN-CONTRACT-v1',
    executionState: 'approved',
    sourceProjectLabel: 'idea-nov-core',
    targetProjectLabel: 'idea-nov-staging',
    approvalReference: 'approval:fixture',
    packIds: QUERY_PACK_IDS,
    publicQueryCatalogHash: PUBLIC_QUERY_CATALOG_HASH,
    expectedStage0Digest: hashStage0Evidence(stage0Records),
    privateQueryPackManifestHash: privateQueryPackManifest.contentHash,
  };
  const approvedSchemaContract = { ...contractBase, schemaContractHash: hashSchemaContract(contractBase) };
  const request = {
    executionPackageId: 'store-operations-consumer-enablement-sealed-snapshot-v1',
    sourceProjectLabel: 'idea-nov-core',
    targetProjectLabel: 'idea-nov-staging',
    noRetry: true,
    packIds: QUERY_PACK_IDS,
    authorizationReference: 'approval:fixture',
    schemaContractHash: approvedSchemaContract.schemaContractHash,
    executionTimestamp: '2026-08-09T04:00:00.000Z',
  };
  const sourceConnection = new FakeSealedSnapshotConnection({ rowsByQuery: source, sealedPackManifestHash: privateQueryPackManifest.contentHash });
  const targetConnection = new FakeSealedSnapshotConnection({ rowsByQuery: target, sealedPackManifestHash: privateQueryPackManifest.contentHash });
  return {
    request,
    sourceProfile: { environment: 'production', projectLabel: 'idea-nov-core', profileRef: 'private:source-profile', profileFingerprint: 'a'.repeat(64) },
    targetProfile: { environment: 'staging', projectLabel: 'idea-nov-staging', profileRef: 'private:target-profile', profileFingerprint: 'b'.repeat(64) },
    privateQueryPackManifest,
    approvedSchemaContract,
    source,
    target,
    sourceConnection,
    targetConnection,
    broker: new FakeSealedSnapshotBroker({ source: sourceConnection, target: targetConnection }),
    privateArtifactSink: new FakePrivateArtifactSink(),
  };
}

function rebuildSchemaContract(fixture, changes = {}) {
  const base = { ...fixture.approvedSchemaContract, ...changes };
  delete base.schemaContractHash;
  fixture.approvedSchemaContract = { ...base, schemaContractHash: hashSchemaContract(base) };
  fixture.request = { ...fixture.request, schemaContractHash: fixture.approvedSchemaContract.schemaContractHash };
}

await test('registry is fixed, SQL-free, and contains the six approved packs only', () => {
  assert.deepEqual(QUERY_PACK_IDS, ['SOCE-QP01', 'SOCE-QP02', 'SOCE-QP03', 'SOCE-QP04', 'SOCE-QP05', 'SOCE-QP06']);
  assert.equal(FIXED_QUERY_PACKS.length, 6);
  assert.equal(FIXED_QUERY_REGISTRY.length, 16);
  assert.equal(FIXED_QUERY_REGISTRY.every((query) => query.privateSqlOnly && !Object.hasOwn(query, 'sql')), true);
  assert.equal(PUBLIC_QUERY_CATALOG_HASH, hashCanonical(publicQueryCatalogShape()));
});

await test('fixture-only happy path creates a sealed private artifact and public sanitized evidence', async () => {
  const fixture = makeFixture();
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.runStatus, 'complete', `${result.failureCode}:${result.failureQueryId ?? 'none'}`);
  assert.equal(result.queryCount, 16);
  assert.equal(result.stage0, 'pass');
  assert.equal(result.stage1, 'pass');
  assert.equal(fixture.privateArtifactSink.records.length, 1);
  assert.equal(fixture.privateArtifactSink.cleanupCount, 1);
  assert.equal(result.sanitizedEvidence.length, 16);
  assert.equal(JSON.stringify(result).includes('employee-am-1'), false);
  assert.equal(fixture.sourceConnection.events.at(-2), 'rollback');
  assert.equal(fixture.targetConnection.events.at(-1), 'close');
});

await test('schema digest mismatch stops after Stage 0 and before snapshot extraction', async () => {
  const fixture = makeFixture();
  rebuildSchemaContract(fixture, { expectedStage0Digest: '0'.repeat(64) });
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'SCHEMA_CONTRACT_MISMATCH');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.sourceConnection.events.some((event) => event.includes('SOCE-QP03')), false);
  assert.equal(fixture.privateArtifactSink.records.length, 0);
});

await test('missing fixed output column is rejected before Stage 1', async () => {
  const fixture = makeFixture();
  delete fixture.source['SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP'][0].column_label;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID');
  assert.equal(result.stage1, 'not_started');
  assert.equal(fixture.privateArtifactSink.records.length, 0);
});

await test('wrong source project profile opens no connection', async () => {
  const fixture = makeFixture();
  fixture.sourceProfile = { ...fixture.sourceProfile, projectLabel: 'idea-nov-staging' };
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'PROFILE_REJECTED');
  assert.deepEqual(fixture.broker.events, []);
  assert.equal(fixture.privateArtifactSink.records.length, 0);
});

await test('wrong environment profile opens no connection', async () => {
  const fixture = makeFixture();
  fixture.targetProfile = { ...fixture.targetProfile, environment: 'production' };
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'PROFILE_REJECTED');
  assert.deepEqual(fixture.broker.events, []);
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

await test('private query-pack hash mismatch is rejected before opening either connection', async () => {
  const fixture = makeFixture();
  fixture.privateQueryPackManifest = {
    ...fixture.privateQueryPackManifest,
    packs: fixture.privateQueryPackManifest.packs.map((entry, index) => index === 0 ? { ...entry, sealedQueryPackHash: '0'.repeat(64) } : entry),
  };
  fixture.privateQueryPackManifest.contentHash = hashPrivateQueryPackManifest(fixture.privateQueryPackManifest);
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'PRIVATE_QUERY_PACK_REJECTED');
  assert.deepEqual(fixture.broker.events, []);
});

await test('broker-side sealed Pack hash mismatch rolls back before Stage 0', async () => {
  const fixture = makeFixture();
  fixture.targetConnection.sealedPackManifestHash = '0'.repeat(64);
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
  assert.equal(hashCanonical({ alpha: 'e\u0301', beta: '\r\n' }), hashCanonical({ beta: '\n', alpha: 'é' }));
});

await test('duplicate or orphan source evidence fails closed before artifact storage', async () => {
  const fixture = makeFixture();
  fixture.source['SOCE-QP03-CLASSIFICATION-SUMMARY'][0].duplicate_store_key_count = 1;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'DOMAIN_VALIDATION_REJECTED');
  assert.equal(fixture.privateArtifactSink.records.length, 0);
});

await test('target pre-state mismatch fails closed before artifact storage', async () => {
  const fixture = makeFixture();
  fixture.target['SOCE-QP06-TARGET-PRESTATE'][0].canonical_employee_count = 1;
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.failureCode, 'DOMAIN_VALIDATION_REJECTED');
  assert.equal(fixture.privateArtifactSink.records.length, 0);
});

await test('query failure clears temporary state and persists no artifact', async () => {
  const fixture = makeFixture();
  fixture.sourceConnection.failQuery = 'SOCE-QP03-CLASSIFICATION-SUMMARY';
  const result = await runSealedSnapshot(fixture);
  assert.equal(result.runStatus, 'safe_stop');
  assert.equal(fixture.privateArtifactSink.records.length, 0);
  assert.equal(fixture.privateArtifactSink.cleanupCount, 1);
  assert.equal(fixture.sourceConnection.events.at(-2), 'rollback');
  assert.equal(fixture.targetConnection.events.at(-1), 'close');
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

process.stdout.write(`RESULT ${passed}/15 PASS\n`);
