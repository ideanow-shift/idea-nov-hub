import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildReviewWorkloadApprovalGuide,
  buildReviewWorkloadApprovalSteps,
  buildReviewWorkloadGuide
} from "../portal/talent/app.mjs";
import { buildTalent28CsvOwnerHandoffChecklist } from "../portal/talent/csv-import-preflight.mjs";

test("28卒 CSV owner handoff checklist keeps staging approval explicit", async () => {
  const html = await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const blocked = buildTalent28CsvOwnerHandoffChecklist({
    fixedCategory: "CSV_REQUIRED_IDENTITY_INCOMPLETE",
    readiness: { canRequestStagingPreflight: false },
    counts: { missingIdentityRows: 1 }
  });
  const ready = buildTalent28CsvOwnerHandoffChecklist({
    fixedCategory: "PASS",
    readiness: { canRequestStagingPreflight: true },
    counts: { totalRows: 3, readyRows: 3, quarantineRows: 0 }
  });

  assert.equal(blocked.category, "FIX_BEFORE_HANDOFF");
  assert.equal(blocked.approvalReachable, false);
  assert.deepEqual(blocked.steps.map((step) => step.category), ["SAFE_FIX_FIRST", "LOCAL_RECHECK", "NO_CHAT_VALUES"]);
  assert.equal(ready.category, "READY_HANDOFF");
  assert.equal(ready.approvalReachable, true);
  assert.deepEqual(ready.steps.map((step) => step.category), ["COUNT_CATEGORY_REVIEW", "SEPARATE_STAGING_APPROVAL", "NO_CANONICAL_LINE"]);
  assert.equal(ready.rawValuesIncluded, false);
  assert.equal(ready.productionDbOperation, false);
  assert.equal(ready.canonicalWriteReachable, false);
  assert.equal(ready.lineHistoryWriteReachable, false);
  assert.match(html, /talent-28-csv-owner-handoff-checklist/);
  assert.match(css, /\.csv-owner-handoff-checklist/);
});

test("27卒 review workload approval steps separate bulk and individual decisions", async () => {
  const html = await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../portal/talent/app.mjs", import.meta.url), "utf8");
  const guide = buildReviewWorkloadGuide([
    { mappingStatus: "UNMAPPED", sourceCode: "ENTRIES_27", suggestionCategory: "EXACT1" },
    { mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "NONE" },
    { mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "AMBIGUOUS" }
  ]);
  const approvalGuide = buildReviewWorkloadApprovalGuide(guide);
  const approvalSteps = buildReviewWorkloadApprovalSteps(approvalGuide);
  const individualSteps = buildReviewWorkloadApprovalSteps(
    buildReviewWorkloadApprovalGuide(buildReviewWorkloadGuide([
      { mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "NONE" }
    ]))
  );

  assert.equal(approvalGuide.category, "BULK_APPROVAL_READY");
  assert.equal(approvalSteps.category, "BULK_APPROVAL_READY");
  assert.deepEqual(approvalSteps.steps.map((step) => step.category), ["EXACT_MATCH_ONLY", "SEPARATE_UNMAPPED_WORK", "NO_PROMOTION"]);
  assert.equal(individualSteps.category, "INDIVIDUAL_REVIEW_REQUIRED");
  assert.deepEqual(individualSteps.steps.map((step) => step.category), ["OPEN_ONE_RECORD", "RECORD_DECISION", "KEEP_OUT_OF_BULK"]);
  assert.equal(approvalSteps.rawValuesIncluded, false);
  assert.equal(approvalSteps.canonicalWriteReachable, false);
  assert.equal(approvalSteps.lineHistoryWriteReachable, false);
  assert.equal(approvalSteps.automaticPromotionReachable, false);
  assert.match(html, /review-workload-approval-steps/);
  assert.match(css, /\.review-workload-approval-steps/);
  assert.match(app, /buildReviewWorkloadApprovalSteps/);
});
