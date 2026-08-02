import assert from "node:assert/strict";
import test from "node:test";
import { createFixtureImportCenter, FIXTURE_ROLE, VERSION_STATUS } from "../review/store-operations-monthly-import-phase2/command-boundary.mjs";

const hash = (value) => String(value).repeat(64).slice(0, 64);
const accounting = { source: "server", employeeId: "fixture-accounting", roles: [FIXTURE_ROLE.accounting] };
const representative = { source: "server", employeeId: "fixture-representative", roles: [FIXTURE_ROLE.representative] };
const employee = { source: "server", employeeId: "fixture-employee", roles: [FIXTURE_ROLE.employee] };
const unassignedAm = { source: "server", employeeId: "fixture-am", roles: [FIXTURE_ROLE.am], assignmentVerified: true, storeIds: [] };
const report = { status: "DRY_RUN_READY", mapping: { store_count: 20, direct_count: 13, fc_count: 7 }, quarantine_count: 0, normalized_record_count: 176 };

function expectCode(code, callback) {
  assert.throws(callback, (error) => error.code === code);
}

function upload(center, period = "2026-04", marker = "a") {
  return center.execute({ command: "upload", actor: accounting, input: { targetPeriod: period, workbookHash: hash(marker), fileName: "fixture.xlsx" } });
}

function publish(center, versionId) {
  center.execute({ command: "dry-run", actor: accounting, input: { versionId, report } });
  center.execute({ command: "validate", actor: accounting, input: { versionId, valid: true } });
  center.execute({ command: "import", actor: accounting, input: { versionId } });
  center.execute({ command: "review", actor: accounting, input: { versionId, accepted: true } });
  return center.execute({ command: "publish", actor: accounting, input: { versionId } });
}

test("fixture-only command boundary implements all seven fixed commands", () => {
  const center = createFixtureImportCenter(); const first = upload(center); publish(center, first.version_id);
  const second = upload(center, "2026-04", "b"); const result = publish(center, second.version_id);
  assert.equal(result.status, VERSION_STATUS.published);
  const rollbackOne = center.execute({ command: "rollback", actor: accounting, input: { versionId: second.version_id, reasonCategory: "fixture_review" } });
  assert.equal(rollbackOne.status, "ROLLBACK_PENDING");
  const rollbackTwo = center.execute({ command: "rollback", actor: representative, input: { versionId: second.version_id, reasonCategory: "fixture_review" } });
  assert.equal(rollbackTwo.status, "ROLLBACK_COMPLETED");
  assert.equal(rollbackTwo.version.status, VERSION_STATUS.rolled_back);
  assert.deepEqual(center.counters(), { db_connection_count: 0, production_connection_count: 0, file_write_count: 0 });
});

test("invalid transitions and failed validation fail closed", () => {
  const center = createFixtureImportCenter(); const version = upload(center);
  expectCode("STATE_TRANSITION_REJECTED", () => center.execute({ command: "import", actor: accounting, input: { versionId: version.version_id } }));
  center.execute({ command: "dry-run", actor: accounting, input: { versionId: version.version_id, report } });
  const failed = center.execute({ command: "validate", actor: accounting, input: { versionId: version.version_id, valid: false, reasonCategory: "fixture_invalid" } });
  assert.equal(failed.status, VERSION_STATUS.validation_failed);
  expectCode("STATE_TRANSITION_REJECTED", () => center.execute({ command: "import", actor: accounting, input: { versionId: version.version_id } }));
});

test("same period reimport creates a new version and supersedes prior publication", () => {
  const center = createFixtureImportCenter(); const first = upload(center, "2026-04", "a"); publish(center, first.version_id);
  const second = upload(center, "2026-04", "b"); const result = publish(center, second.version_id);
  assert.equal(result.status, VERSION_STATUS.published);
  assert.equal(center.listVersions().find((version) => version.version_id === first.version_id).status, VERSION_STATUS.superseded);
  assert.equal(center.readPublished({ actor: accounting, targetPeriod: "2026-04" }).version.version_id, second.version_id);
});

test("published read excludes draft data and resolves scope server-side", () => {
  const center = createFixtureImportCenter(); const version = upload(center);
  assert.deepEqual(center.readPublished({ actor: accounting, targetPeriod: "2026-04" }), { status: "NOT_PUBLISHED", version: null, store_scope: [...Array(20)].map((_, index) => `fixture-store-${String(index + 1).padStart(2, "0")}`) });
  expectCode("FORBIDDEN", () => center.readPublished({ actor: employee, targetPeriod: "2026-04" }));
  expectCode("FORBIDDEN", () => center.readPublished({ actor: unassignedAm, targetPeriod: "2026-04" }));
  publish(center, version.version_id);
  assert.equal(center.readPublished({ actor: accounting, targetPeriod: "2026-04" }).status, "PUBLISHED");
  const director = { source: "server", employeeId: "fixture-director", roles: [FIXTURE_ROLE.salesDirector] };
  const assignedAm = { source: "server", employeeId: "fixture-assigned-am", roles: [FIXTURE_ROLE.am], assignmentVerified: true, storeIds: ["fixture-store-01", "fixture-store-14"] };
  const manager = { source: "server", employeeId: "fixture-manager", roles: [FIXTURE_ROLE.storeManager], storeIds: ["fixture-store-03"] };
  assert.equal(center.readPublished({ actor: director, targetPeriod: "2026-04" }).store_scope.length, 13);
  assert.deepEqual(center.readPublished({ actor: assignedAm, targetPeriod: "2026-04" }).store_scope, ["fixture-store-01", "fixture-store-14"]);
  assert.deepEqual(center.readPublished({ actor: manager, targetPeriod: "2026-04" }).store_scope, ["fixture-store-03"]);
});

test("permission guard rejects client authority and non-accounting commands", () => {
  const center = createFixtureImportCenter();
  expectCode("FORBIDDEN", () => center.execute({ command: "upload", actor: employee, input: { targetPeriod: "2026-04", workbookHash: hash("x"), fileName: "fixture.xlsx" } }));
  expectCode("COMMAND_INPUT_INVALID", () => center.execute({ command: "upload", actor: accounting, input: { targetPeriod: "2026-04", workbookHash: hash("x"), fileName: "fixture.xlsx", roles: ["accounting"] } }));
  expectCode("AUTHENTICATION_REQUIRED", () => center.execute({ command: "upload", actor: { employeeId: "spoof", roles: ["accounting"] }, input: { targetPeriod: "2026-04", workbookHash: hash("x"), fileName: "fixture.xlsx" } }));
});

test("rollback restores the last superseded version and audit remains append-only", () => {
  const center = createFixtureImportCenter(); const first = upload(center, "2026-04", "a"); publish(center, first.version_id);
  const second = upload(center, "2026-04", "b"); publish(center, second.version_id);
  const before = center.listAuditEvents();
  center.execute({ command: "rollback", actor: accounting, input: { versionId: second.version_id, reasonCategory: "fixture_error" } });
  const result = center.execute({ command: "rollback", actor: representative, input: { versionId: second.version_id, reasonCategory: "fixture_error" } });
  assert.equal(result.restored_version.version_id, first.version_id);
  assert.equal(center.readPublished({ actor: accounting, targetPeriod: "2026-04" }).version.version_id, first.version_id);
  assert.equal(center.listAuditEvents().length > before.length, true);
  assert.equal(center.listAuditEvents().slice(0, before.length).every((event, index) => event.event_id === before[index].event_id), true);
});

test("successful command audit events contain the required lifecycle fields", () => {
  const center = createFixtureImportCenter(); const version = upload(center);
  const event = center.listAuditEvents().at(-1);
  assert.deepEqual(Object.keys(event).filter((key) => ["command", "actor_id", "role", "target_period", "version_id", "previous_state", "next_state", "timestamp", "reason", "result"].includes(key)).sort(),
    ["actor_id", "command", "next_state", "previous_state", "reason", "result", "role", "target_period", "timestamp", "version_id"]);
  assert.equal(event.command, "upload"); assert.equal(event.result, "success");
  assert.equal(event.previous_state, null); assert.equal(event.next_state, VERSION_STATUS.uploaded);
  assert.equal(version.version_number, 1); assert.ok(version.created_at);
});

test("failed command audit is append-only and preserves state", () => {
  const center = createFixtureImportCenter(); const version = upload(center);
  expectCode("STATE_TRANSITION_REJECTED", () => center.execute({ command: "import", actor: accounting, input: { versionId: version.version_id } }));
  const event = center.listAuditEvents().at(-1);
  assert.equal(event.command, "import"); assert.equal(event.result, "failure");
  assert.equal(event.previous_state, VERSION_STATUS.uploaded); assert.equal(event.next_state, VERSION_STATUS.uploaded);
  assert.equal(center.listVersions()[0].status, VERSION_STATUS.uploaded);
});

test("numeric version order restores version 10 and excludes a different target period", () => {
  const center = createFixtureImportCenter();
  const versions = [];
  for (let index = 1; index <= 10; index += 1) {
    const item = upload(center, "2026-04", index.toString(16).slice(-1)); publish(center, item.version_id); versions.push(item);
  }
  const other = upload(center, "2026-05", "c"); publish(center, other.version_id);
  const current = versions.at(-1);
  center.execute({ command: "rollback", actor: accounting, input: { versionId: current.version_id, reasonCategory: "fixture_order" } });
  const result = center.execute({ command: "rollback", actor: representative, input: { versionId: current.version_id, reasonCategory: "fixture_order" } });
  assert.equal(result.restored_version.version_number, 9);
  assert.equal(center.readPublished({ actor: accounting, targetPeriod: "2026-05" }).version.version_id, other.version_id);
});

test("duplicate or missing version numbers reject rollback and record failure audit", () => {
  const duplicate = createFixtureImportCenter({ fixtureVersionMutator: (version) => { if (version.version_number === 2) version.version_number = 1; } });
  const first = upload(duplicate, "2026-04", "a"); publish(duplicate, first.version_id);
  const second = upload(duplicate, "2026-04", "b"); publish(duplicate, second.version_id);
  duplicate.execute({ command: "rollback", actor: accounting, input: { versionId: second.version_id, reasonCategory: "fixture_duplicate" } });
  expectCode("ROLLBACK_CANDIDATE_INVALID", () => duplicate.execute({ command: "rollback", actor: representative, input: { versionId: second.version_id, reasonCategory: "fixture_duplicate" } }));
  const duplicateFailure = duplicate.listAuditEvents().at(-1);
  assert.equal(duplicateFailure.result, "failure"); assert.equal(duplicateFailure.previous_state, VERSION_STATUS.published); assert.equal(duplicateFailure.next_state, VERSION_STATUS.published);

  const missing = createFixtureImportCenter({ fixtureVersionMutator: (version) => { if (version.version_number === 1) delete version.version_number; } });
  const missingFirst = upload(missing, "2026-04", "a"); publish(missing, missingFirst.version_id);
  const missingSecond = upload(missing, "2026-04", "b"); publish(missing, missingSecond.version_id);
  missing.execute({ command: "rollback", actor: accounting, input: { versionId: missingSecond.version_id, reasonCategory: "fixture_missing" } });
  expectCode("ROLLBACK_CANDIDATE_INVALID", () => missing.execute({ command: "rollback", actor: representative, input: { versionId: missingSecond.version_id, reasonCategory: "fixture_missing" } }));
});
