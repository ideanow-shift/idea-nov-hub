import { hashCanonical } from './canonicalization.mjs';
import { assertExecutionInterfaces } from './broker-interface.mjs';
import { assertCleanupReceipt, cleanupEvidence } from './cleanup-receipt.mjs';
import { verifyExecutionPackage } from './execution-package-lock.mjs';
import { buildPrivateSnapshotManifest } from './manifest.mjs';
import { PACKAGE_ID, PACKAGE_VERSION } from './package-metadata.mjs';
import { FIXED_QUERY_REGISTRY, assertFixedQueryRegistry, getQueriesForPack, isExactPackRequest } from './query-pack-registry.mjs';
import { assertExecutionAuthorizationBinding, assertSeparationOfDuties } from './run-contract.mjs';
import { assertPrivateRows, assertSanitizedEvidence, safeFailureCode, sanitizeQueryEvidence } from './sanitizer.mjs';
import { assertApprovedSchemaContract, assertPrivateQueryPackManifest, assertStage0Matches, privateQueryAttestations } from './schema-contract.mjs';
import { verifyAllSqlArtifacts, verifySqlArtifact } from './sql-artifacts.mjs';

const READ_ONLY_REQUIRED = Object.freeze(['currentUserVerified', 'transactionReadOnly', 'defaultTransactionReadOnly', 'roleClosureChecked', 'ownershipChecked', 'tempChecked', 'routineExecuteChecked']);
const READ_ONLY_DENIED = Object.freeze([
  'canInsert',
  'canUpdate',
  'canDelete',
  'canTruncate',
  'canReferences',
  'canTrigger',
  'canSequenceUsage',
  'canSequenceUpdate',
  'canDatabaseCreate',
  'canApplicationSchemaCreate',
  'canTemporaryCreate',
  'canAlterDrop',
  'canFunctionExecute',
  'ownsDatabase',
  'ownsApplicationSchema',
  'ownsRelation',
  'ownsFunction',
  'ownsType',
  'ownsExtension',
  'canSetRole',
  'hasMembershipAdminOption',
  'hasUnsafeRoleClosure',
  'bypassRls',
  'serviceRole',
]);
const READ_ONLY_EVIDENCE_COUNTS = Object.freeze([
  'unsafe_reachable_role_count',
  'superuser_count',
  'createdb_role_count',
  'createrole_role_count',
  'replication_role_count',
  'bypassrls_role_count',
  'service_role_count',
  'owned_database_count',
  'owned_application_schema_count',
  'owned_relation_count',
  'owned_function_count',
  'owned_type_count',
  'owned_extension_count',
  'effective_temp_privilege_count',
  'effective_database_create_count',
  'effective_schema_create_count',
  'effective_insert_privilege_count',
  'effective_update_privilege_count',
  'effective_delete_privilege_count',
  'effective_truncate_privilege_count',
  'effective_references_privilege_count',
  'effective_trigger_privilege_count',
  'effective_sequence_usage_count',
  'effective_sequence_update_count',
  'effective_dml_privilege_count',
  'effective_sequence_write_count',
  'executable_application_routine_count',
  'membership_admin_option_count',
]);
const READ_ONLY_EVIDENCE_FLAGS = Object.freeze(['role_closure_checked', 'ownership_gate_checked', 'temp_gate_checked', 'routine_execute_gate_checked']);
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const PRIVATE_REFERENCE = /^private:[A-Za-z0-9._:/-]{1,160}$/;
const HASH = /^[a-f0-9]{64}$/;
const MD5 = /^[a-f0-9]{32}$/;

function failure(code, queryId = null) {
  throw Object.assign(new Error(code), { code, ...(queryId ? { queryId } : {}) });
}

function safeStop(code, runId = null) {
  return {
    packageId: PACKAGE_ID,
    packageVersion: PACKAGE_VERSION,
    runId,
    runStatus: 'safe_stop',
    failureCode: code,
    sourceConnectionState: 'not_started',
    targetConnectionState: 'not_started',
    readOnlySession: 'not_started',
    stage0: 'not_started',
    stage1: 'not_started',
    queryCount: 0,
    sanitizedEvidence: [],
    cleanupReceipt: null,
    privateArtifactStored: false,
    mutationExecuted: false,
    secretExposureDetected: false,
    connectionCleanup: 'not_started',
    executionLedgerState: 'not_claimed',
  };
}

function parseUtc(value, code = 'PROFILE_REJECTED') {
  if (typeof value !== 'string' || !ISO_UTC.test(value)) failure(code);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) failure(code);
  return parsed;
}

function assertPostgresVersionPolicy(policy) {
  const allowed = ['major', 'exactServerVersionNum', 'minimumServerVersionNum', 'maximumServerVersionNum'];
  const valid = policy && policy.major === 17 && Object.keys(policy).every((key) => allowed.includes(key))
    && allowed.slice(1).every((key) => policy[key] === undefined || Number.isSafeInteger(policy[key]))
    && (policy.minimumServerVersionNum === undefined || policy.maximumServerVersionNum === undefined || policy.minimumServerVersionNum <= policy.maximumServerVersionNum);
  if (!valid) failure('PROFILE_REJECTED');
}

function assertExpectedProfile(profile, environment) {
  const fields = ['profileReference', 'profileFingerprint', 'environment', 'projectIdentityReference', 'brokerReference', 'notBefore', 'expiresAt', 'postgresVersionPolicy'];
  if (!profile || typeof profile !== 'object' || fields.some((field) => !Object.hasOwn(profile, field))
    || profile.environment !== environment || !PRIVATE_REFERENCE.test(profile.profileReference ?? '')
    || !HASH.test(profile.profileFingerprint ?? '') || !PRIVATE_REFERENCE.test(profile.projectIdentityReference ?? '')
    || !PRIVATE_REFERENCE.test(profile.brokerReference ?? '')) {
    failure('PROFILE_REJECTED');
  }
  const notBefore = parseUtc(profile.notBefore);
  const expiresAt = parseUtc(profile.expiresAt);
  if (notBefore >= expiresAt) failure('PROFILE_REJECTED');
  assertPostgresVersionPolicy(profile.postgresVersionPolicy);
  return profile;
}

function assertProfileAuthorizationBinding(authorization, sourceProfile, targetProfile) {
  const matches = [
    authorization.sourceProfileReference === sourceProfile.profileReference,
    authorization.sourceProfileFingerprint === sourceProfile.profileFingerprint,
    authorization.targetProfileReference === targetProfile.profileReference,
    authorization.targetProfileFingerprint === targetProfile.profileFingerprint,
    authorization.brokerReference === sourceProfile.brokerReference,
    authorization.brokerReference === targetProfile.brokerReference,
  ];
  if (matches.some((match) => match !== true)
    || sourceProfile.profileReference === targetProfile.profileReference
    || sourceProfile.profileFingerprint === targetProfile.profileFingerprint) {
    failure('EXECUTION_AUTHORIZATION_REJECTED');
  }
}

function assertProfileWindow(profile, now) {
  const notBefore = parseUtc(profile.notBefore);
  const expiresAt = parseUtc(profile.expiresAt);
  if (now < notBefore || now >= expiresAt) failure('PROFILE_REJECTED');
}

function assertReadOnly(attestation) {
  if (!attestation || READ_ONLY_REQUIRED.some((key) => attestation[key] !== true) || READ_ONLY_DENIED.some((key) => attestation[key] !== false)) {
    failure('READ_ONLY_ROLE_REJECTED');
  }
}

function rowsFor(records, queryId) {
  const record = records.find((entry) => entry.queryId === queryId);
  if (!record) failure('DOMAIN_VALIDATION_REJECTED');
  return record.rows;
}

function oneRow(records, queryId) {
  const rows = rowsFor(records, queryId);
  if (rows.length !== 1) failure('DOMAIN_VALIDATION_REJECTED');
  return rows[0];
}

function requireValue(row, key, expected, code = 'DOMAIN_VALIDATION_REJECTED') {
  if (row[key] !== expected) failure(code);
}

function assertIdentityEvidence(row, side, environment) {
  requireValue(row, 'attestation_side', side, 'PROFILE_REJECTED');
  requireValue(row, 'environment_state', environment, 'PROFILE_REJECTED');
  for (const key of ['project_identity_state', 'region_state', 'profile_state']) requireValue(row, key, 'match', 'PROFILE_REJECTED');
}

function assertExpectedApplicationSchemas(schemaContract, row, side) {
  const prefix = side === 'source' ? 'source' : 'target';
  const count = schemaContract?.[`${prefix}ApplicationSchemaCount`];
  const digest = schemaContract?.[`${prefix}ApplicationSchemaSetMd5`];
  if (!Number.isSafeInteger(count) || count < 1 || !MD5.test(digest ?? '')
    || row.application_schema_count !== count || row.application_schema_set_md5 !== digest) {
    failure('READ_ONLY_ROLE_REJECTED');
  }
}

function assertReadOnlyEvidence(row, side, schemaContract) {
  requireValue(row, 'attestation_side', side, 'READ_ONLY_ROLE_REJECTED');
  requireValue(row, 'current_user_state', 'verified', 'READ_ONLY_ROLE_REJECTED');
  if (!MD5.test(row.current_role_reference ?? '')) failure('READ_ONLY_ROLE_REJECTED');
  requireValue(row, 'transaction_read_only', 'on', 'READ_ONLY_ROLE_REJECTED');
  requireValue(row, 'default_transaction_read_only', 'on', 'READ_ONLY_ROLE_REJECTED');
  assertExpectedApplicationSchemas(schemaContract, row, side);
  for (const key of ['reachable_role_count', 'settable_role_count', 'inherited_role_count', 'application_schema_count', ...READ_ONLY_EVIDENCE_COUNTS]) {
    if (!Number.isSafeInteger(row[key]) || row[key] < 0) failure('READ_ONLY_ROLE_REJECTED');
  }
  for (const key of READ_ONLY_EVIDENCE_FLAGS) requireValue(row, key, true, 'READ_ONLY_ROLE_REJECTED');
  for (const key of READ_ONLY_EVIDENCE_COUNTS) requireValue(row, key, 0, 'READ_ONLY_ROLE_REJECTED');
  requireValue(row, 'read_only_role_contract_passed', true, 'READ_ONLY_ROLE_REJECTED');
}

function assertPostgresVersion(row, policy) {
  const match = typeof row.server_version === 'string' && /^(\d{1,2})(?:\.\d+(?:\.\d+)?)?(?:[A-Za-z0-9.+-]*)?$/.exec(row.server_version);
  const serverVersionNum = row.server_version_num;
  if (!match || !Number.isSafeInteger(serverVersionNum)) failure('POSTGRES_VERSION_REJECTED');
  const major = Number(match[1]);
  if (major !== policy.major || Math.trunc(serverVersionNum / 10000) !== policy.major
    || (policy.exactServerVersionNum !== undefined && serverVersionNum !== policy.exactServerVersionNum)
    || (policy.minimumServerVersionNum !== undefined && serverVersionNum < policy.minimumServerVersionNum)
    || (policy.maximumServerVersionNum !== undefined && serverVersionNum > policy.maximumServerVersionNum)) {
    failure('POSTGRES_VERSION_REJECTED');
  }
}

function assertStage0Attestations(records, sourceProfile, targetProfile, schemaContract) {
  const sourceIdentity = oneRow(records, 'SOCE-QP01-SOURCE-IDENTITY');
  const targetIdentity = oneRow(records, 'SOCE-QP01-TARGET-IDENTITY');
  assertIdentityEvidence(sourceIdentity, 'source', 'production');
  assertIdentityEvidence(targetIdentity, 'target', 'staging');
  assertPostgresVersion(sourceIdentity, sourceProfile.postgresVersionPolicy);
  assertPostgresVersion(targetIdentity, targetProfile.postgresVersionPolicy);
  assertReadOnlyEvidence(oneRow(records, 'SOCE-QP01-SOURCE-READONLY'), 'source', schemaContract);
  assertReadOnlyEvidence(oneRow(records, 'SOCE-QP01-TARGET-READONLY'), 'target', schemaContract);
}

function assertDomainGates(stage1Records) {
  const summary = oneRow(stage1Records, 'SOCE-QP03-CLASSIFICATION-SUMMARY');
  for (const [key, value] of Object.entries({ canonical_corporation_count: 6, official_store_count: 20, direct_store_count: 13, franchise_store_count: 7, duplicate_store_key_count: 0, unresolved_store_count: 0, orphan_corporation_relation_count: 0, unknown_classification_count: 0 })) requireValue(summary, key, value);
  const stores = rowsFor(stage1Records, 'SOCE-QP03-CANONICAL-STORE-ROWS');
  if (stores.length !== 20 || new Set(stores.map((row) => row.canonical_store_key)).size !== 20
    || stores.some((row) => !['direct', 'franchise'].includes(row.store_classification) || row.store_status !== 'active' || row.corporation_relation_state !== 'effective')) failure('DOMAIN_VALIDATION_REJECTED');
  const tokorozawa = oneRow(stage1Records, 'SOCE-QP03-TOKOROZAWA-LEGACY-RELATION');
  if (!['confirmed', 'not_applicable'].includes(tokorozawa.legacy_relation_state)) failure('DOMAIN_VALIDATION_REJECTED');
  requireValue(tokorozawa, 'duplicate_relation_count', 0);
  requireValue(tokorozawa, 'unresolved_relation_count', 0);
  const employees = oneRow(stage1Records, 'SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY');
  for (const [key, value] of Object.entries({ store_manager_coverage_count: 20, missing_store_manager_count: 0, duplicate_store_manager_count: 0, orphan_assignment_count: 0 })) requireValue(employees, key, value);
  if (!['resolved', 'unresolved'].includes(employees.sales_department_head_state)) failure('DOMAIN_VALIDATION_REJECTED');
  const amRows = rowsFor(stage1Records, 'SOCE-QP04-AM-ASSIGNMENT-EVIDENCE');
  if (amRows.some((row) => !['primary', 'secondary'].includes(row.assignment_kind) || row.assignment_status !== 'active')) failure('DOMAIN_VALIDATION_REJECTED');
  const managerRows = rowsFor(stage1Records, 'SOCE-QP04-STORE-MANAGER-COVERAGE');
  if (managerRows.length !== 20 || new Set(managerRows.map((row) => row.canonical_store_key)).size !== 20 || managerRows.some((row) => row.manager_role_state !== 'active' || row.assignment_status !== 'active')) failure('DOMAIN_VALIDATION_REJECTED');
  const crosswalk = oneRow(stage1Records, 'SOCE-QP05-IDENTITY-CROSSWALK-SUMMARY');
  for (const key of ['email_only_match_count', 'display_name_only_match_count', 'one_to_many_subject_count', 'inactive_employee_count', 'unresolved_crosswalk_count']) requireValue(crosswalk, key, 0);
  const anchors = rowsFor(stage1Records, 'SOCE-QP05-CONSUMER-ANCHOR-SOURCE-EVIDENCE');
  if (anchors.some((row) => row.consumer_application !== 'store_operations' || row.purpose !== 'cross_corporation_consumer_anchor' || !['attested', 'unresolved'].includes(row.evidence_state))) failure('DOMAIN_VALIDATION_REJECTED');
  const target = oneRow(stage1Records, 'SOCE-QP06-TARGET-PRESTATE');
  for (const key of Object.keys(target)) requireValue(target, key, 0);
  const m019 = oneRow(stage1Records, 'SOCE-QP06-M019-PRESENCE');
  requireValue(m019, 'm019_migration_state', 'present');
  requireValue(m019, 'm019_access_contract_count', 0);
  requireValue(m019, 'm019_partial_population_count', 0);
}

async function executePacks({ packIds, sourceConnection, targetConnection, result, evidence, resources, packageRoot }) {
  const records = [];
  for (const packId of packIds) {
    for (const query of getQueriesForPack(packId)) {
      if (result.queryCount >= FIXED_QUERY_REGISTRY.length) failure('REQUEST_REJECTED');
      let sqlArtifact;
      try { sqlArtifact = verifySqlArtifact(query, { packageRoot }); } catch (error) { failure(error.code ?? 'FIXED_SQL_HASH_MISMATCH', query.queryId); }
      const connection = query.side === 'source' ? sourceConnection : targetConnection;
      let rows;
      try {
        rows = await connection.executeFixed({ packageId: PACKAGE_ID, packId, queryId: query.queryId, queryVersion: query.queryVersion, sqlText: sqlArtifact.sqlText, sqlBytes: sqlArtifact.sqlBytes, sqlSha256: sqlArtifact.sqlSha256, timeoutMs: query.timeoutMs });
        assertPrivateRows(query, rows);
      } catch (error) {
        failure(error.code === 'FIXED_SQL_HASH_MISMATCH' ? 'FIXED_SQL_HASH_MISMATCH' : 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID', query.queryId);
      }
      resources.rawResults = 'created';
      records.push({ packId, queryId: query.queryId, side: query.side, rows });
      evidence.push(sanitizeQueryEvidence(query, rows));
      result.queryCount += 1;
    }
  }
  return records;
}

function newResourceRegistry() {
  return {
    sourceConnection: 'not_created', targetConnection: 'not_created', brokerConnection: 'not_created', rawResults: 'not_created',
    canonicalPayload: 'not_created', temporaryManifest: 'not_created', temporaryEvidence: 'not_created', temporaryLogs: 'not_created',
    downloadedArtifacts: 'not_created', preparedBundle: 'not_created', listeners: 'not_created', childProcesses: 'not_created', temporaryDirectories: 'not_created',
  };
}

async function closeReadOnly(connection, resources, resourceKey) {
  if (!connection || resources[resourceKey] === 'closed' || resources[resourceKey] === 'not_created') return;
  let closeError = null;
  try { await connection.rollback(); } catch (error) { closeError = error; }
  try { await connection.close(); resources[resourceKey] = 'closed'; } catch (error) { resources[resourceKey] = 'failed'; closeError ??= error; }
  if (closeError) failure('RUNNER_CLEANUP_FAILED');
}

async function closeConnections(sourceConnection, targetConnection, resources) {
  let closeError = null;
  try { await closeReadOnly(targetConnection, resources, 'targetConnection'); } catch (error) { closeError = error; }
  try { await closeReadOnly(sourceConnection, resources, 'sourceConnection'); } catch (error) { closeError ??= error; }
  if (closeError) throw closeError;
}

async function closeBrokerReadOnlySessions(broker, resources) {
  if (resources.brokerConnection === 'not_created' || resources.brokerConnection === 'closed') return;
  try { await broker.closeReadOnlySessions(); resources.brokerConnection = 'closed'; } catch { resources.brokerConnection = 'failed'; failure('RUNNER_CLEANUP_FAILED'); }
}

async function closeBrokerControl(broker) {
  await broker.close();
}

async function cleanup(privateArtifactSink, phase, resources, { requirePassing = true } = {}) {
  const receipt = await privateArtifactSink.cleanupTemporaryResources({ phase, resourceRegistry: resources });
  assertCleanupReceipt(receipt, { requirePassing });
  return receipt;
}

function assertCommittedBundle(committed, expectedBundleHash) {
  if (!committed || typeof committed.sealedArtifactRef !== 'string' || !/^sealed-artifact:[A-Za-z0-9._:/-]{1,160}$/.test(committed.sealedArtifactRef)
    || committed.sealedArtifactHash !== expectedBundleHash || typeof committed.localBundleRef !== 'string') failure('SEALED_ARTIFACT_REJECTED');
}

function assertLocalBundle(localBundle, expectedBundleHash) {
  if (!localBundle || typeof localBundle.localBundleRef !== 'string' || !/^local-ephemeral:[A-Za-z0-9._:/-]{1,160}$/.test(localBundle.localBundleRef)
    || localBundle.localBundleHash !== expectedBundleHash) failure('SEALED_ARTIFACT_REJECTED');
}

export async function runSealedSnapshot({ request, executionAuthorization, sourceProfile, targetProfile, privateQueryPackManifest, approvedSchemaContract, broker, privateArtifactSink, privateExecutionLedger, packageRoot } = {}) {
  const runId = typeof request?.runId === 'string' ? request.runId : null;
  let packageLock;
  let executionBindingHash;
  try {
    assertFixedQueryRegistry();
    packageLock = verifyExecutionPackage({ packageRoot });
    verifyAllSqlArtifacts(FIXED_QUERY_REGISTRY, { packageRoot });
    if (!isExactPackRequest(request)) failure('REQUEST_REJECTED');
    assertExecutionInterfaces({ broker, privateArtifactSink, privateExecutionLedger });
    assertApprovedSchemaContract(approvedSchemaContract);
    assertPrivateQueryPackManifest(privateQueryPackManifest, approvedSchemaContract);
    if (request.schemaContractHash !== approvedSchemaContract.schemaContractHash || request.privateQueryPackManifestHash !== privateQueryPackManifest.contentHash) failure('SCHEMA_CONTRACT_MISMATCH');
    assertExpectedProfile(sourceProfile, 'production');
    assertExpectedProfile(targetProfile, 'staging');
    executionBindingHash = assertExecutionAuthorizationBinding({ request, authorization: executionAuthorization, packageLock, approvedSchemaContract });
    assertProfileAuthorizationBinding(executionAuthorization, sourceProfile, targetProfile);
  } catch (error) {
    return safeStop(safeFailureCode(error), runId);
  }

  const result = safeStop(null, runId);
  const resources = newResourceRegistry();
  let sourceConnection;
  let targetConnection;
  let localBundle;
  let committedBundle;
  let ledgerClaimed = false;
  let complete = false;
  try {
    const claim = await privateExecutionLedger.claim({ runId, bindingHash: executionBindingHash });
    if (!claim || claim.state !== 'CLAIMED' || claim.claimed !== true) failure('RUN_ID_REJECTED');
    ledgerClaimed = true;
    result.executionLedgerState = 'CLAIMED';

    const now = await broker.trustedNow();
    assertSeparationOfDuties(executionAuthorization, now);
    if (await broker.resolveProfile({ side: 'source', expectedProfile: sourceProfile }) !== true
      || await broker.resolveProfile({ side: 'target', expectedProfile: targetProfile }) !== true) failure('PROFILE_REJECTED');
    assertProfileWindow(sourceProfile, now);
    assertProfileWindow(targetProfile, now);
    if (await broker.verifyBrokerMetadata({ brokerReference: executionAuthorization.brokerReference, brokerFingerprint: executionAuthorization.brokerFingerprint }) !== true) failure('PROFILE_REJECTED');

    sourceConnection = await broker.openReadOnly({ side: 'source' });
    resources.sourceConnection = 'open';
    resources.brokerConnection = 'open';
    result.sourceConnectionState = 'open';
    targetConnection = await broker.openReadOnly({ side: 'target' });
    resources.targetConnection = 'open';
    result.targetConnectionState = 'open';
    await sourceConnection.beginReadOnly({ statementTimeoutMs: 5000, lockTimeoutMs: 1000, idleTimeoutMs: 15000 });
    await targetConnection.beginReadOnly({ statementTimeoutMs: 5000, lockTimeoutMs: 1000, idleTimeoutMs: 15000 });
    assertReadOnly(await sourceConnection.attestReadOnly());
    assertReadOnly(await targetConnection.attestReadOnly());
    const queryAttestations = privateQueryAttestations(privateQueryPackManifest);
    if (await sourceConnection.attestSealedQueryPacks({ contentHash: privateQueryPackManifest.contentHash, queryAttestations }) !== true
      || await targetConnection.attestSealedQueryPacks({ contentHash: privateQueryPackManifest.contentHash, queryAttestations }) !== true) failure('PRIVATE_QUERY_PACK_REJECTED');
    result.readOnlySession = 'pass';

    const queryEvidence = [];
    const stage0IdentityRecords = await executePacks({ packIds: ['SOCE-QP01'], sourceConnection, targetConnection, result, evidence: queryEvidence, resources, packageRoot });
    assertStage0Attestations(stage0IdentityRecords, sourceProfile, targetProfile, approvedSchemaContract);
    const stage0SchemaRecords = await executePacks({ packIds: ['SOCE-QP02'], sourceConnection, targetConnection, result, evidence: queryEvidence, resources, packageRoot });
    const stage0Records = stage0IdentityRecords.concat(stage0SchemaRecords);
    assertStage0Matches(approvedSchemaContract, stage0Records);
    result.stage0 = 'pass';
    const stage1Records = await executePacks({ packIds: ['SOCE-QP03', 'SOCE-QP04', 'SOCE-QP05', 'SOCE-QP06'], sourceConnection, targetConnection, result, evidence: queryEvidence, resources, packageRoot });
    assertDomainGates(stage1Records);
    result.stage1 = 'pass';
    assertSanitizedEvidence(queryEvidence);

    const privatePayload = { stage0Records, stage1Records };
    const canonicalPayloadHash = hashCanonical(privatePayload);
    resources.canonicalPayload = 'created';
    localBundle = await privateArtifactSink.buildLocalEphemeralBundle({ privatePayload, queryEvidence, canonicalPayloadHash });

    await closeConnections(sourceConnection, targetConnection, resources);
    await closeBrokerReadOnlySessions(broker, resources);
    result.sourceConnectionState = 'closed';
    result.targetConnectionState = 'closed';
    const cleanupReceipt = await cleanup(privateArtifactSink, 'pre_commit', resources);
    const sanitizedEvidence = queryEvidence.concat(cleanupEvidence(cleanupReceipt));
    assertSanitizedEvidence(sanitizedEvidence);
    const privateManifest = buildPrivateSnapshotManifest({ request, packageLock, schemaContract: approvedSchemaContract, privateQueryPackManifest, stage0Records, stage1Records, executionTimestamp: now.toISOString(), executionAuthorizationBindingHash: executionBindingHash, cleanupReceipt });
    resources.temporaryManifest = 'not_created';
    const finalized = await privateArtifactSink.finalizeLocalEphemeralBundle({ localBundleRef: localBundle.localBundleRef, privateManifest, sanitizedEvidence });
    const bundleHash = hashCanonical({ privateManifest, privatePayload, sanitizedEvidence });
    localBundle = { ...localBundle, ...finalized };
    assertLocalBundle(localBundle, bundleHash);
    if (await privateArtifactSink.verifyLocalEphemeralBundle({ ...localBundle, expectedBundleHash: bundleHash }) !== true) failure('SEALED_ARTIFACT_REJECTED');

    committedBundle = await privateArtifactSink.atomicCommitFinalBundle({ localBundleRef: localBundle.localBundleRef, expectedBundleHash: bundleHash });
    resources.preparedBundle = 'committed';
    assertCommittedBundle(committedBundle, bundleHash);
    if (await privateArtifactSink.verifyCommittedBundle({ ...committedBundle, expectedBundleHash: bundleHash }) !== true) failure('SEALED_ARTIFACT_REJECTED');
    await closeBrokerControl(broker);
    const finalCleanupReceipt = await cleanup(privateArtifactSink, 'final', resources);
    if (await privateExecutionLedger.complete({ runId, bindingHash: executionBindingHash }) !== true) failure('RUN_ID_REJECTED');
    complete = true;
    result.runStatus = 'complete';
    result.failureCode = null;
    result.sanitizedEvidence = sanitizedEvidence;
    result.cleanupReceipt = cleanupReceipt;
    result.privateArtifactStored = true;
    result.privateArtifactRef = committedBundle.sealedArtifactRef;
    result.manifestFileHash = privateManifest.manifestFileHash;
    result.canonicalPayloadHash = privateManifest.canonicalPayloadHash;
    result.executionLedgerState = 'COMPLETE';
    result.connectionCleanup = finalCleanupReceipt.cleanupOverallStatus;
  } catch (error) {
    result.failureCode = safeFailureCode(error);
    if (typeof error?.queryId === 'string') result.failureQueryId = error.queryId;
  } finally {
    if (!complete) {
      try {
        await closeConnections(sourceConnection, targetConnection, resources);
        await closeBrokerReadOnlySessions(broker, resources);
        if (committedBundle) {
          if (await privateArtifactSink.revokeCommittedBundle({ sealedArtifactRef: committedBundle.sealedArtifactRef, localBundleRef: committedBundle.localBundleRef }) !== true) failure('RUNNER_CLEANUP_FAILED');
          resources.preparedBundle = 'revoked';
        } else if (localBundle) {
          const discard = await privateArtifactSink.discardLocalEphemeralBundle({ localBundleRef: localBundle.localBundleRef });
          if (!discard || discard.readable !== false || !['deleted', 'quarantined', 'not_created'].includes(discard.status)) failure('RUNNER_CLEANUP_FAILED');
          resources.preparedBundle = discard.status === 'quarantined' ? 'quarantined' : 'discarded';
        }
        await closeBrokerControl(broker);
        await cleanup(privateArtifactSink, 'failure', resources);
        result.connectionCleanup = 'pass';
      } catch {
        result.failureCode = 'RUNNER_CLEANUP_FAILED';
        result.connectionCleanup = 'fail';
      }
      try {
        if (ledgerClaimed && await privateExecutionLedger.fail({ runId, bindingHash: executionBindingHash }) !== true) failure('RUNNER_CLEANUP_FAILED');
        if (ledgerClaimed) result.executionLedgerState = 'FAILED';
      } catch {
        result.failureCode = 'RUNNER_CLEANUP_FAILED';
        result.connectionCleanup = 'fail';
      }
    }
    if (!complete) result.runStatus = 'safe_stop';
  }
  return result;
}
