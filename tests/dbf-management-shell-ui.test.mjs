import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveDbfWorkflowState,
  safeDbfManagementError,
} from "../portal/management-app/business-data-management-preview.js";

test("empty month remains a normal pending workflow", () => {
  const result = deriveDbfWorkflowState([]);
  assert.equal(result.blocked, false);
  assert.equal(result.nextAction, "取込へ進む");
  assert.equal(result.nextTarget, "pl");
  assert.deepEqual(result.steps.map((step) => step.state), Array(7).fill("pending"));
});

test("validated batch advances through mapping without pretending review is complete", () => {
  const result = deriveDbfWorkflowState([{ status: "validated", errorCount: 0, quarantinedCount: 0 }]);
  assert.deepEqual(result.steps.slice(0, 3).map((step) => step.state), ["complete", "complete", "complete"]);
  assert.equal(result.steps[3].state, "pending");
  assert.equal(result.nextTarget, "account-review");
});

test("quarantine is fail-close and directs the owner to mapping", () => {
  const result = deriveDbfWorkflowState([{ status: "quarantined", errorCount: 0, quarantinedCount: 1 }]);
  assert.equal(result.blocked, true);
  assert.equal(result.nextAction, "未解決Mappingを確認してください");
  assert.equal(result.steps[2].state, "pending");
});

test("approval and promotion are derived from backend history", () => {
  const approved = deriveDbfWorkflowState([{ status: "approved", errorCount: 0 }], { reviewComplete: true, preflightReady: true });
  assert.equal(approved.steps[4].state, "complete");
  assert.equal(approved.nextTarget, "dashboard");
  const promoted = deriveDbfWorkflowState([{ status: "promoted", errorCount: 0 }], { reviewComplete: true, preflightReady: true });
  assert.deepEqual(promoted.steps.map((step) => step.state), Array(7).fill("complete"));
  assert.equal(promoted.nextTarget, "history");
});

test("safe errors never expose arbitrary backend text", () => {
  assert.equal(safeDbfManagementError(new Error("COMPANY_SCOPE_REJECTED")).retryable, false);
  assert.match(safeDbfManagementError(new Error("DBF_ACCOUNT_REVIEW_ALREADY_FINAL")).message, /最終判断済み/u);
  const unknown = safeDbfManagementError(new Error("UNSAFE<script>alert(1)</script>"));
  assert.doesNotMatch(unknown.message, /<script>/u);
});
