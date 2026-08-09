import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateDashboardSummaryContract } from "../portal/talent/exact1.mjs";
import { WORKSPACE_CONTRACT_VERSION } from "../portal/talent/generated/workspace-contract-v1.mjs";

const validSummary = Object.freeze({
  contacts: 636,
  lineRegistrations: 465,
  salonTours: 188,
  interviews: 0,
  passed: 0,
  offers: 0,
  expectedJoiners: 0
});

const isInvalidResponse = (error) => error?.safeCategory === "invalid_response";

test("workspace.summary accepts the formal exact-key count contract", () => {
  assert.equal(validateDashboardSummaryContract(validSummary), validSummary);
});

test("workspace.summary rejects a value that is not a plain object", () => {
  assert.throws(() => validateDashboardSummaryContract([]), isInvalidResponse);
});

test("workspace.summary rejects unknown keys", () => {
  assert.throws(() => validateDashboardSummaryContract({ ...validSummary, extra: 1 }), isInvalidResponse);
});

test("workspace.summary preserves formal zero values", () => {
  const zeroSummary = Object.fromEntries(Object.keys(validSummary).map((key) => [key, 0]));
  assert.deepEqual(validateDashboardSummaryContract(zeroSummary), zeroSummary);
});

test("workspace.summary does not convert null to zero", () => {
  assert.throws(
    () => validateDashboardSummaryContract({ ...validSummary, salonTours: null }),
    isInvalidResponse
  );
});

test("the public module chain uses the workspace summary contract cache identity", async () => {
  const [html, app, runtime, exact1] = await Promise.all([
    readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8"),
    readFile(new URL("../portal/talent/app.mjs", import.meta.url), "utf8"),
    readFile(new URL("../portal/talent/runtime.mjs", import.meta.url), "utf8"),
    readFile(new URL("../portal/talent/exact1.mjs", import.meta.url), "utf8")
  ]);
  const identity = "20260809-outcome2-daily-workflow-2";
  assert.match(html, new RegExp(`style\\.css\\?v=${identity}`, "u"));
  assert.match(html, new RegExp(`runtime-config\\.candidate\\.js\\?v=${identity}`, "u"));
  assert.match(html, new RegExp(`app\\.mjs\\?v=${identity}`, "u"));
  assert.match(app, new RegExp(`runtime\\.mjs\\?v=${identity}`, "u"));
  assert.match(runtime, new RegExp(`exact1\\.mjs\\?v=${identity}`, "u"));
  assert.match(exact1, new RegExp(`workspace-contract-v1\\.mjs\\?v=${identity}`, "u"));
  assert.equal(WORKSPACE_CONTRACT_VERSION, "1.0.0");
});
