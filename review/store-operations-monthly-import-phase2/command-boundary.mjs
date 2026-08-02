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

function nowIso(clock) {
  return new Date(clock()).toISOString();
}

export function createFixtureImportCenter({ clock = () => Date.UTC(2026, 7, 2, 4, 0, 0) } = {}) {
  const versions = new Map();
  const auditEvents = [];
  let versionSequence = 0;
  let eventSequence = 0;

  function appendAudit(kind, actor, version, details = {}) {
    const event = Object.freeze({
      event_id: `fixture-audit-${++eventSequence}`,
      occurred_at: nowIso(clock),
      event_type: kind,
      actor_employee_id: actor.employeeId,
      version_id: version.version_id,
      target_period: version.target_period,
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

  function execute({ command, actor, input }) {
    if (!COMMANDS.includes(command)) fail("COMMAND_NOT_ALLOWED");
    const serverActor = assertActor(actor);
    if (ACCOUNTING_COMMANDS.has(command)) requireAccounting(serverActor);

    if (command === "upload") {
      assertAllowedKeys(input, new Set(["targetPeriod", "workbookHash", "fileName"]));
      assertPeriod(input.targetPeriod);
      if (!/^[a-f0-9]{64}$/u.test(String(input.workbookHash ?? "")) || !String(input.fileName ?? "").trim()) fail("COMMAND_INPUT_INVALID");
      const version = {
        version_id: `fixture-version-${++versionSequence}`,
        target_period: input.targetPeriod,
        workbook_hash: input.workbookHash,
        source_file_name: input.fileName,
        status: VERSION_STATUS.uploaded,
        dry_run: null,
        validation_passed: false,
        rollback_approvals: new Map(),
      };
      versions.set(version.version_id, version);
      appendAudit("workbook_uploaded", serverActor, version, { source_file_name: input.fileName });
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

    if (command === "dry-run") {
      if (version.status !== VERSION_STATUS.uploaded) fail("STATE_TRANSITION_REJECTED");
      assertObject(input.report, "COMMAND_INPUT_INVALID");
      const required = ["status", "mapping", "quarantine_count", "normalized_record_count"];
      if (input.report.status !== "DRY_RUN_READY" || required.some((key) => !(key in input.report))) fail("DRY_RUN_REJECTED");
      version.dry_run = copy(input.report);
      appendAudit("dry_run_completed", serverActor, version, { quarantine_count: input.report.quarantine_count, normalized_record_count: input.report.normalized_record_count });
      return snapshot(version);
    }

    if (command === "validate") {
      if (version.status !== VERSION_STATUS.uploaded || !version.dry_run) fail("STATE_TRANSITION_REJECTED");
      if (typeof input.valid !== "boolean") fail("COMMAND_INPUT_INVALID");
      version.status = VERSION_STATUS.validating;
      appendAudit("validation_started", serverActor, version);
      version.validation_passed = input.valid;
      if (!input.valid) {
        version.status = VERSION_STATUS.validation_failed;
        appendAudit("validation_failed", serverActor, version, { reason_category: input.reasonCategory ?? "validation_failed" });
      } else {
        appendAudit("validation_passed", serverActor, version);
      }
      return snapshot(version);
    }

    if (command === "import") {
      if (version.status !== VERSION_STATUS.validating || !version.validation_passed) fail("STATE_TRANSITION_REJECTED");
      version.status = VERSION_STATUS.imported;
      appendAudit("version_imported", serverActor, version);
      return snapshot(version);
    }

    if (command === "review") {
      if (version.status !== VERSION_STATUS.imported || input.accepted !== true) fail("STATE_TRANSITION_REJECTED");
      version.status = VERSION_STATUS.reviewing;
      appendAudit("review_accepted", serverActor, version);
      return snapshot(version);
    }

    if (command === "publish") {
      if (version.status !== VERSION_STATUS.reviewing) fail("STATE_TRANSITION_REJECTED");
      for (const prior of versionsForPeriod(version.target_period)) {
        if (prior.version_id !== version.version_id && prior.status === VERSION_STATUS.published) {
          prior.status = VERSION_STATUS.superseded;
          appendAudit("version_superseded", serverActor, prior, { superseded_by: version.version_id });
        }
      }
      version.status = VERSION_STATUS.published;
      appendAudit("version_published", serverActor, version);
      return snapshot(version);
    }

    if (!hasRole(serverActor, ROLE.accounting) && !hasRole(serverActor, ROLE.representative)) fail("FORBIDDEN");
    if (version.status !== VERSION_STATUS.published) fail("STATE_TRANSITION_REJECTED");
    if (!String(input.reasonCategory ?? "").trim()) fail("COMMAND_INPUT_INVALID");
    const approvalRole = hasRole(serverActor, ROLE.accounting) ? ROLE.accounting : ROLE.representative;
    version.rollback_approvals.set(approvalRole, serverActor.employeeId);
    appendAudit("rollback_approval_recorded", serverActor, version, { approval_role: approvalRole, reason_category: input.reasonCategory });
    const accountingActor = version.rollback_approvals.get(ROLE.accounting);
    const representativeActor = version.rollback_approvals.get(ROLE.representative);
    if (!accountingActor || !representativeActor || accountingActor === representativeActor) return { status: "ROLLBACK_PENDING", version: snapshot(version) };
    version.status = VERSION_STATUS.rolled_back;
    appendAudit("version_rolled_back", serverActor, version, { reason_category: input.reasonCategory });
    const restore = versionsForPeriod(version.target_period)
      .filter((candidate) => candidate.status === VERSION_STATUS.superseded)
      .sort((left, right) => right.version_id.localeCompare(left.version_id))[0];
    if (restore) {
      restore.status = VERSION_STATUS.published;
      appendAudit("prior_version_restored", serverActor, restore, { restored_after: version.version_id });
    }
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
    target_period: version.target_period,
    workbook_hash: version.workbook_hash,
    source_file_name: version.source_file_name,
    status: version.status,
    validation_passed: version.validation_passed,
    dry_run: version.dry_run,
  });
}

export const FIXTURE_ROLE = ROLE;
