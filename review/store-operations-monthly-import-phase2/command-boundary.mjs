export const COMMANDS = Object.freeze([
  "upload", "dry-run", "validate", "import", "review", "publish", "rollback",
]);

export const VERSION_STATUS = Object.freeze({
  uploaded: "uploaded",
  validating: "validating",
  validation_failed: "validation_failed",
  imported: "imported",
  reviewing: "reviewing",
  published: "published",
  superseded: "superseded",
  rolled_back: "rolled_back",
});

const ROLE = Object.freeze({
  accounting: "accounting",
  representative: "representative",
  salesDirector: "sales_director",
  am: "am",
  storeManager: "store_manager",
  employee: "employee",
});

export const FIXTURE_STORE_CATALOG = Object.freeze([...Array(20)].map((_, index) => Object.freeze({
  store_id: `fixture-store-${String(index + 1).padStart(2, "0")}`,
  direct_or_fc: index < 13 ? "direct" : "fc",
})));

const PUBLIC_READ_ROLES = new Set([ROLE.accounting, ROLE.representative, ROLE.salesDirector, ROLE.am, ROLE.storeManager]);
const ACCOUNTING_COMMANDS = new Set(["upload", "dry-run", "validate", "import", "review", "publish"]);
const AUTHORITY_SHAPED_KEYS = new Set(["role", "roles", "storeScope", "storeIds", "employeeId", "actorId", "approvalStatus"]);

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function copy(value) {
  return structuredClone(value);
}

function assertObject(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
}

function assertAllowedKeys(input, allowed) {
  assertObject(input, "COMMAND_INPUT_INVALID");
  for (const key of Object.keys(input)) {
    if (AUTHORITY_SHAPED_KEYS.has(key) || !allowed.has(key)) fail("COMMAND_INPUT_INVALID");
  }
}

function assertPeriod(value) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/u.test(String(value ?? ""))) fail("TARGET_PERIOD_INVALID");
}

function assertActor(actor) {
  if (!actor || actor.source !== "server" || typeof actor.employeeId !== "string" || !Array.isArray(actor.roles)) {
    fail("AUTHENTICATION_REQUIRED");
  }
  return actor;
}

function hasRole(actor, role) {
  return actor.roles.includes(role);
}

function requireAccounting(actor) {
  if (!hasRole(actor, ROLE.accounting)) fail("FORBIDDEN");
}

function resolvePublishedStoreScope(actor) {
  if (hasRole(actor, ROLE.accounting) || hasRole(actor, ROLE.representative)) return FIXTURE_STORE_CATALOG.map(({ store_id }) => store_id);
  if (hasRole(actor, ROLE.salesDirector)) return FIXTURE_STORE_CATALOG
    .filter(({ direct_or_fc }) => direct_or_fc === "direct").map(({ store_id }) => store_id);
  if (hasRole(actor, ROLE.am)) {
    if (!actor.assignmentVerified || !Array.isArray(actor.storeIds) || actor.storeIds.length === 0) fail("FORBIDDEN");
    const scope = [...new Set(actor.storeIds)].filter((storeId) => FIXTURE_STORE_CATALOG.some((store) => store.store_id === storeId));
    if (scope.length !== actor.storeIds.length) fail("FORBIDDEN");
    return scope;
  }
  if (hasRole(actor, ROLE.storeManager)) {
    if (!Array.isArray(actor.storeIds) || actor.storeIds.length !== 1 || !FIXTURE_STORE_CATALOG.some((store) => store.store_id === actor.storeIds[0])) fail("FORBIDDEN");
    return [...actor.storeIds];
  }
  fail("FORBIDDEN");
}

function nowIso(clock, offset = 0) {
  return new Date(clock() + offset).toISOString();
}

export function createFixtureImportCenter({ clock = () => Date.UTC(2026, 7, 2, 4, 0, 0), fixtureVersionMutator = null } = {}) {
  const versions = new Map();
  const auditEvents = [];
  let versionSequence = 0;
  let eventSequence = 0;

  function appendAudit({ command, actor, version, previousState, nextState, reason = null, result = "success", details = {} }) {
    const event = Object.freeze({
      event_id: `fixture-audit-${++eventSequence}`,
      command,
      actor_id: actor?.source === "server" ? actor.employeeId : null,
      role: actor?.source === "server" ? [...actor.roles].sort().join(",") : "unresolved",
      target_period: version?.target_period ?? null,
      version_id: version?.version_id ?? null,
      previous_state: previousState ?? null,
      next_state: nextState ?? null,
      timestamp: nowIso(clock, eventSequence),
      reason,
      result,
      details: copy(details),
    });
    auditEvents.push(event);
    return event;
  }

  function getVersion(versionId) {
    const version = versions.get(versionId);
    if (!version) fail("VERSION_NOT_FOUND");
    return version;
  }

  function versionsForPeriod(period) {
    return [...versions.values()].filter((version) => version.target_period === period);
  }

  function validateRollbackCandidate(current) {
    if (!Number.isInteger(current.version_number) || !current.created_at || !current.published_at) fail("ROLLBACK_CANDIDATE_INVALID");
    const currentPublishedAt = Date.parse(current.published_at);
    if (!Number.isFinite(currentPublishedAt)) fail("ROLLBACK_CANDIDATE_INVALID");
    const samePeriod = versionsForPeriod(current.target_period);
    if (samePeriod.some((candidate) => !Number.isInteger(candidate.version_number) || !candidate.created_at)) fail("ROLLBACK_CANDIDATE_INVALID");
    if (new Set(samePeriod.map((candidate) => candidate.version_number)).size !== samePeriod.length) fail("ROLLBACK_CANDIDATE_INVALID");
    const candidates = samePeriod.filter((candidate) => {
      if (candidate.target_period !== current.target_period || candidate.status !== VERSION_STATUS.superseded) return false;
      const publishedAt = Date.parse(candidate.published_at ?? "");
      return Number.isFinite(publishedAt) && candidate.version_number < current.version_number && publishedAt < currentPublishedAt;
    });
    if (candidates.length === 0) fail("ROLLBACK_CANDIDATE_INVALID");
    const candidate = candidates.reduce((latest, value) => value.version_number > latest.version_number ? value : latest);
    if (candidate.target_period !== current.target_period) fail("ROLLBACK_CANDIDATE_INVALID");
    return candidate;
  }

  function execute(request) {
    const command = request?.command;
    const actor = request?.actor;
    const input = request?.input;
    let version = input?.versionId ? versions.get(input.versionId) ?? null : null;
    const previousState = version?.status ?? null;
    try {
      return executeCommand({ command, actor, input }, (resolvedVersion) => { version = resolvedVersion; });
    } catch (error) {
      appendAudit({ command: COMMANDS.includes(command) ? command : "unknown", actor, version,
        previousState, nextState: previousState, reason: error.code ?? "COMMAND_FAILED", result: "failure" });
      throw error;
    }
  }

  function executeCommand({ command, actor, input }, setVersion) {
    if (!COMMANDS.includes(command)) fail("COMMAND_NOT_ALLOWED");
    const serverActor = assertActor(actor);
    if (ACCOUNTING_COMMANDS.has(command)) requireAccounting(serverActor);

    if (command === "upload") {
      assertAllowedKeys(input, new Set(["targetPeriod", "workbookHash", "fileName"]));
      assertPeriod(input.targetPeriod);
      if (!/^[a-f0-9]{64}$/u.test(String(input.workbookHash ?? "")) || !String(input.fileName ?? "").trim()) fail("COMMAND_INPUT_INVALID");
      const version = {
        version_id: `fixture-version-${++versionSequence}`,
        version_number: versionSequence,
        created_at: nowIso(clock, versionSequence),
        published_at: null,
        target_period: input.targetPeriod,
        workbook_hash: input.workbookHash,
        source_file_name: input.fileName,
        status: VERSION_STATUS.uploaded,
        dry_run: null,
        validation_passed: false,
        rollback_approvals: new Map(),
      };
      if (fixtureVersionMutator) fixtureVersionMutator(version);
      versions.set(version.version_id, version);
      setVersion(version);
      appendAudit({ command, actor: serverActor, version, previousState: null, nextState: version.status,
        reason: "workbook_uploaded", details: { source_file_name: input.fileName } });
      return snapshot(version);
    }

    assertAllowedKeys(input, command === "dry-run"
      ? new Set(["versionId", "report"])
      : command === "validate"
        ? new Set(["versionId", "valid", "reasonCategory"])
        : command === "review"
          ? new Set(["versionId", "accepted"])
          : command === "rollback"
            ? new Set(["versionId", "reasonCategory"])
            : new Set(["versionId"]));
    const version = getVersion(input.versionId);
    setVersion(version);

    if (command === "dry-run") {
      if (version.status !== VERSION_STATUS.uploaded) fail("STATE_TRANSITION_REJECTED");
      assertObject(input.report, "COMMAND_INPUT_INVALID");
      const required = ["status", "mapping", "quarantine_count", "normalized_record_count"];
      if (input.report.status !== "DRY_RUN_READY" || required.some((key) => !(key in input.report))) fail("DRY_RUN_REJECTED");
      version.dry_run = copy(input.report);
      appendAudit({ command, actor: serverActor, version, previousState: version.status, nextState: version.status,
        reason: "dry_run_completed", details: { quarantine_count: input.report.quarantine_count, normalized_record_count: input.report.normalized_record_count } });
      return snapshot(version);
    }

    if (command === "validate") {
      if (version.status !== VERSION_STATUS.uploaded || !version.dry_run) fail("STATE_TRANSITION_REJECTED");
      if (typeof input.valid !== "boolean") fail("COMMAND_INPUT_INVALID");
      const previousState = version.status;
      version.status = VERSION_STATUS.validating;
      version.validation_passed = input.valid;
      if (!input.valid) {
        version.status = VERSION_STATUS.validation_failed;
      }
      appendAudit({ command, actor: serverActor, version, previousState, nextState: version.status,
        reason: input.valid ? "validation_passed" : input.reasonCategory ?? "validation_failed" });
      return snapshot(version);
    }

    if (command === "import") {
      if (version.status !== VERSION_STATUS.validating || !version.validation_passed) fail("STATE_TRANSITION_REJECTED");
      const previousState = version.status;
      version.status = VERSION_STATUS.imported;
      appendAudit({ command, actor: serverActor, version, previousState, nextState: version.status, reason: "version_imported" });
      return snapshot(version);
    }

    if (command === "review") {
      if (version.status !== VERSION_STATUS.imported || input.accepted !== true) fail("STATE_TRANSITION_REJECTED");
      const previousState = version.status;
      version.status = VERSION_STATUS.reviewing;
      appendAudit({ command, actor: serverActor, version, previousState, nextState: version.status, reason: "review_accepted" });
      return snapshot(version);
    }

    if (command === "publish") {
      if (version.status !== VERSION_STATUS.reviewing) fail("STATE_TRANSITION_REJECTED");
      for (const prior of versionsForPeriod(version.target_period)) {
        if (prior.version_id !== version.version_id && prior.status === VERSION_STATUS.published) {
          const priorState = prior.status;
          prior.status = VERSION_STATUS.superseded;
          appendAudit({ command, actor: serverActor, version: prior, previousState: priorState, nextState: prior.status,
            reason: "version_superseded", details: { superseded_by: version.version_id } });
        }
      }
      const previousState = version.status;
      version.status = VERSION_STATUS.published;
      version.published_at = nowIso(clock, Number.isInteger(version.version_number) ? version.version_number : 0);
      appendAudit({ command, actor: serverActor, version, previousState, nextState: version.status, reason: "version_published" });
      return snapshot(version);
    }

    if (!hasRole(serverActor, ROLE.accounting) && !hasRole(serverActor, ROLE.representative)) fail("FORBIDDEN");
    if (version.status !== VERSION_STATUS.published) fail("STATE_TRANSITION_REJECTED");
    if (!String(input.reasonCategory ?? "").trim()) fail("COMMAND_INPUT_INVALID");
    const approvalRole = hasRole(serverActor, ROLE.accounting) ? ROLE.accounting : ROLE.representative;
    version.rollback_approvals.set(approvalRole, serverActor.employeeId);
    appendAudit({ command, actor: serverActor, version, previousState: version.status, nextState: version.status,
      reason: input.reasonCategory, details: { approval_role: approvalRole } });
    const accountingActor = version.rollback_approvals.get(ROLE.accounting);
    const representativeActor = version.rollback_approvals.get(ROLE.representative);
    if (!accountingActor || !representativeActor || accountingActor === representativeActor) return { status: "ROLLBACK_PENDING", version: snapshot(version) };
    const restore = validateRollbackCandidate(version);
    const previousState = version.status;
    version.status = VERSION_STATUS.rolled_back;
    appendAudit({ command, actor: serverActor, version, previousState, nextState: version.status, reason: input.reasonCategory });
    const restorePreviousState = restore.status;
    restore.status = VERSION_STATUS.published;
    appendAudit({ command, actor: serverActor, version: restore, previousState: restorePreviousState, nextState: restore.status,
      reason: "prior_version_restored", details: { restored_after: version.version_id } });
    return { status: "ROLLBACK_COMPLETED", version: snapshot(version), restored_version: restore ? snapshot(restore) : null };
  }

  function readPublished({ actor, targetPeriod }) {
    const serverActor = assertActor(actor);
    assertPeriod(targetPeriod);
    if (!PUBLIC_READ_ROLES.has(serverActor.roles.find((role) => PUBLIC_READ_ROLES.has(role)))) fail("FORBIDDEN");
    const storeScope = resolvePublishedStoreScope(serverActor);
    const published = versionsForPeriod(targetPeriod).find((version) => version.status === VERSION_STATUS.published);
    if (!published) return { status: "NOT_PUBLISHED", version: null, store_scope: storeScope };
    return { status: "PUBLISHED", version: snapshot(published), store_scope: storeScope };
  }

  return Object.freeze({
    mode: "fixture_only",
    execute,
    readPublished,
    listAuditEvents: () => auditEvents.map((event) => copy(event)),
    listVersions: () => [...versions.values()].map((version) => snapshot(version)),
    counters: () => ({ db_connection_count: 0, production_connection_count: 0, file_write_count: 0 }),
  });
}

function snapshot(version) {
  return copy({
    version_id: version.version_id,
    version_number: version.version_number,
    created_at: version.created_at,
    published_at: version.published_at,
    target_period: version.target_period,
    workbook_hash: version.workbook_hash,
    source_file_name: version.source_file_name,
    status: version.status,
    validation_passed: version.validation_passed,
    dry_run: version.dry_run,
  });
}

export const FIXTURE_ROLE = ROLE;
