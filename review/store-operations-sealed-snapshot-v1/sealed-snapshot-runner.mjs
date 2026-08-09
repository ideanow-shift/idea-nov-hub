import { buildPrivateSnapshotManifest } from './manifest.mjs';
import { FIXED_QUERY_REGISTRY, PACKAGE_ID, getQueriesForPack, isExactPackRequest } from './query-pack-registry.mjs';
import { assertPrivateRows, assertSanitizedEvidence, safeFailureCode, sanitizeQueryEvidence } from './sanitizer.mjs';
import { assertApprovedSchemaContract, assertPrivateQueryPackManifest, assertStage0Matches } from './schema-contract.mjs';

const READ_ONLY_REQUIRED = Object.freeze([
  'currentUserVerified',
  'transactionReadOnly',
  'defaultTransactionReadOnly',
]);
const READ_ONLY_DENIED = Object.freeze([
  'canInsert', 'canUpdate', 'canDelete', 'canTruncate', 'canDdl', 'canFunctionWrite', 'bypassRls', 'serviceRole', 'inheritsPrivileges',
]);

function safeStop(code) {
  return {
    packageId: PACKAGE_ID,
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
  };
}

function assertProfile(profile, expectedEnvironment, expectedProjectLabel) {
  const valid = profile && profile.environment === expectedEnvironment && profile.projectLabel === expectedProjectLabel
    && typeof profile.profileRef === 'string' && /^private:[A-Za-z0-9._:/-]{1,160}$/.test(profile.profileRef)
    && typeof profile.profileFingerprint === 'string' && /^[a-f0-9]{64}$/.test(profile.profileFingerprint);
  if (!valid) throw Object.assign(new Error('PROFILE_REJECTED'), { code: 'PROFILE_REJECTED' });
}

function assertReadOnly(attestation) {
  const valid = attestation && READ_ONLY_REQUIRED.every((key) => attestation[key] === true)
    && READ_ONLY_DENIED.every((key) => attestation[key] === false);
  if (!valid) throw Object.assign(new Error('READ_ONLY_ROLE_REJECTED'), { code: 'READ_ONLY_ROLE_REJECTED' });
}

function rowsFor(records, queryId) {
  const record = records.find((entry) => entry.queryId === queryId);
  if (!record) throw Object.assign(new Error('DOMAIN_VALIDATION_REJECTED'), { code: 'DOMAIN_VALIDATION_REJECTED' });
  return record.rows;
}

function oneRow(records, queryId) {
  const rows = rowsFor(records, queryId);
  if (rows.length !== 1) throw Object.assign(new Error('DOMAIN_VALIDATION_REJECTED'), { code: 'DOMAIN_VALIDATION_REJECTED' });
  return rows[0];
}

function requireValue(row, key, expected) {
  if (row[key] !== expected) throw Object.assign(new Error('DOMAIN_VALIDATION_REJECTED'), { code: 'DOMAIN_VALIDATION_REJECTED' });
}

function assertDomainGates(stage1Records) {
  const summary = oneRow(stage1Records, 'SOCE-QP03-CLASSIFICATION-SUMMARY');
  requireValue(summary, 'canonical_corporation_count', 6);
  requireValue(summary, 'official_store_count', 20);
  requireValue(summary, 'direct_store_count', 13);
  requireValue(summary, 'franchise_store_count', 7);
  for (const key of ['duplicate_store_key_count', 'unresolved_store_count', 'orphan_corporation_relation_count', 'unknown_classification_count']) requireValue(summary, key, 0);

  const stores = rowsFor(stage1Records, 'SOCE-QP03-CANONICAL-STORE-ROWS');
  if (stores.length !== 20 || new Set(stores.map((row) => row.canonical_store_key)).size !== 20) {
    throw Object.assign(new Error('DOMAIN_VALIDATION_REJECTED'), { code: 'DOMAIN_VALIDATION_REJECTED' });
  }
  if (stores.some((row) => !['direct', 'franchise'].includes(row.store_classification)
    || row.store_status !== 'active' || row.corporation_relation_state !== 'effective')) {
    throw Object.assign(new Error('DOMAIN_VALIDATION_REJECTED'), { code: 'DOMAIN_VALIDATION_REJECTED' });
  }

  const tokorozawa = oneRow(stage1Records, 'SOCE-QP03-TOKOROZAWA-LEGACY-RELATION');
  if (!['confirmed', 'not_applicable'].includes(tokorozawa.legacy_relation_state)) {
    throw Object.assign(new Error('DOMAIN_VALIDATION_REJECTED'), { code: 'DOMAIN_VALIDATION_REJECTED' });
  }
  requireValue(tokorozawa, 'duplicate_relation_count', 0);
  requireValue(tokorozawa, 'unresolved_relation_count', 0);

  const employees = oneRow(stage1Records, 'SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY');
  requireValue(employees, 'store_manager_coverage_count', 20);
  requireValue(employees, 'missing_store_manager_count', 0);
  requireValue(employees, 'duplicate_store_manager_count', 0);
  requireValue(employees, 'orphan_assignment_count', 0);
  if (!['resolved', 'unresolved'].includes(employees.sales_department_head_state)) {
    throw Object.assign(new Error('DOMAIN_VALIDATION_REJECTED'), { code: 'DOMAIN_VALIDATION_REJECTED' });
  }
  const amRows = rowsFor(stage1Records, 'SOCE-QP04-AM-ASSIGNMENT-EVIDENCE');
  if (amRows.some((row) => !['primary', 'secondary'].includes(row.assignment_kind) || row.assignment_status !== 'active')) {
    throw Object.assign(new Error('DOMAIN_VALIDATION_REJECTED'), { code: 'DOMAIN_VALIDATION_REJECTED' });
  }
  const managerRows = rowsFor(stage1Records, 'SOCE-QP04-STORE-MANAGER-COVERAGE');
  if (managerRows.length !== 20 || new Set(managerRows.map((row) => row.canonical_store_key)).size !== 20
    || managerRows.some((row) => row.manager_role_state !== 'active' || row.assignment_status !== 'active')) {
    throw Object.assign(new Error('DOMAIN_VALIDATION_REJECTED'), { code: 'DOMAIN_VALIDATION_REJECTED' });
  }

  const crosswalk = oneRow(stage1Records, 'SOCE-QP05-IDENTITY-CROSSWALK-SUMMARY');
  for (const key of ['email_only_match_count', 'display_name_only_match_count', 'one_to_many_subject_count', 'inactive_employee_count', 'unresolved_crosswalk_count']) requireValue(crosswalk, key, 0);
  const anchors = rowsFor(stage1Records, 'SOCE-QP05-CONSUMER-ANCHOR-SOURCE-EVIDENCE');
  if (anchors.some((row) => row.consumer_application !== 'store_operations' || row.purpose !== 'cross_corporation_consumer_anchor'
    || !['attested', 'unresolved'].includes(row.evidence_state))) {
    throw Object.assign(new Error('DOMAIN_VALIDATION_REJECTED'), { code: 'DOMAIN_VALIDATION_REJECTED' });
  }

  const target = oneRow(stage1Records, 'SOCE-QP06-TARGET-PRESTATE');
  for (const key of Object.keys(target)) requireValue(target, key, 0);
  const m019 = oneRow(stage1Records, 'SOCE-QP06-M019-PRESENCE');
  requireValue(m019, 'm019_migration_state', 'present');
  requireValue(m019, 'm019_access_contract_count', 0);
  requireValue(m019, 'm019_partial_population_count', 0);
}

async function executePacks({ packIds, sourceConnection, targetConnection, result, evidence }) {
  const records = [];
  for (const packId of packIds) {
    for (const query of getQueriesForPack(packId)) {
      if (result.queryCount >= FIXED_QUERY_REGISTRY.length) {
        throw Object.assign(new Error('REQUEST_REJECTED'), { code: 'REQUEST_REJECTED' });
      }
      const connection = query.side === 'source' ? sourceConnection : targetConnection;
      const rows = await connection.executeFixed({ packageId: PACKAGE_ID, packId, queryId: query.queryId });
      try {
        assertPrivateRows(query, rows);
      } catch {
        throw Object.assign(new Error('FIXED_QUERY_OUTPUT_SCHEMA_INVALID'), { code: 'FIXED_QUERY_OUTPUT_SCHEMA_INVALID', queryId: query.queryId });
      }
      records.push({ packId, queryId: query.queryId, side: query.side, rows });
      evidence.push(sanitizeQueryEvidence(query, rows));
      result.queryCount += 1;
    }
  }
  return records;
}

async function closeReadOnly(connection) {
  if (!connection) return true;
  await connection.rollback();
  await connection.close();
  return true;
}

export async function runSealedSnapshot({ request, sourceProfile, targetProfile, privateQueryPackManifest, approvedSchemaContract, broker, privateArtifactSink }) {
  if (!isExactPackRequest(request)) return safeStop('REQUEST_REJECTED');
  try {
    if (!broker || typeof broker.openReadOnly !== 'function' || !privateArtifactSink
      || typeof privateArtifactSink.storeSealed !== 'function' || typeof privateArtifactSink.cleanupEphemeral !== 'function') {
      throw Object.assign(new Error('REQUEST_REJECTED'), { code: 'REQUEST_REJECTED' });
    }
    assertProfile(sourceProfile, 'production', 'idea-nov-core');
    assertProfile(targetProfile, 'staging', 'idea-nov-staging');
    if (sourceProfile.profileRef === targetProfile.profileRef || sourceProfile.profileFingerprint === targetProfile.profileFingerprint) {
      throw Object.assign(new Error('PROFILE_REJECTED'), { code: 'PROFILE_REJECTED' });
    }
    assertApprovedSchemaContract(approvedSchemaContract);
    assertPrivateQueryPackManifest(privateQueryPackManifest, approvedSchemaContract);
    if (request.schemaContractHash !== approvedSchemaContract.schemaContractHash) {
      throw Object.assign(new Error('SCHEMA_CONTRACT_MISMATCH'), { code: 'SCHEMA_CONTRACT_MISMATCH' });
    }
  } catch (error) {
    return safeStop(safeFailureCode(error));
  }

  const result = safeStop(null);
  result.sourceConnectionState = 'not_started';
  result.targetConnectionState = 'not_started';
  let sourceConnection;
  let targetConnection;
  try {
    sourceConnection = await broker.openReadOnly({ side: 'source', profileRef: sourceProfile.profileRef });
    result.sourceConnectionState = 'open';
    targetConnection = await broker.openReadOnly({ side: 'target', profileRef: targetProfile.profileRef });
    result.targetConnectionState = 'open';
    await sourceConnection.beginReadOnly({ statementTimeoutMs: 5000, lockTimeoutMs: 1000, idleTimeoutMs: 15000 });
    await targetConnection.beginReadOnly({ statementTimeoutMs: 5000, lockTimeoutMs: 1000, idleTimeoutMs: 15000 });
    assertReadOnly(await sourceConnection.attestReadOnly());
    assertReadOnly(await targetConnection.attestReadOnly());
    if (await sourceConnection.attestSealedQueryPacks({ contentHash: privateQueryPackManifest.contentHash }) !== true
      || await targetConnection.attestSealedQueryPacks({ contentHash: privateQueryPackManifest.contentHash }) !== true) {
      throw Object.assign(new Error('PRIVATE_QUERY_PACK_REJECTED'), { code: 'PRIVATE_QUERY_PACK_REJECTED' });
    }
    result.readOnlySession = 'pass';

    const evidence = [];
    const stage0Records = await executePacks({ packIds: ['SOCE-QP01', 'SOCE-QP02'], sourceConnection, targetConnection, result, evidence });
    assertStage0Matches(approvedSchemaContract, stage0Records);
    result.stage0 = 'pass';

    const stage1Records = await executePacks({ packIds: ['SOCE-QP03', 'SOCE-QP04', 'SOCE-QP05', 'SOCE-QP06'], sourceConnection, targetConnection, result, evidence });
    assertDomainGates(stage1Records);
    result.stage1 = 'pass';
    assertSanitizedEvidence(evidence);

    const privateManifest = buildPrivateSnapshotManifest({
      request,
      schemaContract: approvedSchemaContract,
      privateQueryPackManifest,
      stage0Records,
      stage1Records,
      executionTimestamp: request.executionTimestamp,
    });
    const privateArtifactRef = await privateArtifactSink.storeSealed({
      privateManifest,
      privatePayload: { stage0Records, stage1Records },
    });
    if (typeof privateArtifactRef !== 'string' || !/^sealed-artifact:[A-Za-z0-9._:/-]{1,160}$/.test(privateArtifactRef)) {
      throw Object.assign(new Error('SEALED_ARTIFACT_REJECTED'), { code: 'SEALED_ARTIFACT_REJECTED' });
    }
    result.runStatus = 'complete';
    result.failureCode = null;
    result.sanitizedEvidence = evidence;
    result.privateArtifactStored = true;
    result.privateArtifactRef = privateArtifactRef;
    result.manifestFileHash = privateManifest.manifestFileHash;
    result.canonicalPayloadHash = privateManifest.canonicalPayloadHash;
  } catch (error) {
    result.runStatus = 'safe_stop';
    result.failureCode = safeFailureCode(error);
    if (typeof error?.queryId === 'string') result.failureQueryId = error.queryId;
  } finally {
    try {
      await closeReadOnly(targetConnection);
      await closeReadOnly(sourceConnection);
      await privateArtifactSink.cleanupEphemeral();
      result.connectionCleanup = 'pass';
      if (targetConnection) result.targetConnectionState = 'closed';
      if (sourceConnection) result.sourceConnectionState = 'closed';
    } catch {
      result.runStatus = 'safe_stop';
      result.failureCode ??= 'RUNNER_CLEANUP_FAILED';
      result.connectionCleanup = 'fail';
    }
  }
  return result;
}
