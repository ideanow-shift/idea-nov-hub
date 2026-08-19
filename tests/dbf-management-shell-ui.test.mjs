import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveDbfWorkflowState,
  safeDbfManagementError,
} from "../portal/management-app/business-data-management-preview.js";

test("empty month remains a normal pending workflow", () => {
  const result = deriveDbfWorkflowState([]);
  assert.equal(result.blocked, false);
  assert.equal(result.nextAction, "法人P/Lファイルを登録してください");
  assert.equal(result.nextTarget, "pl");
  assert.deepEqual(result.steps.map((step) => step.state), Array(7).fill("not_started"));
});

test("validated batch advances through mapping without pretending review is complete", () => {
  const result = deriveDbfWorkflowState(["pl", "bs", "store_operating_result", "budget"].map((factKind) => ({ factKind, status: "validated", errorCount: 0, quarantinedCount: 0 })));
  assert.deepEqual(result.steps.slice(0, 3).map((step) => step.state), ["complete", "complete", "complete"]);
  assert.equal(result.steps[3].state, "needs_attention");
  assert.equal(result.nextTarget, "account-review");
});

test("quarantine is fail-close and directs the owner to mapping", () => {
  const result = deriveDbfWorkflowState([{ status: "quarantined", errorCount: 0, quarantinedCount: 1 }]);
  assert.equal(result.blocked, true);
  assert.equal(result.nextAction, "法人・店舗の紐付けが必要なデータを確認してください");
  assert.equal(result.steps[2].state, "needs_attention");
});

test("approval and promotion are derived from backend history", () => {
  const approved = deriveDbfWorkflowState(["pl", "bs", "store_operating_result", "budget"].map((factKind) => ({ factKind, status: "approved", errorCount: 0 })), { reviewComplete: true, preflightReady: true });
  assert.equal(approved.steps[4].state, "complete");
  assert.equal(approved.nextTarget, "dashboard");
  const promoted = deriveDbfWorkflowState(["pl", "bs", "store_operating_result", "budget"].map((factKind) => ({ factKind, status: "promoted", errorCount: 0 })), { reviewComplete: true, preflightReady: true });
  assert.deepEqual(promoted.steps.map((step) => step.state), Array(7).fill("complete"));
  assert.equal(promoted.nextTarget, "history");
});

test("partial fact coverage points to the next missing monthly file", () => {
  const result = deriveDbfWorkflowState([{ factKind: "pl", status: "validated", errorCount: 0 }]);
  assert.equal(result.steps[0].state, "needs_attention");
  assert.equal(result.nextAction, "法人B/Sファイルを登録してください");
  assert.equal(result.nextTarget, "bs");
});

test("safe errors never expose arbitrary backend text", () => {
  assert.equal(safeDbfManagementError(new Error("COMPANY_SCOPE_REJECTED")).retryable, false);
  assert.match(safeDbfManagementError(new Error("DBF_ACCOUNT_REVIEW_ALREADY_FINAL")).message, /最終判断済み/u);
  const unknown = safeDbfManagementError(new Error("UNSAFE<script>alert(1)</script>"));
  assert.doesNotMatch(unknown.message, /<script>/u);
});
