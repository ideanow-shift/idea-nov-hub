import { appendFile, readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { AuthError } from "../../sandbox/auth-foundation/foundation.mjs";

const clone = (value) => structuredClone(value);
const timeout = (ms, reason) => new Promise((_, reject) => setTimeout(() => reject(new AuthError(504, reason)), ms));

export class SyntheticCoreRepository {
  constructor(fixture, { latencyMs = 0, generatedAt = Date.now() } = {}) {
    this.fixture = clone(fixture);
    this.latencyMs = latencyMs;
    this.generatedAt = generatedAt;
  }
  async read(collection) {
    if (this.latencyMs) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    return clone(this.fixture[collection]);
  }
}

export class StagingCoreReadAdapter {
  constructor(repository, { version = "staging-v1", timeoutMs = 100, staleAfterMs = 60_000, now = () => Date.now() } = {}) {
    this.repository = repository;
    this.version = version;
    this.timeoutMs = timeoutMs;
    this.staleAfterMs = staleAfterMs;
    this.now = now;
  }

  async #read(collection) {
    const data = await Promise.race([this.repository.read(collection), timeout(this.timeoutMs, "adapter_timeout")]);
    if (this.now() - this.repository.generatedAt > this.staleAfterMs) throw new AuthError(503, "adapter_stale");
    return data;
  }

  #envelope(data) { return { adapterVersion: this.version, asOf: new Date(this.now()).toISOString(), data }; }
  async getEmployeeSummary(id) {
    const employee = (await this.#read("employees")).find((item) => item.id === id);
    if (!employee || !employee.active || employee.retired) throw new AuthError(404, "employee_not_active");
    return this.#envelope({ id: employee.id, displayName: employee.displayName, corporationId: employee.corporationId });
  }
  async getEmployeeRoles(id) {
    const employee = (await this.#read("employees")).find((item) => item.id === id);
    return this.#envelope(employee?.active && !employee.retired ? employee.roles : []);
  }
  async getActiveAssignments(id, effectiveAt = this.now()) {
    const employee = (await this.#read("employees")).find((item) => item.id === id);
    const values = employee?.assignments.filter((item) =>
      item.active &&
      (!item.effectiveFrom || Date.parse(item.effectiveFrom) <= effectiveAt) &&
      (!item.effectiveTo || effectiveAt < Date.parse(item.effectiveTo))
    ) ?? [];
    return this.#envelope(values);
  }
  async getStore(id, actor) {
    const store = (await this.#read("stores")).find((item) => item.id === id);
    if (!store) throw new AuthError(404, "store_not_found");
    if (actor.principalType === "employee" && !actor.storeIds.includes(id) && !actor.scopes.some((s) => s.type === "all")) {
      throw new AuthError(403, store.corporationId !== actor.corporationId ? "corporation_scope_denied" : "store_scope_denied");
    }
    return this.#envelope(store);
  }
  async getCorporation(id, actor) {
    if (actor.principalType === "terminal" || actor.principalType === "service") throw new AuthError(403, "principal_type_denied");
    if (actor.corporationId !== id && !actor.scopes.some((s) => s.type === "all")) throw new AuthError(403, "corporation_scope_denied");
    return this.#envelope((await this.#read("corporations")).find((item) => item.id === id) ?? null);
  }
  async getApplicationPermissions(appId) { return this.#envelope((await this.#read("permissions"))[appId] ?? []); }
  async getIdentityStatus(uid) {
    const matches = (await this.#read("employees")).filter((item) => item.firebaseUid === uid);
    if (matches.length === 0) throw new AuthError(403, "identity_unresolved");
    if (matches.length > 1) throw new AuthError(409, "identity_ambiguous");
    return this.#envelope({ active: matches[0].active, retired: matches[0].retired, loginEnabled: matches[0].loginEnabled });
  }
}

const mask = (value) => {
  const allowed = {
    event_id: value.event_id ?? randomUUID(),
    timestamp: value.timestamp ?? new Date().toISOString(),
    actor_principal: value.actor_principal,
    employee_id: value.employee_id ?? null,
    terminal_id: value.terminal_id ?? null,
    firebase_uid_hash: value.firebase_uid ? createHash("sha256").update(value.firebase_uid).digest("hex") : null,
    app_id: value.app_id,
    session_id_hash: value.session_id ? createHash("sha256").update(value.session_id).digest("hex") : null,
    action: value.action,
    resource_type: value.resource_type,
    resource_id: value.resource_id,
    store_id: value.store_id ?? null,
    corporation_id: value.corporation_id ?? null,
    result: value.result,
    deny_reason: value.deny_reason ?? null,
    request_id: value.request_id,
    correlation_id: value.correlation_id
  };
  return allowed;
};

export class JsonlAuditStore {
  constructor({ path, failWrites = false }) {
    this.path = path;
    this.failWrites = failWrites;
    this.lastHash = "GENESIS";
  }
  async append(event, { privileged = false } = {}) {
    if (this.failWrites) {
      if (privileged) throw new AuthError(503, "audit_unavailable");
      return { persisted: false };
    }
    const masked = mask(event);
    const hash = createHash("sha256").update(`${this.lastHash}:${JSON.stringify(masked)}`).digest("hex");
    await appendFile(this.path, `${JSON.stringify({ ...masked, previous_hash: this.lastHash, hash })}\n`, "utf8");
    this.lastHash = hash;
    return { persisted: true, hash };
  }
  async verifyIntegrity() {
    let previous = "GENESIS";
    const text = await readFile(this.path, "utf8");
    for (const line of text.trim().split("\n").filter(Boolean)) {
      const { hash, previous_hash, ...event } = JSON.parse(line);
      const expected = createHash("sha256").update(`${previous}:${JSON.stringify(event)}`).digest("hex");
      if (previous_hash !== previous || hash !== expected) return false;
      previous = hash;
    }
    return true;
  }
}
