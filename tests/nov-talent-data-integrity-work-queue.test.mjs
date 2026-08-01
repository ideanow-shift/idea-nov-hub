import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRepairDecision,
  createWorkQueueState,
  getCurrentItem,
  getPendingItems,
  getWorkQueueMetrics,
  validateRepairDecision,
  validateWorkQueuePayload
} from "../portal/talent/data-integrity-work-queue.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seed = JSON.parse(fs.readFileSync(path.join(root, "portal", "talent", "data-integrity-work-queue.seed.json"), "utf8"));
const html = fs.readFileSync(path.join(root, "portal", "talent", "data-integrity-work-queue.html"), "utf8");
const css = fs.readFileSync(path.join(root, "portal", "talent", "data-integrity-work-queue.css"), "utf8");

test("work queue contains only the 17 confirmed daily corrections", () => {
  assert.equal(validateWorkQueuePayload(seed), seed);
  assert.equal(seed.items.length, 17);
  assert.equal(seed.metrics.remainingCount, 17);
  assert.deepEqual(new Set(seed.items.map((item) => item.type)), new Set(["SCHOOL_MISSING", "NAME_MISSING", "STATUS_MISSING", "DUPLICATE_CANDIDATE"]));
});

test("assignee and next action remain uncounted instead of being invented", () => {
  const assignee = seed.categoryCounts.find((entry) => entry.type === "ASSIGNEE_MISSING");
  const nextAction = seed.categoryCounts.find((entry) => entry.type === "NEXT_ACTION_MISSING");
  assert.equal(assignee.count, null);
  assert.equal(nextAction.count, null);
});

test("fixed schema exposes only the four approved KPIs", () => {
  const metrics = getWorkQueueMetrics(createWorkQueueState(seed));
  assert.deepEqual(Object.keys(metrics), ["integrityRate", "fixedCount", "remainingCount", "migrationProgress"]);
  assert.equal(metrics.integrityRate, "未算出");
});

test("one valid repair advances exactly one item", () => {
  const state = createWorkQueueState(seed);
  const current = getCurrentItem(state);
  const result = applyRepairDecision(state, current.id, { value: "確認済み学校" });
  assert.equal(result.category, "FIXED");
  assert.equal(result.state.fixedCount, 1);
  assert.equal(getPendingItems(result.state).length, 16);
  assert.notEqual(getCurrentItem(result.state).id, current.id);
});

test("invalid repair does not advance the queue", () => {
  const state = createWorkQueueState(seed);
  const current = getCurrentItem(state);
  assert.equal(validateRepairDecision(current, { value: "" }), false);
  const result = applyRepairDecision(state, current.id, { value: "" });
  assert.equal(result.category, "DECISION_INVALID");
  assert.equal(result.state, state);
});

test("duplicate decisions require one candidate or hold", () => {
  const state = createWorkQueueState(seed);
  const duplicate = state.items.find((item) => item.type === "DUPLICATE_CANDIDATE");
  assert.equal(validateRepairDecision(duplicate, { action: "KEEP_A" }), true);
  assert.equal(validateRepairDecision(duplicate, { action: "KEEP_B" }), true);
  assert.equal(validateRepairDecision(duplicate, { action: "MERGE_AUTOMATIC" }), false);
  const held = applyRepairDecision(state, duplicate.id, { action: "HOLD" });
  assert.equal(held.category, "HELD");
  assert.equal(held.state.fixedCount, 0);
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
