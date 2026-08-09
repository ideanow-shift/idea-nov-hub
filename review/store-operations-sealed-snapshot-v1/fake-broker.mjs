export class FakeSealedSnapshotConnection {
  constructor({ roleAttestation, rowsByQuery = {}, failQuery = null, sealedPackManifestHash = null } = {}) {
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
    this.events = [];
  }

  async open() { this.events.push('open'); }
  async beginReadOnly() { this.events.push('begin_read_only'); }
  async attestReadOnly() { this.events.push('attest_read_only'); return this.roleAttestation; }
  async attestSealedQueryPacks({ contentHash }) {
    this.events.push('attest_sealed_query_packs');
    return this.sealedPackManifestHash === contentHash;
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
  constructor({ source, target } = {}) {
    this.source = source ?? new FakeSealedSnapshotConnection();
    this.target = target ?? new FakeSealedSnapshotConnection();
    this.events = [];
  }

  async openReadOnly({ side }) {
    this.events.push(`open:${side}`);
    const connection = side === 'source' ? this.source : this.target;
    await connection.open();
    return connection;
  }
}

export class FakePrivateArtifactSink {
  constructor() { this.records = []; this.cleanupCount = 0; }
  async storeSealed(artifact) {
    this.records.push(structuredClone(artifact));
    return `sealed-artifact:${this.records.length}`;
  }
  async cleanupEphemeral() { this.cleanupCount += 1; }
}
