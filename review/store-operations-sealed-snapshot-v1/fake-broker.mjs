import { createHash } from 'node:crypto';
import { buildCleanupReceipt, CLEANUP_RECEIPT_FIELDS } from './cleanup-receipt.mjs';
import { hashCanonical } from './canonicalization.mjs';

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
  const fields = ['profileReference', 'profileFingerprint', 'environment', 'projectIdentityReference', 'brokerReference', 'notBefore', 'expiresAt'];
  return Boolean(actual && expected && fields.every((field) => actual[field] === expected[field]));
}

function cleanupStatus(value, passed) {
  if (value === 'not_created') return 'not_created';
  return passed ? 'pass' : 'failed';
}

export class FakeSealedSnapshotConnection {
  constructor({ roleAttestation, rowsByQuery = {}, failQuery = null, sealedPackManifestHash = null, queryAttestationHash = null, expectedSqlHashes = {} } = {}) {
    this.roleAttestation = roleAttestation ?? {
      currentUserVerified: true,
      transactionReadOnly: true,
      defaultTransactionReadOnly: true,
      roleClosureChecked: true,
      ownershipChecked: true,
      tempChecked: true,
      routineExecuteChecked: true,
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
      canTemporaryCreate: false,
      canAlterDrop: false,
      canFunctionExecute: false,
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
    this.events = [];
    this.executionCount = 0;
    this.sqlByteHashes = [];
  }

  async open() { this.events.push('open'); }
  async beginReadOnly() { this.events.push('begin_read_only'); }
  async attestReadOnly() { this.events.push('attest_read_only'); return this.roleAttestation; }
  async attestSealedQueryPacks({ contentHash, queryAttestations }) {
    this.events.push('attest_sealed_query_packs');
    return this.sealedPackManifestHash === contentHash && this.queryAttestationHash === hashCanonical(queryAttestations);
  }
  async executeFixed({ queryId, sqlText, sqlBytes, sqlSha256 }) {
    this.events.push(`query:${queryId}`);
    this.executionCount += 1;
    if (typeof sqlText !== 'string' || !Buffer.isBuffer(sqlBytes)
      || !Buffer.from(sqlText, 'utf8').equals(sqlBytes)
      || sha256Bytes(sqlBytes) !== sqlSha256
      || this.expectedSqlHashes[queryId] !== sqlSha256) {
      throw codeError('FIXED_SQL_HASH_MISMATCH');
    }
    this.sqlByteHashes.push({ queryId, sqlSha256 });
    if (this.failQuery === queryId) throw codeError('FAKE_QUERY_FAILURE');
    return structuredClone(this.rowsByQuery[queryId] ?? []);
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
