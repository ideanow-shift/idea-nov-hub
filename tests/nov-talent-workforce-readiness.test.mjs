import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKFORCE_READONLY_CONTRACT,
  buildWorkforceProcedureCasePrefill,
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
    personalValuesReturned: true,
    contactValuesReturned: false,
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

test("connected workforce readiness returns minimal procedure rows without contact values", () => {
  const viewModel = buildWorkforceReadinessViewModel({
    source: "CORE_DB",
    mode: "READ_ONLY",
    status: "CONNECTED",
    summary: {
      activeEmployeeCount: 120,
      onboardingCount: 4,
      leaveCount: 3,
      retirementCount: 2,
      transferAvailable: false,
      transferCount: null,
      asOfDate: "2026-07-25",
      procedureQueues: {
        onboarding: [{ displayName: "山田 花子", effectiveDate: "2026-08-01", detail: "正社員" }],
        leave: [],
        retirement: []
      }
    }
  });

  assert.equal(viewModel.status, "CONNECTED");
  assert.equal(viewModel.countsAvailable, true);
  assert.equal(viewModel.summary.activeEmployeeCount, 120);
  assert.equal(viewModel.summary.transferAvailable, false);
  assert.equal(viewModel.personalValuesReturned, true);
  assert.equal(viewModel.contactValuesReturned, false);
  assert.equal(viewModel.mutationsAllowed, false);
});

test("Core DB procedure queues can open an audited case draft without mutating the employee master", () => {
  const draft = buildWorkforceProcedureCasePrefill("retirement", {
    displayName: "山田 花子",
    effectiveDate: "2026-08-31",
    detail: "退職予定"
  });
  assert.deepEqual(draft, {
    procedureType: "RETIREMENT",
    subjectLabel: "山田 花子",
    effectiveDate: "2026-08-31"
  });
  assert.equal(buildWorkforceProcedureCasePrefill("transfer", draft), null);
});
