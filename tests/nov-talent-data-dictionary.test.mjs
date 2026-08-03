import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dictionaryPath = new URL("../docs/nov_talent/data_dictionary/nov-talent-data-dictionary.json", import.meta.url);
const guidePath = new URL("../docs/nov_talent/data_dictionary/nov-talent-data-dictionary.md", import.meta.url);
const migrationSpecPath = new URL("../docs/nov_talent/data_dictionary/migration-spec.md", import.meta.url);
const readmePath = new URL("../docs/nov_talent/data_dictionary/README.md", import.meta.url);
const identityContractPath = new URL("../docs/nov_talent/data_dictionary/candidate-identity-contract.json", import.meta.url);
const reviewEvidencePath = new URL("../docs/nov_talent/data_dictionary/human-review-evidence.json", import.meta.url);
const targetMappingPath = new URL("../docs/nov_talent/data_dictionary/migration-target-mapping.json", import.meta.url);
const snapshotContractPath = new URL("../docs/nov_talent/data_dictionary/migration-snapshot-contract.md", import.meta.url);
const acceptanceChecklistPath = new URL("../docs/nov_talent/data_dictionary/migration-acceptance-checklist.md", import.meta.url);
const rollbackContractPath = new URL("../docs/nov_talent/data_dictionary/rollback-contract.md", import.meta.url);
const dictionary = JSON.parse(readFileSync(dictionaryPath, "utf8"));
const guide = readFileSync(guidePath, "utf8");
const migrationSpec = readFileSync(migrationSpecPath, "utf8");
const readme = readFileSync(readmePath, "utf8");
const identityContract = JSON.parse(readFileSync(identityContractPath, "utf8"));
const reviewEvidence = JSON.parse(readFileSync(reviewEvidencePath, "utf8"));
const targetMapping = JSON.parse(readFileSync(targetMappingPath, "utf8"));
const snapshotContract = readFileSync(snapshotContractPath, "utf8");
const acceptanceChecklist = readFileSync(acceptanceChecklistPath, "utf8");
const rollbackContract = readFileSync(rollbackContractPath, "utf8");

const uniqueCodes = (values) => new Set(values.map((value) => value.code)).size === values.length;

test("NOV Talent Data Dictionary is the canonical versioned specification", () => {
  assert.equal(dictionary.dictionaryId, "NOV_TALENT_DATA_DICTIONARY");
  assert.equal(dictionary.dictionaryVersion, "1.2.0");
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
  assert.equal(dictionary.migration.reasonCode, "MIGRATION_PRECONDITIONS_PENDING");
  assert.equal(dictionary.migration.dataIntegrityCompleted, true);
  assert.equal(dictionary.migration.activeRowDefinition.status, "DEFINED");
  assert.deepEqual(dictionary.migration.activeRowDefinition.anyOfFields, [
    "氏名", "学校", "電話番号", "メール", "LINE", "イベント", "ステータス"
  ]);
  assert.equal(dictionary.migration.activeRowDefinition.minimumPopulatedFieldCount, 1);
  assert.equal(dictionary.migration.resolvedCriteria[0].code, "ACTIVE_ROW_COUNT_BASIS_APPROVAL");
  assert.equal(dictionary.migration.contractFinalization.every(({ status }) => status === "DEFINED"), true);
  assert.deepEqual(dictionary.migration.holdReleaseCriteria.map(({ priority }) => priority), [1, 2]);
  assert.equal(dictionary.migration.holdReleaseCriteria.every(({ status }) => status === "OPEN"), true);
  assert.match(migrationSpec, /No\.だけ採番された空テンプレート行はMigration対象外/);
  assert.match(readme, /Migration契約4件: 仕様確定/);
  assert.match(readme, /Migration実行前条件が未完了/);
  assert.equal(dictionary.countDefinitions.dataIntegrity.currentValues.remainingCount, 0);
  assert.equal(dictionary.countDefinitions.dataIntegrity.currentValues.resolutionRate, 100);
  assert.equal(dictionary.currentRelease.status, "RELEASE_READY");
  assert.equal(dictionary.currentRelease.productionDeployExecutedByThisDictionarySprint, false);
});

test("candidate identity contract links automatically only on one conflict-free strong key", () => {
  assert.deepEqual(identityContract.priorityRules.map(({ priority }) => priority), [1, 2, 3, 4, 5, 6]);
  assert.equal(identityContract.priorityRules.slice(0, 4).every(({ autoLinkEligible }) => autoLinkEligible), true);
  assert.equal(identityContract.priorityRules.slice(4).every(({ autoLinkEligible }) => !autoLinkEligible), true);
  assert.deepEqual(identityContract.outcomes.map(({ code }) => code), [
    "exact_match", "probable_match", "ambiguous", "no_match", "conflict"
  ]);
  assert.equal(identityContract.failClosedRules.nameOnlyAutoLink, false);
  assert.equal(identityContract.failClosedRules.automaticMerge, false);
  assert.equal(identityContract.failClosedRules.automaticDelete, false);
});

test("human review evidence fail-closes unrecoverable duplicate outcomes to quarantine", () => {
  assert.equal(reviewEvidence.evidence.length, 17);
  assert.equal(new Set(reviewEvidence.evidence.map(({ issue_id }) => issue_id)).size, 17);
  assert.equal(reviewEvidence.summary.completeCount, 11);
  assert.equal(reviewEvidence.summary.decisionRecordedCount, 17);
  assert.equal(reviewEvidence.summary.pendingReviewCount, 6);
  assert.equal(reviewEvidence.summary.recoveryNotPossibleCount, 6);
  assert.equal(reviewEvidence.summary.outcomeNotRecordedCount, 0);
  assert.equal(reviewEvidence.summary.migrationMergeAuthorizedCount, 0);
  assert.equal(reviewEvidence.summary.migrationQuarantineCount, 6);
  const pending = reviewEvidence.evidence.filter(({ decision }) => decision === "pending_review");
  assert.equal(pending.length, 6);
  assert.equal(pending.every(({ migration_effect }) => migration_effect === "quarantine"), true);
  assert.equal(pending.every(({ evidence_source }) => evidence_source === "OFFICIAL_SOURCE_READ_ONLY_CURRENT_AND_REVISION_EVIDENCE_NOT_CONCLUSIVE"), true);
  assert.equal(reviewEvidence.evidence.every(({ current_queue_included }) => !current_queue_included), true);
  assert.equal(reviewEvidence.evidence.every(({ decided_by_role }) => decided_by_role === "backoffice"), true);
});

test("migration target mapping permits one source row to route to candidate and histories safely", () => {
  assert.equal(targetMapping.oneSourceRowMayProduceMultipleRecords, true);
  assert.deepEqual(targetMapping.targets.map(({ code }) => code), [
    "CANDIDATE", "EVENT_CONTACT", "SELECTION_HISTORY", "QUARANTINE"
  ]);
  assert.equal(targetMapping.routing.probable_match, "QUARANTINE");
  assert.equal(targetMapping.routing.ambiguous, "QUARANTINE");
  assert.equal(targetMapping.routing.conflict, "QUARANTINE");
  assert.equal(targetMapping.prohibitions.automaticMerge, false);
  assert.equal(targetMapping.prohibitions.automaticDelete, false);
});

test("snapshot acceptance and rollback contracts fail closed before production migration", () => {
  for (const field of [
    "snapshot_id", "generated_at", "source_spreadsheet_id", "sheet_id", "source_type",
    "source_row_count", "migration_target_count", "excluded_template_count", "quarantine_count",
    "exact_match_count", "ambiguous_count", "artifact_hash", "schema_version",
    "data_dictionary_version", "owner_approval", "migration_approval"
  ]) {
    assert.equal(snapshotContract.includes("`" + field + "`"), true);
  }
  assert.match(acceptanceChecklist, /旧コピー参照0件/);
  assert.match(acceptanceChecklist, /read-only dry-run PASS/);
  assert.match(acceptanceChecklist, /本番書込み前のMigration別承認/);
  assert.match(rollbackContract, /単一transaction全体をrollback/);
  assert.match(rollbackContract, /自動retryは行わない/);
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
  const contractArtifacts = JSON.stringify({ identityContract, reviewEvidence, targetMapping });
  assert.doesNotMatch(serialized, /"[^"\s]+@[^"\s]+"/u);
  assert.doesNotMatch(contractArtifacts, /"[^"\s]+@[^"\s]+"/u);
  assert.doesNotMatch(
    serialized,
    /service_role|authorization:\s*bearer|postgres(?:ql)?:\/\/|(?:password|secret)["']?\s*[:=]\s*["'][^"']+/iu,
  );
  assert.doesNotMatch(
    contractArtifacts,
    /service_role|authorization:\s*bearer|postgres(?:ql)?:\/\/|(?:password|secret)["']?\s*[:=]\s*["'][^"']+/iu,
  );
  assert.equal(dictionary.governance.personalDataPolicy.includes("個人値"), true);
});
