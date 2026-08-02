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

test("work queue contains only the six unresolved 27 graduate duplicate groups", () => {
  assert.equal(validateWorkQueuePayload(seed), seed);
  assert.equal(seed.items.length, 6);
  assert.equal(seed.metrics.fixedCount, 11);
  assert.equal(seed.metrics.remainingCount, 6);
  assert.deepEqual(new Set(seed.items.map((item) => item.type)), new Set(["DUPLICATE_CANDIDATE"]));
  assert.deepEqual(new Set(seed.items.map((item) => item.cohort)), new Set(["27卒"]));
});

test("queue categories match the re-audited remaining counts", () => {
  assert.deepEqual(seed.categoryCounts.map(({ type, count }) => ({ type, count })), [
    { type: "DUPLICATE_CANDIDATE", count: 6 }
  ]);
});

test("current report reflects the official 28 graduate source and six-item queue", () => {
  assert.equal(report.metrics.remainingCount, 6);
  assert.equal(report.metrics.fixedCount, 11);
  assert.equal(report.metrics.missingCount, 0);
  assert.equal(report.metrics.duplicateGroupCount, 6);
  assert.equal(report.sourceCorrections.activeDataRowCount, 108);
  assert.equal(report.sourceCorrections.currentQueueCount, 0);
  assert.equal(report.sourceCorrections.falsePositiveClosedCount, 4);
  assert.equal(report.sourceCorrections.resolvedClosedCount, 2);
  assert.equal(report.sourceCorrections.legacyCopyCanonical, false);
});

test("work queue and data consistency rates stay separate", () => {
  const metrics = getWorkQueueMetrics(createWorkQueueState(seed));
  assert.deepEqual(Object.keys(metrics), ["workQueueIntegrityRate", "dataConsistencyIntegrityRate", "fixedCount", "remainingCount", "migrationStatus"]);
  assert.equal(metrics.workQueueIntegrityRate, "64.7%");
  assert.equal(metrics.dataConsistencyIntegrityRate, "未算出");
  assert.equal(metrics.migrationStatus, "保留");
  assert.equal(seed.dataConsistencyIssues[0].differenceCount, 12);
});

test("one repair requires confirmation, spreadsheet completion, then next", () => {
  const state = createWorkQueueState(seed);
  const current = getCurrentItem(state);
  const confirmed = confirmRepairDecision(state, current.id, { action: "HOLD" });
  assert.equal(confirmed.category, "REPAIR_CONFIRMED");
  assert.equal(confirmed.state.fixedCount, 11);
  assert.equal(getCurrentItem(confirmed.state).id, current.id);
  const sheetFixed = markSpreadsheetFixed(confirmed.state, current.id);
  assert.equal(sheetFixed.category, "SPREADSHEET_FIXED");
  assert.equal(sheetFixed.state.fixedCount, 12);
  assert.equal(getPendingItems(sheetFixed.state).length, 5);
  assert.equal(getCurrentItem(sheetFixed.state).id, current.id);
  const advanced = advanceWorkQueue(sheetFixed.state, current.id);
  assert.equal(advanced.category, "ADVANCED");
  assert.notEqual(getCurrentItem(advanced.state).id, current.id);
});

test("invalid repair does not advance the queue", () => {
  const state = createWorkQueueState(seed);
  const current = getCurrentItem(state);
  assert.equal(validateRepairDecision(current, { action: "" }), false);
  const result = confirmRepairDecision(state, current.id, { action: "" });
  assert.equal(result.category, "DECISION_INVALID");
  assert.equal(result.state, state);
});

test("duplicate decisions allow same person, different person, or hold without automatic merge", () => {
  const state = createWorkQueueState(seed);
  const duplicate = state.items.find((item) => item.type === "DUPLICATE_CANDIDATE");
  assert.equal(validateRepairDecision(duplicate, { action: "SAME_PERSON" }), true);
  assert.equal(validateRepairDecision(duplicate, { action: "DIFFERENT_PERSON" }), true);
  assert.equal(validateRepairDecision(duplicate, { action: "MERGE_AUTOMATIC" }), false);
  assert.equal(validateRepairDecision(duplicate, { action: "HOLD" }), true);
});

test("spreadsheet completion cannot be skipped and no save action remains", () => {
  const state = createWorkQueueState(seed);
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

test("seed contains no real personal or persistent write capability", () => {
  assert.equal(seed.safety.containsPersonalValues, false);
  assert.equal(seed.safety.persistentWriteEnabled, false);
  assert.equal(seed.safety.databaseChanged, false);
  assert.equal(seed.safety.productionChanged, false);
});

test("source lineage covers only the six open issues and records the six closed 28 graduate issues", () => {
  assert.equal(validateSourceLineage(lineage, seed), lineage);
  assert.equal(lineage.items.length, 6);
  assert.equal(lineage.resolvedIssueIds.length, 11);
  assert.equal(lineage.closedIssues.length, 6);
  assert.equal(lineage.closedIssues.filter((issue) => issue.final_status === "false_positive").length, 4);
  assert.equal(lineage.closedIssues.filter((issue) => issue.final_status === "resolved").length, 2);
  assert.equal(lineage.closedIssues.every((issue) => issue.current_queue_included === false), true);
  assert.equal(lineage.readOnly, true);
  assert.equal(lineage.containsPersonalValues, false);
  assert.deepEqual(new Set(lineage.items.map((item) => item.issue_id)), new Set(seed.items.map((item) => item.id)));
  assert.equal(lineage.items.every((item) => item.spreadsheet_name && item.sheet_name && item.source_row_no > 0), true);
  assert.equal(lineage.items.every((item) => item.open_url.startsWith("https://docs.google.com/spreadsheets/d/")), true);
});

test("lineage removes closed 28 graduate rows and preserves all 27 graduate duplicate groups", () => {
  const byType = lineage.items.reduce((groups, item) => {
    (groups[item.issue_type] ||= []).push(item);
    return groups;
  }, {});
  assert.equal(byType.SCHOOL_MISSING, undefined);
  assert.equal(byType.NAME_MISSING, undefined);
  assert.equal(byType.STATUS_MISSING, undefined);
  assert.deepEqual(byType.DUPLICATE_CANDIDATE.map((item) => item.source_row_no), [28, 29, 41, 98, 115, 120]);
  assert.deepEqual(byType.DUPLICATE_CANDIDATE.map((item) => item.duplicate_pair_row), [384, 387, 308, 271, [116, 451], 452]);
});

test("28 graduate official source is primary and the legacy copy is absent", () => {
  const source28 = lineage.sourceSpreadsheets.find((sourceItem) => sourceItem.graduation_year === "28卒");
  assert.equal(source28.spreadsheet_id, "1OwFCnRYfTOWGkUGhykURibUD5Ss06msHoaZwYdopkEA");
  assert.equal(source28.sheet_id, 1279221745);
  assert.equal(source28.lineage_role, "PRIMARY");
  assert.doesNotMatch(JSON.stringify(lineage), /1e7MhMDNVE0cMPBGU3sFU1WeLq7Q-ZVW4oSFy_IuxtTE/);
});

test("duplicate choice labels match the owner review contract", () => {
  assert.match(source, /"SAME_PERSON", "同一人物"/);
  assert.match(source, /"DIFFERENT_PERSON", "別人"/);
  assert.match(source, /"HOLD", "判断保留"/);
  assert.doesNotMatch(source, /候補Aを正として採用|候補Bを正として採用/);
});

test("work queue attaches lineage and renders no subject or current value", () => {
  const attached = attachSourceLineage(seed, lineage);
  assert.equal(attached.items.every((item) => item.lineage?.source_row_no > 0), true);
  assert.doesNotMatch(source, /addText\(documentObject, repair, "h2", current\.subject\)/);
  assert.doesNotMatch(source, /\["現在値", current\.currentValue\]/);
  assert.match(source, /正本Spreadsheetの該当行を開く/);
});
