import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  advanceWorkQueue,
  attachSourceLineage,
  confirmRepairDecision,
  createWorkQueueState,
  getCurrentItem,
  getPendingItems,
  getWorkQueueMetrics,
  markSpreadsheetFixed,
  validateRepairDecision,
  validateSourceLineage,
  validateWorkQueuePayload
} from "../portal/talent/data-integrity-work-queue.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seed = JSON.parse(fs.readFileSync(path.join(root, "portal", "talent", "data-integrity-work-queue.seed.json"), "utf8"));
const lineage = JSON.parse(fs.readFileSync(path.join(root, "portal", "talent", "data-integrity-source-lineage.json"), "utf8"));
const report = JSON.parse(fs.readFileSync(path.join(root, "portal", "talent", "data-integrity-report.current.json"), "utf8"));
const html = fs.readFileSync(path.join(root, "portal", "talent", "data-integrity-work-queue.html"), "utf8");
const css = fs.readFileSync(path.join(root, "portal", "talent", "data-integrity-work-queue.css"), "utf8");
const source = fs.readFileSync(path.join(root, "portal", "talent", "data-integrity-work-queue.mjs"), "utf8");

const workflowSeed = {
  ...seed,
  metrics: { ...seed.metrics, fixedCount: 16, remainingCount: 1, workQueueIntegrityRate: 94.1 },
  categoryCounts: [{ type: "DUPLICATE_CANDIDATE", label: "重複候補", count: 1 }],
  items: [{
    id: "TEST-DUPLICATE",
    type: "DUPLICATE_CANDIDATE",
    cohort: "27卒",
    subject: "匿名テスト候補",
    currentValue: "候補A / 候補B",
    suggestion: "氏名・学校一致候補"
  }]
};

test("human review queue is completed with no remaining work item", () => {
  assert.equal(validateWorkQueuePayload(seed), seed);
  assert.equal(seed.items.length, 0);
  assert.equal(seed.metrics.fixedCount, 17);
  assert.equal(seed.metrics.remainingCount, 0);
  assert.equal(seed.metrics.workQueueIntegrityRate, 100);
  assert.equal(seed.releaseReady, true);
  assert.equal(seed.platformStatus, "DATA_INTEGRITY_COMPLETED / STAGING_SCHEMA_APPLY_PENDING / PRODUCTION_MIGRATION_HOLD");
  assert.equal(seed.migrationHoldReason, "STAGING_CANDIDATE_VERSIONED_DATASET_SCHEMA_APPLY_PENDING");
});

test("completed queue exposes no correction category", () => {
  assert.deepEqual(seed.categoryCounts, []);
});

test("current report closes human review and keeps migration separate", () => {
  assert.equal(report.status, "DATA_INTEGRITY_COMPLETED");
  assert.equal(report.platformStatus, "DATA_INTEGRITY_COMPLETED / STAGING_SCHEMA_APPLY_PENDING / PRODUCTION_MIGRATION_HOLD");
  assert.equal(report.releaseReady, true);
  assert.equal(report.metrics.remainingCount, 0);
  assert.equal(report.metrics.fixedCount, 17);
  assert.equal(report.metrics.missingCount, 0);
  assert.equal(report.metrics.duplicateGroupCount, 0);
  assert.equal(report.metrics.humanReviewedDuplicateGroupCount, 6);
  assert.equal(report.metrics.overallIntegrityRate, 100);
  assert.equal(report.metrics.migrationEligible, false);
  assert.equal(report.migration.status, "STAGING_SCHEMA_APPLY_PENDING");
  assert.equal(report.migration.productionStatus, "PRODUCTION_MIGRATION_HOLD");
  assert.deepEqual(report.migration.reasonCategories, [
    "STAGING_CANDIDATE_VERSIONED_DATASET_SCHEMA_SOURCE_READY"
  ]);
  assert.equal(report.migration.dryRun.status, "PASS_REVALIDATED");
  assert.equal(report.migration.dryRun.migrationTargetCount, 636);
  assert.equal(report.migration.dryRun.quarantineCount, 0);
  assert.equal(report.migration.dryRun.ownerApproval, true);
  assert.equal(report.migration.dryRun.migrationApproval, true);
  assert.equal(report.release.platformStatus, report.platformStatus);
  assert.equal(report.release.migrationHoldReason, "STAGING_CANDIDATE_VERSIONED_DATASET_SCHEMA_APPLY_PENDING");
  assert.equal(report.migration.stagingOperations.candidateCount, 636);
  assert.equal(report.migration.stagingOperations.directCandidateMutation, false);
  assert.equal(report.migration.stagingOperations.productionPromotionAllowed, false);
  assert.equal(report.sourceCorrections.activeDataRowCount, 108);
  assert.equal(report.sourceCorrections.currentQueueCount, 0);
});

test("work queue and data consistency rates stay separate", () => {
  const metrics = getWorkQueueMetrics(createWorkQueueState(seed));
  assert.deepEqual(Object.keys(metrics), ["workQueueIntegrityRate", "dataConsistencyIntegrityRate", "fixedCount", "remainingCount", "migrationStatus"]);
  assert.equal(metrics.workQueueIntegrityRate, "100%");
  assert.equal(metrics.dataConsistencyIntegrityRate, "100%");
  assert.equal(metrics.migrationStatus, "Staging Candidate schema適用待ち");
  assert.equal(seed.metrics.dataConsistencyIntegrityRate, 100);
  assert.deepEqual(seed.dataConsistencyIssues, []);
});

test("historical repair flow still requires confirmation, spreadsheet completion, then next", () => {
  const state = createWorkQueueState(workflowSeed);
  const current = getCurrentItem(state);
  const confirmed = confirmRepairDecision(state, current.id, { action: "HOLD" });
  assert.equal(confirmed.category, "REPAIR_CONFIRMED");
  assert.equal(confirmed.state.fixedCount, 16);
  const sheetFixed = markSpreadsheetFixed(confirmed.state, current.id);
  assert.equal(sheetFixed.category, "SPREADSHEET_FIXED");
  assert.equal(sheetFixed.state.fixedCount, 17);
  assert.equal(getPendingItems(sheetFixed.state).length, 0);
  const advanced = advanceWorkQueue(sheetFixed.state, current.id);
  assert.equal(advanced.category, "ADVANCED");
  assert.equal(getCurrentItem(advanced.state), null);
});

test("invalid repair does not advance the queue", () => {
  const state = createWorkQueueState(workflowSeed);
  const current = getCurrentItem(state);
  assert.equal(validateRepairDecision(current, { action: "" }), false);
  assert.equal(confirmRepairDecision(state, current.id, { action: "" }).category, "DECISION_INVALID");
});

test("duplicate decisions reject automatic merge", () => {
  const duplicate = createWorkQueueState(workflowSeed).items[0];
  assert.equal(validateRepairDecision(duplicate, { action: "SAME_PERSON" }), true);
  assert.equal(validateRepairDecision(duplicate, { action: "DIFFERENT_PERSON" }), true);
  assert.equal(validateRepairDecision(duplicate, { action: "HOLD" }), true);
  assert.equal(validateRepairDecision(duplicate, { action: "MERGE_AUTOMATIC" }), false);
});

test("spreadsheet completion cannot be skipped and no save action remains", () => {
  const state = createWorkQueueState(workflowSeed);
  const current = getCurrentItem(state);
  assert.equal(markSpreadsheetFixed(state, current.id).category, "REPAIR_NOT_CONFIRMED");
  assert.equal(advanceWorkQueue(state, current.id).category, "SPREADSHEET_NOT_FIXED");
  assert.doesNotMatch(source, /保存して次へ|保留して次へ/);
});

test("work queue has no browser or network persistence path", () => {
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|navigator\.sendBeacon/);
  assert.doesNotMatch(source, /method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i);
  assert.doesNotMatch(source, /supabase|rpc\s*\(|database/i);
});

test("queue stays standalone and excludes prohibited analysis screens", () => {
  assert.match(html, /data-integrity-work-queue/);
  assert.doesNotMatch(html, /analytics|ROI|CSV|Migration|school analysis|event analysis/i);
  assert.doesNotMatch(html, /app\.mjs/);
});

test("mobile queue uses one-column correction flow without horizontal tables", () => {
  assert.match(css, /@media \(max-width: 780px\)/);
  assert.match(css, /\.queue-categories, \.repair-workspace \{ grid-template-columns: 1fr; \}/);
  assert.doesNotMatch(css, /min-width:\s*[1-9][0-9]{3}px/);
});

test("seed contains no personal value or write capability", () => {
  assert.equal(seed.safety.containsPersonalValues, false);
  assert.equal(seed.safety.persistentWriteEnabled, false);
  assert.equal(seed.safety.databaseChanged, false);
  assert.equal(seed.safety.spreadsheetChanged, false);
  assert.equal(seed.safety.productionChanged, false);
  assert.equal(seed.safety.humanReviewQueueClosed, true);
});

test("source lineage closes all 17 issues and leaves no active item", () => {
  assert.equal(validateSourceLineage(lineage, seed), lineage);
  assert.equal(lineage.items.length, 0);
  assert.equal(lineage.resolvedIssueIds.length, 17);
  assert.equal(lineage.closedIssues.length, 12);
  assert.equal(lineage.closedIssues.filter((issue) => issue.final_status === "false_positive").length, 4);
  assert.equal(lineage.closedIssues.filter((issue) => issue.final_status === "resolved").length, 2);
  assert.equal(lineage.closedIssues.filter((issue) => issue.final_status === "human_review_completed").length, 6);
  assert.equal(lineage.closedIssues.every((issue) => issue.current_queue_included === false), true);
});

test("reviewed duplicate groups retain no row or personal detail", () => {
  const reviewed = lineage.closedIssues.filter((issue) => issue.final_status === "human_review_completed");
  assert.deepEqual(reviewed.map((issue) => issue.issue_id), ["DQ-DUP-001", "DQ-DUP-002", "DQ-DUP-003", "DQ-DUP-005", "DQ-DUP-006", "DQ-DUP-007"]);
  assert.equal(reviewed.every((issue) => !("source_row_no" in issue) && !("duplicate_pair_row" in issue)), true);
  assert.equal(report.humanReview.decisionValuesStored, true);
  assert.equal(report.humanReview.differentPersonCount, 6);
  assert.equal(report.humanReview.pendingReviewCount, 0);
  assert.equal(report.humanReview.quarantineCount, 0);
  assert.equal(report.humanReview.migrationEffect, "keep_separate");
  assert.equal(report.humanReview.personalValuesStored, false);
});

test("28 graduate official source is primary and legacy copy is absent", () => {
  const source28 = lineage.sourceSpreadsheets.find((item) => item.graduation_year === "28卒");
  assert.equal(source28.spreadsheet_id, "1OwFCnRYfTOWGkUGhykURibUD5Ss06msHoaZwYdopkEA");
  assert.equal(source28.sheet_id, 1279221745);
  assert.equal(source28.lineage_role, "PRIMARY");
  assert.doesNotMatch(JSON.stringify(lineage), /1e7MhMDNVE0cMPBGU3sFU1WeLq7Q-ZVW4oSFy_IuxtTE/);
});

test("completed UI renders no repair action", () => {
  const state = createWorkQueueState(attachSourceLineage(seed, lineage));
  assert.equal(getCurrentItem(state), null);
  assert.equal(getPendingItems(state).length, 0);
  assert.match(source, /本日の修正対象は完了しました/);
});

test("final report preserves read-only zero-write boundaries", () => {
  assert.equal(report.safety.containsPersonalValues, false);
  assert.equal(report.safety.spreadsheetWriteCount, 0);
  assert.equal(report.safety.databaseWriteCount, 0);
  assert.equal(report.safety.productionWriteCount, 0);
  assert.equal(report.safety.privateReadOnlyDryRunCount, 1);
  assert.equal(report.safety.normalizedPersonalValuePersistenceCount, 0);
  assert.equal(report.safety.serviceRoleUseCount, 0);
  assert.equal(report.safety.stagingWriteCount, 0);
  assert.equal(report.release.productionDeployExecuted, false);
});
