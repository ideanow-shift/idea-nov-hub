export class FakeAuditConnection {
  constructor({ roleClass = 'dedicated_production_audit_login', serviceRole = false, canWrite = false, readOnly = true, rowsByQuery = {}, failQuery = null } = {}) {
    Object.assign(this, { roleClass, serviceRole, canWrite, readOnly, rowsByQuery, failQuery, events: [] });
  }
  async open() { this.events.push('open'); }
  async beginReadOnly() { this.events.push('begin_read_only'); }
  async verifyReadOnly() { this.events.push('verify_read_only'); return this.readOnly; }
  async executeFixed(query) { this.events.push(`query:${query.queryId}`); if (this.failQuery === query.queryId) throw new Error('FAKE_QUERY_FAILURE'); return this.rowsByQuery[query.queryId] ?? []; }
  async rollback() { this.events.push('rollback'); }
  async close() { this.events.push('close'); }
}
