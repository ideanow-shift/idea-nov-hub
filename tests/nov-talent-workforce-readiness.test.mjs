import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKFORCE_READONLY_CONTRACT,
  buildWorkforceReadinessViewModel
} from "../portal/talent/workforce-readiness.mjs";

test("workforce readiness stays read-only and fail-closed before Core DB connection", () => {
  const viewModel = buildWorkforceReadinessViewModel();

  assert.equal(viewModel.source, "CORE_DB");
  assert.equal(viewModel.mode, "READ_ONLY");
  assert.equal(viewModel.status, "NOT_CONNECTED");
  assert.equal(viewModel.countsAvailable, false);
  assert.equal(viewModel.personalValuesReturned, false);
  assert.equal(viewModel.mutationsAllowed, false);
  assert.equal(viewModel.categories.length, 4);
  assert.deepEqual(WORKFORCE_READONLY_CONTRACT, {
    source: "CORE_DB",
    mode: "READ_ONLY",
    personalValuesReturned: false,
    mutationsAllowed: false,
    status: "NOT_CONNECTED"
  });
});

test("workforce readiness rejects unapproved connection state and source values", () => {
  const viewModel = buildWorkforceReadinessViewModel({ source: "REMOTE", mode: "WRITE", status: "CONNECTED" });

  assert.equal(viewModel.source, "UNKNOWN");
  assert.equal(viewModel.mode, "UNAVAILABLE");
  assert.equal(viewModel.status, "NOT_CONNECTED");
  assert.equal(viewModel.countsAvailable, false);
  assert.equal(viewModel.personalValuesReturned, false);
  assert.equal(viewModel.mutationsAllowed, false);
});
