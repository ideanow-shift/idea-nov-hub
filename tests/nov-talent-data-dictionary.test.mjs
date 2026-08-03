import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

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
const dryRunSnapshotPath = new URL("../docs/nov_talent/data_dictionary/migration-dry-run-snapshot.candidate.json", import.meta.url);
const dryRunReportPath = new URL("../docs/nov_talent/data_dictionary/migration-dry-run-report.md", import.meta.url);
const stagingOperationsContractPath = new URL("../docs/nov_talent/data_dictionary/staging-operations-contract.json", import.meta.url);
const stagingOperationsGuidePath = new URL("../docs/nov_talent/data_dictionary/staging-operations-contract.md", import.meta.url);
const stagingSnapshotPath = new URL("../docs/nov_talent/data_dictionary/staging-migration-snapshot.candidate.json", import.meta.url);
const stagingExecutionResultPath = new URL("../docs/nov_talent/data_dictionary/staging-migration-execution-result.json", import.meta.url);
const stagingSchemaContractPath = new URL("../docs/nov_talent/data_dictionary/staging-candidate-versioned-dataset-schema.json", import.meta.url);
const dictionaryRaw = readFileSync(dictionaryPath, "utf8");
const dictionary = JSON.parse(dictionaryRaw);
const guide = readFileSync(guidePath, "utf8");
const migrationSpec = readFileSync(migrationSpecPath, "utf8");
const readme = readFileSync(readmePath, "utf8");
const identityContract = JSON.parse(readFileSync(identityContractPath, "utf8"));
const reviewEvidence = JSON.parse(readFileSync(reviewEvidencePath, "utf8"));
const targetMapping = JSON.parse(readFileSync(targetMappingPath, "utf8"));
const snapshotContract = readFileSync(snapshotContractPath, "utf8");
const acceptanceChecklist = readFileSync(acceptanceChecklistPath, "utf8");
const rollbackContract = readFileSync(rollbackContractPath, "utf8");
const dryRunSnapshot = JSON.parse(readFileSync(dryRunSnapshotPath, "utf8"));
const dryRunReport = readFileSync(dryRunReportPath, "utf8");
const stagingOperationsContract = JSON.parse(readFileSync(stagingOperationsContractPath, "utf8"));
const stagingOperationsGuide = readFileSync(stagingOperationsGuidePath, "utf8");
const stagingSnapshot = JSON.parse(readFileSync(stagingSnapshotPath, "utf8"));
const stagingExecutionResult = JSON.parse(readFileSync(stagingExecutionResultPath, "utf8"));
const stagingSchemaContract = JSON.parse(readFileSync(stagingSchemaContractPath, "utf8"));

const uniqueCodes = (values) => new Set(values.map((value) => value.code)).size === values.length;

test("NOV Talent Data Dictionary is the canonical versioned specification", () => {
  assert.equal(dictionary.dictionaryId, "NOV_TALENT_DATA_DICTIONARY");
  assert.equal(dictionary.dictionaryVersion, "1.3.0");
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
  assert.equal(dictionary.currentPlatformStatus, "DATA_INTEGRITY_COMPLETED / STAGING_DATASET_ACTIVE / PRODUCTION_MIGRATION_HOLD");
  assert.equal(dictionary.migration.currentStatus, "STAGING_DATASET_ACTIVE");
  assert.equal(dictionary.migration.productionStatus, "PRODUCTION_MIGRATION_HOLD");
  assert.equal(dictionary.migration.reasonCode, "STAGING_CANDIDATE_DATASET_ACTIVE_UI_RUNTIME_PENDING");
  assert.equal(dictionary.migration.dataIntegrityCompleted, true);
  assert.equal(dictionary.migration.activeRowDefinition.status, "DEFINED");
  assert.deepEqual(dictionary.migration.activeRowDefinition.anyOfFields, [
    "氏名", "学校", "電話番号", "メール", "LINE", "イベント", "ステータス"
  ]);
  assert.equal(dictionary.migration.activeRowDefinition.minimumPopulatedFieldCount, 1);
  assert.equal(dictionary.migration.resolvedCriteria[0].code, "ACTIVE_ROW_COUNT_BASIS_APPROVAL");
  assert.equal(dictionary.migration.contractFinalization.every(({ status }) => status === "DEFINED"), true);
  assert.deepEqual(dictionary.migration.holdReleaseCriteria.map(({ priority }) => priority), [1, 2, 3]);
  assert.deepEqual(dictionary.migration.holdReleaseCriteria.map(({ status }) => status), ["RESOLVED", "RESOLVED", "REMOTE_APPLIED_ACTIVE_DATASET"]);
  assert.equal(dictionary.migration.holdReleaseCriteria[0].artifact, "migration-dry-run-snapshot.candidate.json");
  assert.match(migrationSpec, /No\.だけ採番された空テンプレート行はMigration対象外/);
  assert.match(readme, /Migration契約4件: 仕様確定/);
  assert.match(readme, /Remote Staging適用待ち/);
  assert.equal(dictionary.countDefinitions.dataIntegrity.currentValues.remainingCount, 0);
  assert.equal(dictionary.countDefinitions.dataIntegrity.currentValues.resolutionRate, 100);
  assert.equal(dictionary.currentRelease.status, "RELEASE_READY");
  assert.equal(dictionary.currentRelease.productionDeployExecutedByThisDictionarySprint, false);
});

test("private read-only dry-run snapshot seals official-source counts and safety boundaries", () => {
  assert.equal(dryRunSnapshot.payload.validationResult, "PASS");
  assert.equal(dryRunSnapshot.payload.dataDictionaryVersion, "1.2.0");
  assert.deepEqual(dryRunSnapshot.payload.sources.map(({ migrationTargetCount }) => migrationTargetCount), [528, 108]);
  assert.deepEqual(dryRunSnapshot.payload.sources.map(({ excludedTemplateCount }) => excludedTemplateCount), [13, 418]);
  assert.equal(dryRunSnapshot.payload.counts.migrationTargetCount, 636);
  assert.equal(dryRunSnapshot.payload.counts.candidateCandidateCount, 636);
  assert.equal(dryRunSnapshot.payload.counts.newCandidateCount, 636);
  assert.equal(dryRunSnapshot.payload.counts.aggregatedRowCount, 0);
  assert.equal(dryRunSnapshot.payload.counts.eventCount, 1550);
  assert.equal(dryRunSnapshot.payload.counts.selectionHistoryCount, 0);
  assert.equal(dryRunSnapshot.payload.counts.quarantineCount, 0);
  assert.equal(dryRunSnapshot.payload.counts.noMatchCount, 636);
  assert.equal(dryRunSnapshot.payload.humanReview.keepSeparateCount, 6);
  assert.equal(dryRunSnapshot.payload.humanReview.pendingReviewCount, 0);
  assert.equal(dryRunSnapshot.payload.approvals.ownerApproval, false);
  assert.equal(dryRunSnapshot.payload.approvals.migrationApproval, false);
  assert.equal(dryRunSnapshot.payload.safety.spreadsheetWriteCount, 0);
  assert.equal(dryRunSnapshot.payload.safety.databaseWriteCount, 0);
  assert.equal(dryRunSnapshot.payload.safety.stagingWriteCount, 0);
  assert.equal(dryRunSnapshot.payload.safety.productionWriteCount, 0);
  assert.equal(dryRunSnapshot.payload.safety.personalValuesPersistedCount, 0);
  const publishedReceipt = JSON.stringify(dryRunSnapshot) + dryRunReport;
  assert.doesNotMatch(publishedReceipt, /student_name|studentName|student_name_kana|phone|"email"|line_identifier|source_row_reference/iu);
  assert.doesNotMatch(publishedReceipt, /"[^"\s]+@[^"\s]+"/u);
  const hash = createHash("sha256").update(JSON.stringify(dryRunSnapshot.payload)).digest("hex");
  assert.equal(hash, dryRunSnapshot.artifactHash);
  assert.match(dryRunReport, /PASS_PRIVATE_READ_ONLY_DRY_RUN/);
});

test("staging operations contract fixes 636 candidates and keeps production prohibited", () => {
  assert.equal(stagingOperationsContract.status, "DATASET_ACTIVE_UI_RUNTIME_PENDING");
  assert.equal(stagingOperationsContract.environmentPolicy.staging, "OPERATION_VALIDATION_ENVIRONMENT");
  assert.equal(stagingOperationsContract.environmentPolicy.production, "PROHIBITED_UNTIL_SEPARATE_PROMOTION_APPROVAL");
  assert.equal(stagingOperationsContract.initialScope.candidateCount, 636);
  assert.equal(stagingOperationsContract.versionCompatibility.operationsDictionaryVersion, "1.3.0");
  assert.equal(stagingOperationsContract.versionCompatibility.sealedDryRunDataContractVersion, "1.2.0");
  assert.equal(stagingOperationsContract.versionCompatibility.candidateMappingSemanticsChanged, false);
  assert.equal(stagingOperationsContract.versionCompatibility.freshSnapshotRequiredBeforeImport, true);
  assert.deepEqual(stagingOperationsContract.initialScope.sourceBreakdown.map(({ candidateCount }) => candidateCount), [528, 108]);
  assert.deepEqual(stagingOperationsContract.initialScope.migrationEntityScope, ["CANDIDATE"]);
  assert.equal(stagingOperationsContract.operatorCapabilities.candidateManagement, true);
  assert.equal(stagingOperationsContract.operatorCapabilities.candidateSearch, true);
  assert.equal(stagingOperationsContract.operatorCapabilities.dashboard, true);
  assert.equal(stagingOperationsContract.operatorCapabilities.directCandidateMutationFromNovTalent, false);
  assert.deepEqual(stagingOperationsContract.systemOfRecord.updateFlow, [
    "SPREADSHEET_UPDATE", "READ_ONLY_PREFLIGHT", "OWNER_APPROVED_IMPORT", "STAGING_DATASET_ACTIVATION"
  ]);
  assert.equal(stagingOperationsContract.importPolicy.mode, "VERSIONED_SNAPSHOT_REPLACEMENT");
  assert.equal(stagingOperationsContract.importPolicy.retryCount, 0);
  assert.equal(stagingOperationsContract.importPolicy.sourceChangeRequiresFreshSnapshot, true);
  assert.equal(stagingOperationsContract.safety.productionWrite, false);
  assert.equal(stagingOperationsContract.safety.canonicalPromotion, false);
  assert.equal(stagingOperationsContract.safety.spreadsheetWriteFromNovTalent, false);
  assert.equal(stagingOperationsContract.sourceSnapshot.mustBeRevalidatedImmediatelyBeforeImport, false);
  assert.equal(stagingOperationsContract.sourceSnapshot.revalidationStatus, "PASS_COUNTS_AND_SOURCE_HASH");
  assert.match(stagingOperationsGuide, /正式Spreadsheetを更新[\s\S]*read-only preflight/);
  assert.match(stagingOperationsGuide, /Production昇格承認はこれらに含まれない/);
});

test("Candidate Versioned Dataset schema contract records the active remote dataset", () => {
  assert.equal(stagingSchemaContract.status, "REMOTE_APPLIED_ACTIVE_DATASET");
  assert.deepEqual(stagingSchemaContract.scope.includedEntities, ["CANDIDATE"]);
  assert.equal(stagingSchemaContract.scope.approvedCandidateCount, 636);
  assert.deepEqual(stagingSchemaContract.lifecycle, ["BUILDING", "READY", "ACTIVE", "RETIRED"]);
  assert.equal(stagingSchemaContract.invariants.maximumActiveDatasetCount, 1);
  assert.equal(stagingSchemaContract.invariants.previousDatasetRestorable, true);
  assert.equal(stagingSchemaContract.access.anonAccess, "NONE");
  assert.equal(stagingSchemaContract.access.authenticatedAccess, "NONE");
  assert.equal(stagingSchemaContract.application.remoteSchemaApplied, true);
  assert.equal(stagingSchemaContract.application.stagingMigrationExecuted, true);
});

test("fresh staging snapshot is sealed and active with Candidate-only counts", () => {
  assert.equal(stagingSnapshot.snapshotId, "NOV-TALENT-STAGING-E30AE047735FC922");
  assert.equal(stagingSnapshot.payload.counts.candidateCount, 636);
  assert.deepEqual(stagingSnapshot.payload.sources.map(({ migrationTargetCount }) => migrationTargetCount), [528, 108]);
  assert.equal(stagingSnapshot.payload.humanReview.keepSeparateCount, 6);
  assert.equal(createHash("sha256").update(JSON.stringify(stagingSnapshot.payload)).digest("hex"), stagingSnapshot.artifactHash);
  assert.equal(stagingExecutionResult.result, "PASS_STAGING_CANDIDATE_DATASET_ACTIVE");
  assert.equal(stagingExecutionResult.operationReadiness.fixedCategory, "STAGING_UI_RUNTIME_NOT_CONNECTED");
  assert.equal(stagingExecutionResult.executionAccounting.stagingCandidateWriteCount, 636);
  assert.equal(stagingExecutionResult.executionAccounting.productionWriteCount, 0);
  assert.equal(stagingExecutionResult.executionAccounting.rawPersonalValuesIncluded, false);
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

test("human review evidence keeps owner-confirmed duplicate groups separate by stable ID", () => {
  assert.equal(reviewEvidence.evidence.length, 17);
  assert.equal(new Set(reviewEvidence.evidence.map(({ issue_id }) => issue_id)).size, 17);
  assert.equal(reviewEvidence.summary.completeCount, 17);
  assert.equal(reviewEvidence.summary.decisionRecordedCount, 17);
  assert.equal(reviewEvidence.summary.pendingReviewCount, 0);
  assert.equal(reviewEvidence.summary.reconfirmationRequiredCount, 0);
  assert.equal(reviewEvidence.summary.ownerConfirmedCount, 6);
  assert.equal(reviewEvidence.summary.differentPersonCount, 6);
  assert.equal(reviewEvidence.summary.recoveryNotPossibleCount, 0);
  assert.equal(reviewEvidence.summary.outcomeNotRecordedCount, 0);
  assert.equal(reviewEvidence.summary.migrationMergeAuthorizedCount, 0);
  assert.equal(reviewEvidence.summary.migrationKeepSeparateCount, 6);
  assert.equal(reviewEvidence.summary.migrationQuarantineCount, 0);
  const confirmed = reviewEvidence.evidence.filter(({ evidence_status }) => evidence_status === "COMPLETE_OWNER_CONFIRMED");
  assert.equal(confirmed.length, 6);
  assert.equal(confirmed.every(({ decision }) => decision === "different_person"), true);
  assert.equal(confirmed.every(({ migration_effect }) => migration_effect === "keep_separate"), true);
  assert.equal(confirmed.every(({ source_row_reference, stable_key_hint }) => source_row_reference === stable_key_hint.replace("27-CONTACT-", "OFFICIAL_27:")), true);
  assert.equal(confirmed.every(({ evidence_source }) => evidence_source === "OWNER_CONFIRMED_DIFFERENT_PERSON_2026-08-03"), true);
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

test("snapshot acceptance and rollback contracts fail closed before staging migration", () => {
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
  assert.match(acceptanceChecklist, /Staging限定Migration別承認/);
  assert.match(acceptanceChecklist, /Production書込み・自動昇格/);
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
  const contractArtifacts = JSON.stringify({
    identityContract,
    reviewEvidence,
    targetMapping,
  });
  const stagingSchemaSerialized = JSON.stringify(stagingSchemaContract);
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
  assert.doesNotMatch(
    stagingSchemaSerialized,
    /authorization:\s*bearer|postgres(?:ql)?:\/\/|(?:password|secret)["']?\s*[:=]\s*["'][^"']+/iu,
  );
  assert.equal(dictionary.governance.personalDataPolicy.includes("個人値"), true);
});
