import { hashCanonical } from './canonicalization.mjs';

const CLEANUP_RECEIPT_FIELDS = Object.freeze([
  'sourceConnectionClosed',
  'targetConnectionClosed',
  'brokerConnectionClosed',
  'rawResultsDeleted',
  'canonicalPayloadDeleted',
  'temporaryManifestDeleted',
  'temporaryEvidenceDeleted',
  'temporaryLogsDeleted',
  'downloadedArtifactsDeleted',
  'preparedBundleAbortedOrCommitted',
  'listenersStopped',
  'childProcessesStopped',
  'temporaryDirectoriesDeleted',
]);

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

function isFinalized(value) {
  return ['not_created', 'committed', 'aborted', 'revoked'].includes(value);
}

function isClosed(value) {
  return ['not_created', 'closed'].includes(value);
}

function isDeleted(value) {
  return ['not_created', 'deleted'].includes(value);
}

function cleanupReceipt(resourceRegistry) {
  return {
    sourceConnectionClosed: isClosed(resourceRegistry.sourceConnection),
    targetConnectionClosed: isClosed(resourceRegistry.targetConnection),
    brokerConnectionClosed: isClosed(resourceRegistry.brokerConnection),
    rawResultsDeleted: isDeleted(resourceRegistry.rawResults),
    canonicalPayloadDeleted: isDeleted(resourceRegistry.canonicalPayload),
    temporaryManifestDeleted: isDeleted(resourceRegistry.temporaryManifest),
    temporaryEvidenceDeleted: isDeleted(resourceRegistry.temporaryEvidence),
    temporaryLogsDeleted: isDeleted(resourceRegistry.temporaryLogs),
    downloadedArtifactsDeleted: isDeleted(resourceRegistry.downloadedArtifacts),
    preparedBundleAbortedOrCommitted: isFinalized(resourceRegistry.preparedBundle),
    listenersStopped: isDeleted(resourceRegistry.listeners),
    childProcessesStopped: isDeleted(resourceRegistry.childProcesses),
    temporaryDirectoriesDeleted: isDeleted(resourceRegistry.temporaryDirectories),
  };
}

export class FakeSealedSnapshotConnection {
  constructor({ roleAttestation, rowsByQuery = {}, failQuery = null, sealedPackManifestHash = null, queryAttestationHash = null } = {}) {
    this.roleAttestation = roleAttestation ?? {
      currentUserVerified: true,
      transactionReadOnly: true,
      defaultTransactionReadOnly: true,
      canInsert: false,
      canUpdate: false,
      canDelete: false,
      canTruncate: false,
      canDdl: false,
      canFunctionWrite: false,
      bypassRls: false,
      serviceRole: false,
      inheritsPrivileges: false,
    };
    this.rowsByQuery = rowsByQuery;
    this.failQuery = failQuery;
    this.sealedPackManifestHash = sealedPackManifestHash;
    this.queryAttestationHash = queryAttestationHash;
    this.events = [];
  }

  async open() { this.events.push('open'); }
  async beginReadOnly() { this.events.push('begin_read_only'); }
  async attestReadOnly() { this.events.push('attest_read_only'); return this.roleAttestation; }
  async attestSealedQueryPacks({ contentHash, queryAttestations }) {
    this.events.push('attest_sealed_query_packs');
    return this.sealedPackManifestHash === contentHash && this.queryAttestationHash === hashCanonical(queryAttestations);
  }
  async executeFixed({ queryId }) {
    this.events.push(`query:${queryId}`);
    if (this.failQuery === queryId) throw new Error('FAKE_QUERY_FAILURE');
    return structuredClone(this.rowsByQuery[queryId] ?? []);
  }
  async rollback() { this.events.push('rollback'); }
  async close() { this.events.push('close'); }
}

export class FakeSealedSnapshotBroker {
  constructor({ source, target, profilePreflight = {}, closeFailure = false, now = '2026-08-09T04:00:00.000Z' } = {}) {
    this.source = source ?? new FakeSealedSnapshotConnection();
    this.target = target ?? new FakeSealedSnapshotConnection();
    this.profilePreflight = { source: true, target: true, ...profilePreflight };
    this.closeFailure = closeFailure;
    this.now = new Date(now);
    this.events = [];
  }

  async preflightProfile({ side }) {
    this.events.push(`preflight:${side}`);
    return this.profilePreflight[side] === true;
  }

  async trustedNow() {
    this.events.push('trusted_now');
    return new Date(this.now.toISOString());
  }

  async openReadOnly({ side }) {
    this.events.push(`open:${side}`);
    const connection = side === 'source' ? this.source : this.target;
    await connection.open();
    return connection;
  }

  async close() {
    this.events.push('close');
    if (this.closeFailure) throw Object.assign(new Error('BROKER_CLOSE_FAILED'), { code: 'RUNNER_CLEANUP_FAILED' });
  }
}

export class FakePrivateExecutionLedger {
  constructor() {
    this.authorizedBindings = new Map();
    this.records = new Map();
    this.events = [];
  }

  authorizeRun({ runId, bindingHash }) {
    this.authorizedBindings.set(runId, bindingHash);
  }

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
    this.prepared = new Map();
    this.committedByPrepared = new Map();
    this.records = [];
    this.events = [];
  }

  async prepareSealedBundle({ privateManifest, privatePayload, sanitizedEvidence, bundleHash }) {
    this.events.push('prepare');
    if (this.failure.prepare) throw Object.assign(new Error('PREPARE_FAILED'), { code: 'SEALED_ARTIFACT_REJECTED' });
    const preparedBundleRef = `prepared-bundle:${this.prepared.size + 1}`;
    this.prepared.set(preparedBundleRef, {
      bundleHash,
      privateManifest: structuredClone(privateManifest),
      privatePayload: structuredClone(privatePayload),
      sanitizedEvidence: structuredClone(sanitizedEvidence),
    });
    return { preparedBundleRef, preparedBundleHash: bundleHash };
  }

  async verifyPreparedBundle({ preparedBundleRef, preparedBundleHash, expectedBundleHash }) {
    this.events.push('verify_prepared');
    if (this.failure.verify) return false;
    const prepared = this.prepared.get(preparedBundleRef);
    return Boolean(prepared && prepared.bundleHash === preparedBundleHash && preparedBundleHash === expectedBundleHash);
  }

  async commitSealedBundle({ preparedBundleRef, expectedBundleHash }) {
    this.events.push('commit');
    if (this.failure.commit) throw Object.assign(new Error('COMMIT_FAILED'), { code: 'SEALED_ARTIFACT_REJECTED' });
    const prepared = this.prepared.get(preparedBundleRef);
    if (!prepared || prepared.bundleHash !== expectedBundleHash) throw Object.assign(new Error('COMMIT_REJECTED'), { code: 'SEALED_ARTIFACT_REJECTED' });
    this.prepared.delete(preparedBundleRef);
    const sealedArtifactRef = `sealed-artifact:${this.records.length + 1}`;
    this.committedByPrepared.set(preparedBundleRef, sealedArtifactRef);
    this.records.push({ sealedArtifactRef, sealedArtifactHash: expectedBundleHash, ...prepared });
    return {
      sealedArtifactRef: this.failure.invalidCommitReference ? 'invalid-reference' : sealedArtifactRef,
      sealedArtifactHash: expectedBundleHash,
    };
  }

  async abortSealedBundle({ preparedBundleRef }) {
    this.events.push('abort');
    if (this.failure.abort) return false;
    this.prepared.delete(preparedBundleRef);
    return true;
  }

  async revokeCommittedBundle({ sealedArtifactRef, preparedBundleRef }) {
    this.events.push('revoke');
    if (this.failure.revoke) return false;
    const privateArtifactRef = this.committedByPrepared.get(preparedBundleRef) ?? sealedArtifactRef;
    const index = this.records.findIndex((entry) => entry.sealedArtifactRef === privateArtifactRef);
    if (index >= 0) this.records.splice(index, 1);
    return true;
  }

  async cleanupTemporaryResources({ phase, resourceRegistry }) {
    this.events.push(`cleanup:${phase}`);
    for (const resource of EPHEMERAL_RESOURCES) {
      if (resourceRegistry[resource] !== 'not_created') resourceRegistry[resource] = 'deleted';
    }
    const receipt = cleanupReceipt(resourceRegistry);
    if (this.failure[`cleanup:${phase}`]) receipt.rawResultsDeleted = false;
    return receipt;
  }

  static cleanupReceiptFields() {
    return CLEANUP_RECEIPT_FIELDS;
  }
}
