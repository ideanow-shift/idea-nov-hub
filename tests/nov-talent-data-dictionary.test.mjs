import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dictionaryPath = new URL("../docs/nov_talent/data_dictionary/nov-talent-data-dictionary.json", import.meta.url);
const guidePath = new URL("../docs/nov_talent/data_dictionary/nov-talent-data-dictionary.md", import.meta.url);
const migrationSpecPath = new URL("../docs/nov_talent/data_dictionary/migration-spec.md", import.meta.url);
const readmePath = new URL("../docs/nov_talent/data_dictionary/README.md", import.meta.url);
const dictionary = JSON.parse(readFileSync(dictionaryPath, "utf8"));
const guide = readFileSync(guidePath, "utf8");
const migrationSpec = readFileSync(migrationSpecPath, "utf8");
const readme = readFileSync(readmePath, "utf8");

const uniqueCodes = (values) => new Set(values.map((value) => value.code)).size === values.length;

test("NOV Talent Data Dictionary is the canonical versioned specification", () => {
  assert.equal(dictionary.dictionaryId, "NOV_TALENT_DATA_DICTIONARY");
  assert.equal(dictionary.dictionaryVersion, "1.1.0");
  assert.equal(dictionary.status, "CANONICAL");
  assert.equal(dictionary.governance.unknownCodePolicy, "REJECT");
  assert.equal(dictionary.governance.undefinedDefinitionPolicy, "FAIL_CLOSED");
  assert.match(guide, /AI、CSV、UI、DB、Platform/);
});

test("candidate statuses and event codes are unique and preserve current contracts", () => {
  assert.equal(uniqueCodes(dictionary.candidateStatuses), true);
  assert.deepEqual(dictionary.candidateStatuses.map(({ code }) => code), [
    "CONTACT", "LINE_REGISTERED", "SALON_TOUR", "INTERVIEW",
    "PASSED", "OFFER", "EXPECTED_JOIN", "WITHDRAWN"
  ]);
  assert.equal(uniqueCodes(dictionary.events), true);
  assert.deepEqual(dictionary.events.map(({ code }) => code), [
    "CONTACT_RECORDED", "LINE_REGISTERED", "SALON_TOUR_COMPLETED",
    "INTERVIEW_COMPLETED", "SELECTION_PASSED", "OFFER_ISSUED",
    "EXPECTED_JOIN_CONFIRMED"
  ]);
});

test("invalidation and duplicate decisions fail closed to the approved values", () => {
  assert.deepEqual(dictionary.eventInvalidationReasons.map(({ code }) => code), [
    "CANCELLED", "NO_SHOW", "DELETED", "WITHDRAWN"
  ]);
  assert.deepEqual(dictionary.duplicateJudgments.map(({ code }) => code), [
    "SAME_PERSON", "DIFFERENT_PERSON", "HOLD"
  ]);
  assert.equal(dictionary.duplicateRules.automaticMerge, false);
  assert.equal(dictionary.duplicateRules.automaticDelete, false);
  assert.equal(dictionary.rejectionReasons.definitionStatus, "NOT_DEFINED");
  assert.deepEqual(dictionary.rejectionReasons.codes, []);
});

test("migration, platform, release and count definitions remain consistent", () => {
  assert.equal(dictionary.currentPlatformStatus, "DATA_INTEGRITY_COMPLETED / DATA_CONSISTENCY_REVIEW / MIGRATION_HOLD");
  assert.equal(dictionary.migration.currentStatus, "MIGRATION_HOLD");
  assert.equal(dictionary.migration.reasonCode, "MIGRATION_CONTRACT_INCOMPLETE");
  assert.equal(dictionary.migration.dataIntegrityCompleted, true);
  assert.equal(dictionary.migration.activeRowDefinition.status, "DEFINED");
  assert.deepEqual(dictionary.migration.activeRowDefinition.anyOfFields, [
    "氏名", "学校", "電話番号", "メール", "LINE", "イベント", "ステータス"
  ]);
  assert.equal(dictionary.migration.activeRowDefinition.minimumPopulatedFieldCount, 1);
  assert.equal(dictionary.migration.resolvedCriteria[0].code, "ACTIVE_ROW_COUNT_BASIS_APPROVAL");
  assert.deepEqual(dictionary.migration.holdReleaseCriteria.map(({ priority }) => priority), [1, 2, 3, 4]);
  assert.equal(dictionary.migration.holdReleaseCriteria.every(({ status }) => status === "OPEN"), true);
  assert.match(migrationSpec, /No\.だけ採番された空テンプレート行はMigration対象外/);
  assert.match(readme, /残る4条件/);
  assert.equal(dictionary.countDefinitions.dataIntegrity.currentValues.remainingCount, 0);
  assert.equal(dictionary.countDefinitions.dataIntegrity.currentValues.resolutionRate, 100);
  assert.equal(dictionary.currentRelease.status, "RELEASE_READY");
  assert.equal(dictionary.currentRelease.productionDeployExecutedByThisDictionarySprint, false);
});

test("roles and permissions match the existing NOV HUB permission mapping", () => {
  assert.deepEqual(dictionary.roles.map(({ code }) => code), [
    "super_admin", "backoffice", "hr.admin", "hr.staff", "executive"
  ]);
  assert.equal(dictionary.permissions.full.canManageSettings, true);
  assert.equal(dictionary.permissions.recruiter.canManageSettings, false);
  assert.equal(dictionary.permissions.executive.canViewCandidateContact, false);
  assert.equal(dictionary.permissions.denied.canViewDashboard, false);
});

test("official sources, 28 CSV contract and safety boundaries are fixed", () => {
  const source28 = dictionary.sources.find(({ code }) => code === "OFFICIAL_SOURCE_28_CONTACTS");
  assert.equal(source28.spreadsheetId, "1OwFCnRYfTOWGkUGhykURibUD5Ss06msHoaZwYdopkEA");
  assert.equal(source28.sheetId, 1279221745);
  assert.equal(source28.name, "求人計画28卒_2026年9月～2027年8月");
  assert.deepEqual(dictionary.imports.sourceTypes, ["CONTACTS_28", "ENTRIES_28", "OFFERS_28"]);
  assert.deepEqual(dictionary.imports.minimumIdentityFields, ["student_name", "school_name"]);
  assert.equal(dictionary.imports.networkOperation, false);
  assert.equal(dictionary.imports.databaseOperation, false);
  assert.equal(dictionary.imports.retryCount, 0);
});

test("dictionary artifacts contain no personal-value fields or secrets", () => {
  const serialized = JSON.stringify(dictionary);
  assert.doesNotMatch(serialized, /"[^"\s]+@[^"\s]+"/u);
  assert.doesNotMatch(
    serialized,
    /service_role|authorization:\s*bearer|postgres(?:ql)?:\/\/|(?:password|secret)["']?\s*[:=]\s*["'][^"']+/iu,
  );
  assert.equal(dictionary.governance.personalDataPolicy.includes("個人値"), true);
});
