import { createHash } from 'node:crypto';
import { buildCleanupReceipt, CLEANUP_RECEIPT_FIELDS } from './cleanup-receipt.mjs';
import { hashCanonical } from './canonicalization.mjs';
import { SECURITY_ALLOWLIST_HASH, SECURITY_CATALOG_BINDINGS_HASH } from './execution-path-security.mjs';

const EPHEMERAL_RESOURCES = Object.freeze([
  'rawResults',
  'canonicalPayload',
  'temporaryManifest',
  'temporaryEvidence',
  'temporaryLogs',
  'downloadedArtifacts',
  'listeners',
  'childProcesses',
  'temporaryDirectories',
]);

function codeError(code) {
  return Object.assign(new Error(code), { code });
}

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function profileMatches(actual, expected) {
  const fields = ['profileReference', 'profileFingerprint', 'environment', 'projectIdentityReference', 'brokerReference', 'expectedSnapshotRole', 'notBefore', 'expiresAt'];
  return Boolean(actual && expected && fields.every((field) => actual[field] === expected[field]));
}

function cleanupStatus(value, passed) {
  if (value === 'not_created') return 'not_created';
  return passed ? 'pass' : 'failed';
}

export class FakeSealedSnapshotConnection {
  constructor({ roleAttestation, rowsByQuery = {}, failQuery = null, sealedPackManifestHash = null, queryAttestationHash = null, expectedSqlHashes = {}, expectedAstHashes = {}, expectedRole = 'snapshot_fixture_ro', runtimeOverrides = {}, catalogOverrides = {} } = {}) {
    this.roleAttestation = roleAttestation ?? {
      currentUserVerified: true,
      transactionReadOnly: true,
      defaultTransactionReadOnly: true,
      roleClosureChecked: true,
      ownershipChecked: true,
      tempChecked: true,
      routineExecuteChecked: true,
      executionPathTempBlocked: true,
      executionPathRoutineBlocked: true,
      genericSqlUnavailable: true,
      interactiveSqlUnavailable: true,
      dynamicSqlUnavailable: true,
      queryIdOnly: true,
      canInsert: false,
      canUpdate: false,
      canDelete: false,
      canTruncate: false,
      canReferences: false,
      canTrigger: false,
      canSequenceUsage: false,
      canSequenceUpdate: false,
      canDatabaseCreate: false,
      canApplicationSchemaCreate: false,
      canTemporaryCreate: true,
      canAlterDrop: false,
      canFunctionExecute: true,
      ownsDatabase: false,
      ownsApplicationSchema: false,
      ownsRelation: false,
      ownsFunction: false,
      ownsType: false,
      ownsExtension: false,
      canSetRole: false,
      hasMembershipAdminOption: false,
      hasUnsafeRoleClosure: false,
      bypassRls: false,
      serviceRole: false,
    };
    this.rowsByQuery = rowsByQuery;
    this.failQuery = failQuery;
    this.sealedPackManifestHash = sealedPackManifestHash;
    this.queryAttestationHash = queryAttestationHash;
    this.expectedSqlHashes = { ...expectedSqlHashes };
    this.expectedAstHashes = { ...expectedAstHashes };
    this.expectedRole = expectedRole;
    this.runtimeOverrides = { ...runtimeOverrides };
    this.catalogOverrides = { ...catalogOverrides };
    this.events = [];
    this.executionCount = 0;
    this.sqlByteHashes = [];
    this.executedQueryIds = [];
  }

  async open() { this.events.push('open'); }
  async beginReadOnly(options) {
    this.events.push('begin_read_only');
    if (hashCanonical(options) !== hashCanonical({ isolationLevel: 'repeatable read', transactionReadOnly: true, searchPath: 'pg_catalog', statementTimeoutMs: 5000, lockTimeoutMs: 1000, idleTimeoutMs: 15000, retryCount: 0 })) throw codeError('RUNTIME_EVIDENCE_REJECTED');
  }
  async attestReadOnly() { this.events.push('attest_read_only'); return this.roleAttestation; }
  async attestCatalogBindings() {
    this.events.push('attest_catalog_bindings');
    return {
      allowlistHash: SECURITY_ALLOWLIST_HASH,
      catalogBindingsHash: SECURITY_CATALOG_BINDINGS_HASH,
      allResolved: true,
      pgCatalogOnly: true,
      securityDefinerRoutineCount: 0,
      applicationRoutineCount: 0,
      extensionRoutineCount: 0,
      ...this.catalogOverrides,
    };
  }
  async attestSealedQueryPacks({ contentHash, queryAttestations }) {
    this.events.push('attest_sealed_query_packs');
    return this.sealedPackManifestHash === contentHash && this.queryAttestationHash === hashCanonical(queryAttestations);
  }
  async attestRuntimeEvidence(request) {
    this.events.push(`attest_runtime:${request.queryId}`);
    return {
      sessionUser: this.expectedRole,
      currentUser: this.expectedRole,
      expectedRole: this.expectedRole,
      defaultTransactionReadOnly: 'on',
      transactionReadOnly: 'on',
      transactionIsolation: 'repeatable read',
      searchPath: 'pg_catalog',
      transactionStatus: 'in_transaction',
      xidAssigned: false,
      tempSchemaOid: 0,
      insertedTuples: 0,
      updatedTuples: 0,
      deletedTuples: 0,
      advisoryLockCount: 0,
      preparedStatementCount: 0,
      listenChannelCount: 0,
      queryOrdinal: request.queryOrdinal,
      expectedQueryCount: request.expectedQueryCount,
      queryId: request.queryId,
      querySha256: request.querySha256,
      astSha256: request.astSha256,
      ...this.runtimeOverrides,
    };
  }
  async executeFixedQuery({ queryId, sqlSha256, astSha256, securityAllowlistHash }) {
    this.events.push(`query:${queryId}`);
    this.executionCount += 1;
    if (securityAllowlistHash !== SECURITY_ALLOWLIST_HASH
      || this.expectedSqlHashes[queryId] !== sqlSha256
      || this.expectedAstHashes[queryId] !== astSha256) {
      throw codeError('FIXED_SQL_HASH_MISMATCH');
    }
    this.sqlByteHashes.push({ queryId, sqlSha256, astSha256 });
    this.executedQueryIds.push(queryId);
    if (this.failQuery === queryId) throw codeError('FAKE_QUERY_FAILURE');
    return structuredClone(this.rowsByQuery[queryId] ?? []);
  }
  async attestFinalRuntimeEvidence() {
    this.events.push('attest_final_runtime');
    return {
      expectedRole: this.expectedRole,
      sessionUser: this.expectedRole,
      currentUser: this.expectedRole,
      transactionReadOnly: 'on',
      transactionIsolation: 'repeatable read',
      searchPath: 'pg_catalog',
      transactionStatus: 'in_transaction',
      xidAssigned: false,
      tempSchemaOid: 0,
      insertedTuples: 0,
      updatedTuples: 0,
      deletedTuples: 0,
      advisoryLockCount: 0,
      preparedStatementCount: 0,
      listenChannelCount: 0,
      executedQueryCount: this.executedQueryIds.length,
      queryOrderHash: hashCanonical(this.executedQueryIds),
      ...this.runtimeOverrides,
    };
  }
  async rollback() { this.events.push('rollback'); }
  async close() { this.events.push('close'); }
}

export class FakeSealedSnapshotBroker {
  constructor({ source, target, profileMetadata = {}, brokerMetadata = null, profilePreflight = {}, closeFailure = false, now = '2026-08-09T04:00:00.000Z' } = {}) {
    this.source = source ?? new FakeSealedSnapshotConnection();
    this.target = target ?? new FakeSealedSnapshotConnection();
    this.profileMetadata = { source: profileMetadata.source, target: profileMetadata.target };
    this.brokerMetadata = brokerMetadata;
    this.profilePreflight = { source: true, target: true, ...profilePreflight };
    this.closeFailure = closeFailure;
    this.now = new Date(now);
    this.events = [];
    this.profileResolutionAttempts = { source: 0, target: 0 };
    this.brokerConnectionAttempts = 0;
    this.sourceConnectionAttempts = 0;
    this.targetConnectionAttempts = 0;
  }

  async trustedNow() {
    this.events.push('trusted_now');
    return new Date(this.now.toISOString());
  }

  async resolveProfile({ side, expectedProfile }) {
    this.events.push(`resolve_profile:${side}`);
    this.profileResolutionAttempts[side] += 1;
    return this.profilePreflight[side] === true && profileMatches(this.profileMetadata[side], expectedProfile);
  }

  async verifyBrokerMetadata({ brokerReference, brokerFingerprint }) {
    this.events.push('verify_broker_metadata');
    return Boolean(this.brokerMetadata
      && this.brokerMetadata.brokerReference === brokerReference
      && this.brokerMetadata.brokerFingerprint === brokerFingerprint);
  }

  async openReadOnly({ side }) {
    this.events.push(`open:${side}`);
    this.brokerConnectionAttempts += 1;
    if (side === 'source') this.sourceConnectionAttempts += 1;
    if (side === 'target') this.targetConnectionAttempts += 1;
    const connection = side === 'source' ? this.source : this.target;
    await connection.open();
    return connection;
  }

  async closeReadOnlySessions() { this.events.push('close_readonly_sessions'); }
  async close() {
    this.events.push('close');
    if (this.closeFailure) throw codeError('RUNNER_CLEANUP_FAILED');
  }
}

export class FakePrivateExecutionLedger {
  constructor() {
    this.authorizedBindings = new Map();
    this.records = new Map();
    this.events = [];
  }

  authorizeRun({ runId, bindingHash }) { this.authorizedBindings.set(runId, bindingHash); }
  async claim({ runId, bindingHash }) {
    this.events.push(`claim:${runId}`);
    if (this.authorizedBindings.get(runId) !== bindingHash) return { state: 'UNAUTHORIZED', claimed: false };
    if (this.records.has(runId)) return { state: this.records.get(runId).state, claimed: false };
    this.records.set(runId, { state: 'CLAIMED', bindingHash });
    return { state: 'CLAIMED', claimed: true };
  }
  async complete({ runId, bindingHash }) {
    this.events.push(`complete:${runId}`);
    const record = this.records.get(runId);
    if (!record || record.state !== 'CLAIMED' || record.bindingHash !== bindingHash) return false;
    record.state = 'COMPLETE';
    return true;
  }
  async fail({ runId, bindingHash }) {
    this.events.push(`fail:${runId}`);
    const record = this.records.get(runId);
    if (!record || record.state !== 'CLAIMED' || record.bindingHash !== bindingHash) return false;
    record.state = 'FAILED';
    return true;
  }
}

export class FakePrivateArtifactSink {
  constructor({ failure = {} } = {}) {
    this.failure = failure;
    this.localEphemeral = new Map();
    this.records = [];
    this.commitByLocalRef = new Map();
    this.quarantined = new Map();
    this.revoked = new Set();
    this.cleanupQueue = [];
    this.events = [];
  }

  stateCounts() {
    const committed = this.records.filter((record) => record.status === 'committed');
    return Object.freeze({
      prepared: 0,
      committed: committed.length,
      validCommitted: committed.length,
      quarantined: this.quarantined.size,
      revoked: this.revoked.size,
      cleanupQueue: this.cleanupQueue.length,
      readable: committed.length,
      localEphemeral: this.localEphemeral.size,
    });
  }

  async buildLocalEphemeralBundle({ privatePayload, queryEvidence, canonicalPayloadHash }) {
    this.events.push('local_build');
    if (this.failure.build) throw codeError('SEALED_ARTIFACT_REJECTED');
    const localBundleRef = `local-ephemeral:${this.localEphemeral.size + 1}`;
    this.localEphemeral.set(localBundleRef, {
      privatePayload: structuredClone(privatePayload),
      queryEvidence: structuredClone(queryEvidence),
      canonicalPayloadHash,
      bundleHash: null,
    });
    return Object.freeze({ localBundleRef, canonicalPayloadHash });
  }

  async finalizeLocalEphemeralBundle({ localBundleRef, privateManifest, sanitizedEvidence }) {
    this.events.push('local_finalize');
    const bundle = this.localEphemeral.get(localBundleRef);
    if (!bundle || this.failure.validation) throw codeError('SEALED_ARTIFACT_REJECTED');
    bundle.privateManifest = structuredClone(privateManifest);
    bundle.sanitizedEvidence = structuredClone(sanitizedEvidence);
    bundle.bundleHash = hashCanonical({ privateManifest: bundle.privateManifest, privatePayload: bundle.privatePayload, sanitizedEvidence: bundle.sanitizedEvidence });
    return Object.freeze({ localBundleRef, localBundleHash: this.failure.digestMismatch ? '0'.repeat(64) : bundle.bundleHash });
  }

  async verifyLocalEphemeralBundle({ localBundleRef, localBundleHash, expectedBundleHash }) {
    this.events.push('local_verify');
    if (this.failure.validation || this.failure.digestMismatch) return false;
    const bundle = this.localEphemeral.get(localBundleRef);
    return Boolean(bundle && bundle.bundleHash === localBundleHash && localBundleHash === expectedBundleHash);
  }

  async discardLocalEphemeralBundle({ localBundleRef }) {
    this.events.push('local_abort');
    const bundle = this.localEphemeral.get(localBundleRef);
    this.localEphemeral.delete(localBundleRef);
    if (!bundle) return Object.freeze({ status: 'not_created', readable: false });
    if (this.failure.abort) {
      const quarantineRef = `quarantine:${this.quarantined.size + 1}`;
      this.quarantined.set(quarantineRef, { bundleHash: bundle.bundleHash, readable: false });
      this.cleanupQueue.push({ quarantineRef, reason: 'local_abort_failure' });
      return Object.freeze({ status: 'quarantined', readable: false });
    }
    return Object.freeze({ status: 'deleted', readable: false });
  }

  async atomicCommitFinalBundle({ localBundleRef, expectedBundleHash }) {
    this.events.push('atomic_commit');
    if (this.failure.commit) throw codeError('SEALED_ARTIFACT_REJECTED');
    const bundle = this.localEphemeral.get(localBundleRef);
    if (!bundle || bundle.bundleHash !== expectedBundleHash) throw codeError('SEALED_ARTIFACT_REJECTED');
    this.localEphemeral.delete(localBundleRef);
    const sealedArtifactRef = `sealed-artifact:${this.records.length + 1}`;
    this.commitByLocalRef.set(localBundleRef, sealedArtifactRef);
    this.records.push({ sealedArtifactRef, sealedArtifactHash: expectedBundleHash, status: 'committed', ...bundle });
    return Object.freeze({
      sealedArtifactRef: this.failure.invalidCommitReference ? 'invalid-reference' : sealedArtifactRef,
      sealedArtifactHash: expectedBundleHash,
      localBundleRef,
    });
  }

  async verifyCommittedBundle({ sealedArtifactRef, sealedArtifactHash, expectedBundleHash }) {
    this.events.push('verify_committed');
    if (this.failure.commitPostverify) return false;
    return this.records.some((record) => record.sealedArtifactRef === sealedArtifactRef
      && record.status === 'committed' && record.sealedArtifactHash === sealedArtifactHash && sealedArtifactHash === expectedBundleHash);
  }

  async revokeCommittedBundle({ sealedArtifactRef, localBundleRef }) {
    this.events.push('revoke');
    if (this.failure.revoke) return false;
    const resolvedRef = this.commitByLocalRef.get(localBundleRef) ?? sealedArtifactRef;
    const record = this.records.find((entry) => entry.sealedArtifactRef === resolvedRef);
    if (!record || record.status !== 'committed') return false;
    record.status = 'revoked';
    this.revoked.add(resolvedRef);
    return true;
  }

  async cleanupTemporaryResources({ phase, resourceRegistry }) {
    this.events.push(`cleanup:${phase}`);
    for (const resource of EPHEMERAL_RESOURCES) {
      if (resourceRegistry[resource] !== 'not_created') resourceRegistry[resource] = 'deleted';
    }
    if (this.failure[`cleanup:${phase}`]) resourceRegistry.rawResults = 'failed';
    const statuses = {
      sourceConnectionClosed: cleanupStatus(resourceRegistry.sourceConnection, resourceRegistry.sourceConnection === 'closed'),
      targetConnectionClosed: cleanupStatus(resourceRegistry.targetConnection, resourceRegistry.targetConnection === 'closed'),
      brokerConnectionClosed: cleanupStatus(resourceRegistry.brokerConnection, resourceRegistry.brokerConnection === 'closed'),
      rawResultsDeleted: cleanupStatus(resourceRegistry.rawResults, resourceRegistry.rawResults === 'deleted'),
      canonicalPayloadDeleted: cleanupStatus(resourceRegistry.canonicalPayload, resourceRegistry.canonicalPayload === 'deleted'),
      temporaryManifestDeleted: cleanupStatus(resourceRegistry.temporaryManifest, resourceRegistry.temporaryManifest === 'deleted'),
      temporaryEvidenceDeleted: cleanupStatus(resourceRegistry.temporaryEvidence, resourceRegistry.temporaryEvidence === 'deleted'),
      temporaryLogsDeleted: cleanupStatus(resourceRegistry.temporaryLogs, resourceRegistry.temporaryLogs === 'deleted'),
      downloadedArtifactsDeleted: cleanupStatus(resourceRegistry.downloadedArtifacts, resourceRegistry.downloadedArtifacts === 'deleted'),
      preparedBundleAbortedOrCommitted: cleanupStatus(resourceRegistry.preparedBundle, ['not_created', 'committed', 'discarded', 'quarantined'].includes(resourceRegistry.preparedBundle)),
      listenersStopped: cleanupStatus(resourceRegistry.listeners, resourceRegistry.listeners === 'deleted'),
      childProcessesStopped: cleanupStatus(resourceRegistry.childProcesses, resourceRegistry.childProcesses === 'deleted'),
      temporaryDirectoriesDeleted: cleanupStatus(resourceRegistry.temporaryDirectories, resourceRegistry.temporaryDirectories === 'deleted'),
    };
    return buildCleanupReceipt(statuses);
  }

  static cleanupReceiptFields() { return CLEANUP_RECEIPT_FIELDS; }
}
