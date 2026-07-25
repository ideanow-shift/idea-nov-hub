import assert from "node:assert/strict";
import test from "node:test";
import { createTalentStudentProfileAuditExact1Executor } from "../portal/talent/exact1.mjs";

function globalFixture() {
  return {
    NOV_TALENT_CONFIG: {
      readonlyApiEnabled: true,
      readonlyApiBaseUrl: "https://example.test/functions/v1/nov-talent-readonly-api-v2"
    },
    NOV_HUB_SESSION_CONTRACT: { audience: "nov_hub" },
    NovHubSession: {
      async getSessionToken() { return "fixture-session-token-value-not-real"; }
    }
  };
}

function envelope() {
  return {
    ok: true,
    data: {
      applicationNo: "NT-2027-000001",
      entries: [{
        action: "UPDATE",
        changedFields: ["offerDate", "plannedStore"],
        profileVersion: 2,
        occurredAt: "2026-07-25T03:00:00.000Z"
      }]
    },
    meta: {
      generatedAt: "2026-07-25T03:00:00.000Z",
      requestId: "fixture",
      source: "fixture",
      version: "2"
    }
  };
}

test("profile audit executor reads safe change metadata exactly once", async () => {
  const calls = [];
  const executor = createTalentStudentProfileAuditExact1Executor({
    applicationNo: "NT-2027-000001",
    globalObject: globalFixture(),
    hubContract: { audience: "nov_hub" },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        status: 200,
        headers: { get: () => "application/json" },
        async json() { return envelope(); }
      };
    }
  });

  const result = await executor.run();
  const duplicate = await executor.run();

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://example.test/functions/v1/nov-talent-readonly-api-v2/api/talent/v1/students/profile-audit?applicationNo=NT-2027-000001"
  );
  assert.equal(calls[0].options.method, "GET");
  assert.equal(result.okBoolean, true);
  assert.deepEqual(result.data.entries[0].changedFields, ["offerDate", "plannedStore"]);
  assert.equal(duplicate.duplicatePrevented, true);
});

test("profile audit executor rejects unknown changed fields", async () => {
  const malformed = envelope();
  malformed.data.entries[0].changedFields = ["secretField"];
  const executor = createTalentStudentProfileAuditExact1Executor({
    applicationNo: "NT-2027-000001",
    globalObject: globalFixture(),
    hubContract: { audience: "nov_hub" },
    fetchImpl: async () => ({
      status: 200,
      headers: { get: () => "application/json" },
      async json() { return malformed; }
    })
  });

  const result = await executor.run();
  assert.equal(result.okBoolean, false);
  assert.equal(result.stopCategory, "invalid_response");
});
