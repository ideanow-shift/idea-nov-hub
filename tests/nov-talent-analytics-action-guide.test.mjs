import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildTalentAnalytics, buildTalentAnalyticsActionGuide, buildTalentAnalyticsQueueHandoff } from "../portal/talent/analytics.mjs";

const root = new URL("../portal/talent/", import.meta.url);

test("analytics action guide prioritizes owner review before broad analysis", () => {
  const analytics = buildTalentAnalytics({
    overview: { total: 3, contacts: 1, entries: 1, offers: 1, mapped: 1, ownerReview: 1, quarantined: 1 },
    students: [
      { sourceCode: "CONTACTS_27", businessDate: "2026-05-01", classification: "OWNER_REVIEW", school: "A" },
      { sourceCode: "ENTRIES_27", businessDate: "2026-05-02", classification: "QUARANTINE", school: "A" },
      { sourceCode: "OFFERS_27", businessDate: "2026-05-03", classification: "IMPORTABLE", school: "B" }
    ]
  });
  const guide = buildTalentAnalyticsActionGuide(analytics);

  assert.equal(guide.category, "OWNER_REVIEW_FIRST");
  assert.equal(guide.needsActionCategory, "MULTIPLE");
  assert.deepEqual(guide.steps.map((step) => step.category), [
    "OPEN_REVIEW_QUEUE",
    "SEPARATE_DECISIONS",
    "KEEP_PROMOTION_BLOCKED"
  ]);
  assert.equal(guide.rawValuesIncluded, false);
  assert.equal(guide.canonicalWriteReachable, false);
  assert.equal(guide.lineHistoryWriteReachable, false);
  assert.equal(guide.productionWriteReachable, false);
  const handoff = buildTalentAnalyticsQueueHandoff(guide);
  assert.equal(handoff.category, "OPEN_STUDENT_REVIEW_QUEUE");
  assert.equal(handoff.queueFilterCategory, "OWNER_REVIEW_OR_QUARANTINE");
  assert.equal(handoff.sortCategory, "REVIEW_PRIORITY");
  assert.equal(handoff.rawValuesIncluded, false);
  assert.equal(handoff.canonicalWriteReachable, false);
  assert.equal(handoff.lineHistoryWriteReachable, false);
  assert.equal(handoff.promotionReachable, false);
});

test("analytics action guide routes clean flow to latest-month follow-up", () => {
  const analytics = buildTalentAnalytics({
    overview: { total: 2, contacts: 2, entries: 0, offers: 0, mapped: 2, ownerReview: 0, quarantined: 0 },
    students: [
      { sourceCode: "CONTACTS_27", businessDate: "2026-04-01", classification: "IMPORTABLE", school: "A" },
      { sourceCode: "CONTACTS_27", businessDate: "2026-05-01", classification: "IMPORTABLE", school: "A" }
    ]
  });
  const guide = buildTalentAnalyticsActionGuide(analytics);

  assert.equal(guide.category, "LATEST_MONTH_FOLLOW_UP");
  assert.equal(guide.latestMonthAvailable, true);
  assert.equal(guide.topSchoolAvailable, true);
  assert.deepEqual(guide.steps.map((step) => step.category), [
    "OPEN_LATEST_MONTH",
    "SET_NEXT_ACTION",
    "RETURN_TO_ANALYTICS"
  ]);
  const handoff = buildTalentAnalyticsQueueHandoff(guide);
  assert.equal(handoff.category, "OPEN_LATEST_MONTH_QUEUE");
  assert.equal(handoff.queueFilterCategory, "LATEST_MONTH");
  assert.equal(handoff.sortCategory, "FOLLOW_UP_DUE");
});

test("analytics action guide keeps empty analytics non-mutating", () => {
  const guide = buildTalentAnalyticsActionGuide(buildTalentAnalytics({ overview: {}, students: [] }));

  assert.equal(guide.category, "NO_ANALYTICS_ACTION");
  assert.equal(guide.needsActionCategory, "ZERO");
  assert.equal(guide.latestMonthAvailable, false);
  assert.equal(guide.topSchoolAvailable, false);
  assert.deepEqual(guide.steps.map((step) => step.category), [
    "WAIT_FOR_STAGING",
    "KEEP_EMPTY_STATE",
    "NO_RAW_VALUES"
  ]);
  const handoff = buildTalentAnalyticsQueueHandoff(guide);
  assert.equal(handoff.category, "NO_QUEUE_HANDOFF");
  assert.equal(handoff.queueFilterCategory, "NONE");
  assert.equal(handoff.productionWriteReachable, false);
});

test("analytics action guide is wired into the talent UI without raw output", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");

  assert.match(html, /id="talent-analytics-action-guide"/);
  assert.match(html, /id="talent-analytics-action-title"/);
  assert.match(html, /id="talent-analytics-action-copy"/);
  assert.match(html, /id="talent-analytics-action-steps"/);
  assert.match(app, /buildTalentAnalyticsActionGuide/);
  assert.match(app, /buildTalentAnalyticsQueueHandoff/);
  assert.match(app, /renderTalentAnalyticsActionGuide/);
  assert.match(app, /dataset\.needsActionCategory/);
  assert.match(app, /dataset\.queueHandoffCategory/);
  assert.match(app, /dataset\.queueFilterCategory/);
  assert.match(css, /talent-analytics-action-guide/);
  assert.doesNotMatch(html, /raw cells|credential|connection value/i);
});
