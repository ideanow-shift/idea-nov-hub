import { hashCanonical } from './canonicalization.mjs';
import { buildPrivateSnapshotManifest } from './manifest.mjs';
import { FIXED_QUERY_REGISTRY, PACKAGE_ID, getQueriesForPack, isExactPackRequest } from './query-pack-registry.mjs';
import { assertPrivateRows, assertSanitizedEvidence, safeFailureCode, sanitizeQueryEvidence } from './sanitizer.mjs';
import { assertApprovedSchemaContract, assertPrivateQueryPackManifest, assertStage0Matches, privateQueryAttestations } from './schema-contract.mjs';

const READ_ONLY_REQUIRED = Object.freeze([
  'currentUserVerified',
  'transactionReadOnly',
  'defaultTransactionReadOnly',
]);
const READ_ONLY_DENIED = Object.freeze([
  'canInsert', 'canUpdate', 'canDelete', 'canTruncate', 'canDdl', 'canFunctionWrite', 'bypassRls', 'serviceRole', 'inheritsPrivileges',
]);
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SAFE_REFERENCE = /^(?:approval|principal|attestation|run|private):[A-Za-z0-9._:/-]{1,160}$/;
const PRE_COMMIT_CLEANUP_FIELDS = Object.freeze([
  'rawResultsDeleted',
  'canonicalPayloadDeleted',
  'temporaryManifestDeleted',
  'temporaryEvidenceDeleted',
  'temporaryLogsDeleted',
  'downloadedArtifactsDeleted',
  'listenersStopped',
  'childProcessesStopped',
  'temporaryDirectoriesDeleted',
]);
const FINAL_CLEANUP_FIELDS = Object.freeze([
  'sourceConnectionClosed',
  'targetConnectionClosed',
  'brokerConnectionClosed',
  ...PRE_COMMIT_CLEANUP_FIELDS,
  'preparedBundleAbortedOrCommitted',
]);

function failure(code) {
  throw Object.assign(new Error(code), { code });
}

function safeStop(code, runId = null) {
  return {
    packageId: PACKAGE_ID,
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
    privateArtifactStored: false,
    mutationExecuted: false,
    secretExposureDetected: false,
    connectionCleanup: 'not_started',
    executionLedgerState: 'not_claimed',
  };
}

function parseUtc(value, code) {
  if (typeof value !== 'string' || !ISO_UTC.test(value)) failure(code);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) failure(code);
  return parsed;
}

function assertSafeReference(value, code) {
  if (typeof value !== 'string' || !SAFE_REFERENCE.test(value)) failure(code);
}

function assertPostgresVersionPolicy(policy) {
  const valid = policy && policy.major === 17
    && Object.keys(policy).every((key) => ['major', 'exactServerVersionNum', 'minimumServerVersionNum', 'maximumServerVersionNum'].includes(key))
    && ['exactServerVersionNum', 'minimumServerVersionNum', 'maximumServerVersionNum'].every((key) => policy[key] === undefined || Number.isSafeInteger(policy[key]))
    && (policy.minimumServerVersionNum === undefined || policy.maximumServerVersionNum === undefined || policy.minimumServerVersionNum <= policy.maximumServerVersionNum);
  if (!valid) failure('PROFILE_REJECTED');
}

function assertProfile(profile, expectedEnvironment, expectedProjectLabel, now) {
  const valid = profile && profile.environment === expectedEnvironment && profile.projectLabel === expectedProjectLabel
    && typeof profile.profileRef === 'string' && /^private:[A-Za-z0-9._:/-]{1,160}$/.test(profile.profileRef)
    && typeof profile.profileFingerprint === 'string' && /^[a-f0-9]{64}$/.test(profile.profileFingerprint)
    && typeof profile.brokerRef === 'string' && /^private:[A-Za-z0-9._:/-]{1,160}$/.test(profile.brokerRef)
    && typeof profile.brokerFingerprint === 'string' && /^[a-f0-9]{64}$/.test(profile.brokerFingerprint);
  if (!valid) failure('PROFILE_REJECTED');
  const notBefore = parseUtc(profile.notBefore, 'PROFILE_REJECTED');
  const expiresAt = parseUtc(profile.expiresAt, 'PROFILE_REJECTED');
  if (notBefore > expiresAt || now < notBefore || now >= expiresAt) failure('PROFILE_REJECTED');
  assertPostgresVersionPolicy(profile.postgresVersionPolicy);
}

function assertReadOnly(attestation) {
  const valid = attestation && READ_ONLY_REQUIRED.every((key) => attestation[key] === true)
    && READ_ONLY_DENIED.every((key) => attestation[key] === false);
  if (!valid) failure('READ_ONLY_ROLE_REJECTED');
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

function assertReadOnlyEvidence(row, side) {
  requireValue(row, 'attestation_side', side, 'READ_ONLY_ROLE_REJECTED');
  requireValue(row, 'current_user_state', 'verified', 'READ_ONLY_ROLE_REJECTED');
  requireValue(row, 'transaction_read_only', 'on', 'READ_ONLY_ROLE_REJECTED');
  requireValue(row, 'default_transaction_read_only', 'on', 'READ_ONLY_ROLE_REJECTED');
  for (const key of ['insert_denied', 'update_denied', 'delete_denied', 'truncate_denied', 'ddl_denied', 'function_write_denied', 'bypassrls_denied', 'role_inheritance_denied']) {
    requireValue(row, key, true, 'READ_ONLY_ROLE_REJECTED');
  }
}

function assertPostgresVersion(row, policy) {
  const match = typeof row.server_version === 'string' && /^(\d{1,2})(?:\.\d+(?:\.\d+)?)?(?:[A-Za-z0-9.+-]*)?$/.exec(row.server_version);
  const serverVersionNum = row.server_version_num;
  if (!match || !Number.isSafeInteger(serverVersionNum)) failure('POSTGRES_VERSION_REJECTED');
  const major = Number(match[1]);
  if (major !== policy.major || Math.trunc(serverVersionNum / 10000) !== policy.major) failure('POSTGRES_VERSION_REJECTED');
  if (policy.exactServerVersionNum !== undefined && serverVersionNum !== policy.exactServerVersionNum) failure('POSTGRES_VERSION_REJECTED');
  if (policy.minimumServerVersionNum !== undefined && serverVersionNum < policy.minimumServerVersionNum) failure('POSTGRES_VERSION_REJECTED');
  if (policy.maximumServerVersionNum !== undefined && serverVersionNum > policy.maximumServerVersionNum) failure('POSTGRES_VERSION_REJECTED');
}

function assertStage0Attestations(records, sourceProfile, targetProfile) {
  const sourceIdentity = oneRow(records, 'SOCE-QP01-SOURCE-IDENTITY');
  const targetIdentity = oneRow(records, 'SOCE-QP01-TARGET-IDENTITY');
  assertIdentityEvidence(sourceIdentity, 'source', 'production');
  assertIdentityEvidence(targetIdentity, 'target', 'staging');
  assertPostgresVersion(sourceIdentity, sourceProfile.postgresVersionPolicy);
  assertPostgresVersion(targetIdentity, targetProfile.postgresVersionPolicy);
  assertReadOnlyEvidence(oneRow(records, 'SOCE-QP01-SOURCE-READONLY'), 'source');
  assertReadOnlyEvidence(oneRow(records, 'SOCE-QP01-TARGET-READONLY'), 'target');
}

function assertDomainGates(stage1Records) {
  const summary = oneRow(stage1Records, 'SOCE-QP03-CLASSIFICATION-SUMMARY');
  requireValue(summary, 'canonical_corporation_count', 6);
  requireValue(summary, 'official_store_count', 20);
  requireValue(summary, 'direct_store_count', 13);
  requireValue(summary, 'franchise_store_count', 7);
  for (const key of ['duplicate_store_key_count', 'unresolved_store_count', 'orphan_corporation_relation_count', 'unknown_classification_count']) requireValue(summary, key, 0);

  const stores = rowsFor(stage1Records, 'SOCE-QP03-CANONICAL-STORE-ROWS');
  if (stores.length !== 20 || new Set(stores.map((row) => row.canonical_store_key)).size !== 20) failure('DOMAIN_VALIDATION_REJECTED');
  if (stores.some((row) => !['direct', 'franchise'].includes(row.store_classification)
    || row.store_status !== 'active' || row.corporation_relation_state !== 'effective')) failure('DOMAIN_VALIDATION_REJECTED');

  const tokorozawa = oneRow(stage1Records, 'SOCE-QP03-TOKOROZAWA-LEGACY-RELATION');
  if (!['confirmed', 'not_applicable'].includes(tokorozawa.legacy_relation_state)) failure('DOMAIN_VALIDATION_REJECTED');
  requireValue(tokorozawa, 'duplicate_relation_count', 0);
  requireValue(tokorozawa, 'unresolved_relation_count', 0);

  const employees = oneRow(stage1Records, 'SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY');
  requireValue(employees, 'store_manager_coverage_count', 20);
  requireValue(employees, 'missing_store_manager_count', 0);
  requireValue(employees, 'duplicate_store_manager_count', 0);
  requireValue(employees, 'orphan_assignment_count', 0);
  if (!['resolved', 'unresolved'].includes(employees.sales_department_head_state)) failure('DOMAIN_VALIDATION_REJECTED');
  const amRows = rowsFor(stage1Records, 'SOCE-QP04-AM-ASSIGNMENT-EVIDENCE');
  if (amRows.some((row) => !['primary', 'secondary'].includes(row.assignment_kind) || row.assignment_status !== 'active')) failure('DOMAIN_VALIDATION_REJECTED');
  const managerRows = rowsFor(stage1Records, 'SOCE-QP04-STORE-MANAGER-COVERAGE');
  if (managerRows.length !== 20 || new Set(managerRows.map((row) => row.canonical_store_key)).size !== 20
    || managerRows.some((row) => row.manager_role_state !== 'active' || row.assignment_status !== 'active')) failure('DOMAIN_VALIDATION_REJECTED');

  const crosswalk = oneRow(stage1Records, 'SOCE-QP05-IDENTITY-CROSSWALK-SUMMARY');
  for (const key of ['email_only_match_count', 'display_name_only_match_count', 'one_to_many_subject_count', 'inactive_employee_count', 'unresolved_crosswalk_count']) requireValue(crosswalk, key, 0);
  const anchors = rowsFor(stage1Records, 'SOCE-QP05-CONSUMER-ANCHOR-SOURCE-EVIDENCE');
  if (anchors.some((row) => row.consumer_application !== 'store_operations' || row.purpose !== 'cross_corporation_consumer_anchor'
    || !['attested', 'unresolved'].includes(row.evidence_state))) failure('DOMAIN_VALIDATION_REJECTED');

  const target = oneRow(stage1Records, 'SOCE-QP06-TARGET-PRESTATE');
  for (const key of Object.keys(target)) requireValue(target, key, 0);
  const m019 = oneRow(stage1Records, 'SOCE-QP06-M019-PRESENCE');
  requireValue(m019, 'm019_migration_state', 'present');
  requireValue(m019, 'm019_access_contract_count', 0);
  requireValue(m019, 'm019_partial_population_count', 0);
}

function assertInterfaces({ broker, privateArtifactSink, privateExecutionLedger }) {
  const brokerValid = broker && ['trustedNow', 'preflightProfile', 'openReadOnly', 'close'].every((method) => typeof broker[method] === 'function');
  const sinkValid = privateArtifactSink && ['prepareSealedBundle', 'verifyPreparedBundle', 'commitSealedBundle', 'abortSealedBundle', 'revokeCommittedBundle', 'cleanupTemporaryResources'].every((method) => typeof privateArtifactSink[method] === 'function');
  const ledgerValid = privateExecutionLedger && ['claim', 'complete', 'fail'].every((method) => typeof privateExecutionLedger[method] === 'function');
  if (!brokerValid || !sinkValid || !ledgerValid) failure('REQUEST_REJECTED');
}

function assertExecutionAuthorizationBinding({ request, executionAuthorization, privateQueryPackManifest, approvedSchemaContract }) {
  const required = [
    'authorizationReference',
    'runId',
    'packageId',
    'publicQueryCatalogHash',
    'privateQueryPackManifestHash',
    'schemaContractHash',
    'ownerReference',
    'operatorReference',
    'reviewerReference',
    'sourceRoleOwnerReference',
    'targetRoleOwnerReference',
    'brokerOwnerReference',
    'profileCustodianReference',
    'authorizedAt',
    'executionWindowStart',
    'executionWindowEnd',
  ];
  if (!executionAuthorization || Object.keys(executionAuthorization).length !== required.length || !required.every((key) => Object.hasOwn(executionAuthorization, key))) {
    failure('EXECUTION_AUTHORIZATION_REJECTED');
  }
  if (executionAuthorization.authorizationReference !== request.authorizationReference
    || executionAuthorization.runId !== request.runId
    || executionAuthorization.packageId !== PACKAGE_ID
    || executionAuthorization.publicQueryCatalogHash !== request.publicQueryCatalogHash
    || executionAuthorization.privateQueryPackManifestHash !== privateQueryPackManifest.contentHash
    || executionAuthorization.schemaContractHash !== approvedSchemaContract.schemaContractHash) {
    failure('EXECUTION_AUTHORIZATION_REJECTED');
  }
  return hashCanonical(executionAuthorization);
}

function assertExecutionResponsibilities(executionAuthorization, now) {
  for (const key of Object.keys(executionAuthorization).filter((key) => key.endsWith('Reference'))) {
    assertSafeReference(executionAuthorization[key], 'EXECUTION_AUTHORIZATION_REJECTED');
  }
  if (executionAuthorization.operatorReference === executionAuthorization.reviewerReference
    || [executionAuthorization.sourceRoleOwnerReference, executionAuthorization.targetRoleOwnerReference, executionAuthorization.brokerOwnerReference, executionAuthorization.profileCustodianReference].includes(executionAuthorization.operatorReference)) {
    failure('EXECUTION_AUTHORIZATION_REJECTED');
  }
  const authorizedAt = parseUtc(executionAuthorization.authorizedAt, 'EXECUTION_AUTHORIZATION_REJECTED');
  const windowStart = parseUtc(executionAuthorization.executionWindowStart, 'EXECUTION_AUTHORIZATION_REJECTED');
  const windowEnd = parseUtc(executionAuthorization.executionWindowEnd, 'EXECUTION_AUTHORIZATION_REJECTED');
  if (authorizedAt > windowStart || windowStart >= windowEnd || now < windowStart || now >= windowEnd) failure('EXECUTION_AUTHORIZATION_REJECTED');
}

async function executePacks({ packIds, sourceConnection, targetConnection, result, evidence, resources }) {
  const records = [];
  for (const packId of packIds) {
    for (const query of getQueriesForPack(packId)) {
      if (result.queryCount >= FIXED_QUERY_REGISTRY.length) failure('REQUEST_REJECTED');
      const connection = query.side === 'source' ? sourceConnection : targetConnection;
      const rows = await connection.executeFixed({ packageId: PACKAGE_ID, packId, queryId: query.queryId, queryVersion: query.queryVersion });
      try {
        assertPrivateRows(query, rows);
      } catch {
        const error = Object.assign(new Error('FIXED_QUERY_OUTPUT_SCHEMA_INVALID'), { code: 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID', queryId: query.queryId });
        throw error;
      }
      resources.rawResults = 'created';
      records.push({ packId, queryId: query.queryId, side: query.side, rows });
      evidence.push(sanitizeQueryEvidence(query, rows));
      resources.temporaryEvidence = 'created';
      result.queryCount += 1;
    }
  }
  return records;
}

async function closeReadOnly(connection, resources, resourceKey) {
  if (!connection || resources[resourceKey] === 'closed') return;
  let closeError = null;
  try { await connection.rollback(); } catch (error) { closeError = error; }
  try { await connection.close(); resources[resourceKey] = 'closed'; } catch (error) { closeError ??= error; }
  if (closeError) throw Object.assign(closeError, { code: 'RUNNER_CLEANUP_FAILED' });
}

async function closeConnections({ sourceConnection, targetConnection, resources }) {
  let cleanupError = null;
  try { await closeReadOnly(targetConnection, resources, 'targetConnection'); } catch (error) { cleanupError = error; }
  try { await closeReadOnly(sourceConnection, resources, 'sourceConnection'); } catch (error) { cleanupError ??= error; }
  if (cleanupError) throw cleanupError;
}

async function closeBroker(broker, resources) {
  if (resources.brokerConnection === 'not_created' || resources.brokerConnection === 'closed') return;
  await broker.close();
  resources.brokerConnection = 'closed';
}

function assertCleanupReceipt(receipt, fields) {
  if (!receipt || typeof receipt !== 'object' || fields.some((field) => receipt[field] !== true)) failure('RUNNER_CLEANUP_FAILED');
}

async function cleanTemporaryResources(privateArtifactSink, phase, resources, fields) {
  const receipt = await privateArtifactSink.cleanupTemporaryResources({ phase, resourceRegistry: resources });
  assertCleanupReceipt(receipt, fields);
  return receipt;
}

function newResourceRegistry() {
  return {
    sourceConnection: 'not_created',
    targetConnection: 'not_created',
    brokerConnection: 'not_created',
    rawResults: 'not_created',
    canonicalPayload: 'not_created',
    temporaryManifest: 'not_created',
    temporaryEvidence: 'not_created',
    temporaryLogs: 'not_created',
    downloadedArtifacts: 'not_created',
    preparedBundle: 'not_created',
    listeners: 'not_created',
    childProcesses: 'not_created',
    temporaryDirectories: 'not_created',
  };
}

function assertPreparedBundle(prepared, expectedBundleHash) {
  if (!prepared || typeof prepared.preparedBundleRef !== 'string' || !/^prepared-bundle:[A-Za-z0-9._:/-]{1,160}$/.test(prepared.preparedBundleRef)
    || prepared.preparedBundleHash !== expectedBundleHash) failure('SEALED_ARTIFACT_REJECTED');
}

function assertCommittedBundle(committed, expectedBundleHash) {
  if (!committed || typeof committed.sealedArtifactRef !== 'string' || !/^sealed-artifact:[A-Za-z0-9._:/-]{1,160}$/.test(committed.sealedArtifactRef)
    || committed.sealedArtifactHash !== expectedBundleHash) failure('SEALED_ARTIFACT_REJECTED');
}

export async function runSealedSnapshot({ request, executionAuthorization, sourceProfile, targetProfile, privateQueryPackManifest, approvedSchemaContract, broker, privateArtifactSink, privateExecutionLedger }) {
  const runId = typeof request?.runId === 'string' ? request.runId : null;
  if (!isExactPackRequest(request)) return safeStop('REQUEST_REJECTED', runId);

  let now;
  let executionBindingHash;
  try {
    assertInterfaces({ broker, privateArtifactSink, privateExecutionLedger });
    assertApprovedSchemaContract(approvedSchemaContract);
    assertPrivateQueryPackManifest(privateQueryPackManifest, approvedSchemaContract);
    if (request.schemaContractHash !== approvedSchemaContract.schemaContractHash) failure('SCHEMA_CONTRACT_MISMATCH');
    executionBindingHash = assertExecutionAuthorizationBinding({ request, executionAuthorization, privateQueryPackManifest, approvedSchemaContract });
  } catch (error) {
    return safeStop(safeFailureCode(error), runId);
  }

  const result = safeStop(null, runId);
  const resources = newResourceRegistry();
  let sourceConnection;
  let targetConnection;
  let preparedBundle;
  let committedBundle;
  let ledgerClaimed = false;
  let complete = false;
  try {
    const claim = await privateExecutionLedger.claim({ runId, bindingHash: executionBindingHash });
    if (!claim || claim.state !== 'CLAIMED' || claim.claimed !== true) failure('RUN_ID_REJECTED');
    ledgerClaimed = true;
    result.executionLedgerState = 'CLAIMED';

    now = await broker.trustedNow();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) failure('PROFILE_REJECTED');
    assertExecutionResponsibilities(executionAuthorization, now);
    assertProfile(sourceProfile, 'production', 'idea-nov-core', now);
    assertProfile(targetProfile, 'staging', 'idea-nov-staging', now);
    if (sourceProfile.profileRef === targetProfile.profileRef || sourceProfile.profileFingerprint === targetProfile.profileFingerprint) failure('PROFILE_REJECTED');

    if (await broker.preflightProfile({ side: 'source', profile: sourceProfile }) !== true
      || await broker.preflightProfile({ side: 'target', profile: targetProfile }) !== true) failure('PROFILE_REJECTED');

    sourceConnection = await broker.openReadOnly({ side: 'source', profileRef: sourceProfile.profileRef });
    resources.sourceConnection = 'open';
    resources.brokerConnection = 'open';
    result.sourceConnectionState = 'open';
    targetConnection = await broker.openReadOnly({ side: 'target', profileRef: targetProfile.profileRef });
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

    const evidence = [];
    const stage0IdentityRecords = await executePacks({ packIds: ['SOCE-QP01'], sourceConnection, targetConnection, result, evidence, resources });
    assertStage0Attestations(stage0IdentityRecords, sourceProfile, targetProfile);
    const stage0SchemaRecords = await executePacks({ packIds: ['SOCE-QP02'], sourceConnection, targetConnection, result, evidence, resources });
    const stage0Records = stage0IdentityRecords.concat(stage0SchemaRecords);
    assertStage0Matches(approvedSchemaContract, stage0Records);
    result.stage0 = 'pass';

    const stage1Records = await executePacks({ packIds: ['SOCE-QP03', 'SOCE-QP04', 'SOCE-QP05', 'SOCE-QP06'], sourceConnection, targetConnection, result, evidence, resources });
    assertDomainGates(stage1Records);
    result.stage1 = 'pass';
    assertSanitizedEvidence(evidence);

    const privateManifest = buildPrivateSnapshotManifest({
      request,
      schemaContract: approvedSchemaContract,
      privateQueryPackManifest,
      stage0Records,
      stage1Records,
      executionTimestamp: now.toISOString(),
      executionAuthorizationBindingHash: executionBindingHash,
    });
    const privatePayload = { stage0Records, stage1Records };
    const bundleHash = hashCanonical({ privateManifest, privatePayload, sanitizedEvidence: evidence });
    resources.canonicalPayload = 'created';
    resources.temporaryManifest = 'created';
    preparedBundle = await privateArtifactSink.prepareSealedBundle({ privateManifest, privatePayload, sanitizedEvidence: evidence, bundleHash });
    resources.preparedBundle = 'prepared';
    assertPreparedBundle(preparedBundle, bundleHash);
    if (await privateArtifactSink.verifyPreparedBundle({ ...preparedBundle, expectedBundleHash: bundleHash }) !== true) failure('SEALED_ARTIFACT_REJECTED');

    await closeConnections({ sourceConnection, targetConnection, resources });
    result.sourceConnectionState = 'closed';
    result.targetConnectionState = 'closed';
    await cleanTemporaryResources(privateArtifactSink, 'pre_commit', resources, PRE_COMMIT_CLEANUP_FIELDS);

    committedBundle = await privateArtifactSink.commitSealedBundle({ preparedBundleRef: preparedBundle.preparedBundleRef, expectedBundleHash: bundleHash });
    resources.preparedBundle = 'committed';
    assertCommittedBundle(committedBundle, bundleHash);
    await closeBroker(broker, resources);
    await cleanTemporaryResources(privateArtifactSink, 'final', resources, FINAL_CLEANUP_FIELDS);

    if (await privateExecutionLedger.complete({ runId, bindingHash: executionBindingHash }) !== true) failure('RUN_ID_REJECTED');
    complete = true;
    result.runStatus = 'complete';
    result.failureCode = null;
    result.sanitizedEvidence = evidence;
    result.privateArtifactStored = true;
    result.privateArtifactRef = committedBundle.sealedArtifactRef;
    result.manifestFileHash = privateManifest.manifestFileHash;
    result.canonicalPayloadHash = privateManifest.canonicalPayloadHash;
    result.executionLedgerState = 'COMPLETE';
    result.connectionCleanup = 'pass';
  } catch (error) {
    result.runStatus = 'safe_stop';
    result.failureCode = safeFailureCode(error);
    if (typeof error?.queryId === 'string') result.failureQueryId = error.queryId;
  } finally {
    if (!complete) {
      try {
        await closeConnections({ sourceConnection, targetConnection, resources });
        if (resources.sourceConnection === 'closed') result.sourceConnectionState = 'closed';
        if (resources.targetConnection === 'closed') result.targetConnectionState = 'closed';
        if (committedBundle) {
          if (await privateArtifactSink.revokeCommittedBundle({ sealedArtifactRef: committedBundle.sealedArtifactRef, preparedBundleRef: preparedBundle?.preparedBundleRef }) !== true) failure('RUNNER_CLEANUP_FAILED');
          resources.preparedBundle = 'revoked';
        } else if (preparedBundle) {
          if (await privateArtifactSink.abortSealedBundle({ preparedBundleRef: preparedBundle.preparedBundleRef }) !== true) failure('RUNNER_CLEANUP_FAILED');
          resources.preparedBundle = 'aborted';
        }
        await closeBroker(broker, resources);
        await cleanTemporaryResources(privateArtifactSink, 'failure', resources, FINAL_CLEANUP_FIELDS);
        result.connectionCleanup = 'pass';
      } catch (cleanupError) {
        result.failureCode = 'RUNNER_CLEANUP_FAILED';
        result.connectionCleanup = 'fail';
      }
      try {
        if (ledgerClaimed && await privateExecutionLedger.fail({ runId, bindingHash: executionBindingHash }) !== true) failure('RUNNER_CLEANUP_FAILED');
        if (ledgerClaimed) result.executionLedgerState = 'FAILED';
      } catch (ledgerError) {
        result.failureCode = 'RUNNER_CLEANUP_FAILED';
        result.connectionCleanup = 'fail';
      }
    }
  }
  return result;
}
