import assert from "node:assert/strict";
import test from "node:test";
import { createTalentWorkforceSummaryExact1Executor } from "../portal/talent/exact1.mjs";

const config = {
  NOV_TALENT_CONFIG: {
    readonlyApiEnabled: true,
    workspaceContractVersion: "1.0.0",
    workspaceContractCompatibility: "legacy-v0-read",
    readonlyApiBaseUrl: "https://example.supabase.co/functions/v1/nov-talent-readonly-api-v2"
  },
  NOV_HUB_SESSION_CONTRACT: { audience: "nov_hub" },
  NovHubSession: { getSessionToken: async () => "x".repeat(32) }
};

function response(payload) {
  return {
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => payload
  };
}

test("workforce summary executor makes one read-only request and validates aggregate payload", async () => {
  let calls = 0;
  const executor = createTalentWorkforceSummaryExact1Executor({
    globalObject: config,
    fetchImpl: async () => {
      calls += 1;
      return response({
        ok: true,
        data: {
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
        },
        meta: { generatedAt: "2026-07-25T00:00:00.000Z", requestId: "test", source: "test", version: "2" }
      });
    }
  });
  const result = await executor.run();
  assert.equal(calls, 1);
  assert.equal(result.okBoolean, true);
  assert.equal(result.data.onboardingCount, 4);
  assert.equal(result.data.transferAvailable, false);
  assert.equal(result.data.procedureQueues.onboarding.length, 1);
  const duplicate = await executor.run();
  assert.equal(duplicate.stopCategory, "duplicate_startup_prevented");
  assert.equal(calls, 1);
});

test("workforce summary executor rejects malformed aggregate payload", async () => {
  const executor = createTalentWorkforceSummaryExact1Executor({
    globalObject: config,
    fetchImpl: async () => response({ ok: true, data: { activeEmployeeCount: 1 }, meta: {} })
  });
  const result = await executor.run();
  assert.equal(result.okBoolean, false);
  assert.equal(result.stopCategory, "invalid_response");
  assert.equal(result.rawResponseReturned, false);
});
