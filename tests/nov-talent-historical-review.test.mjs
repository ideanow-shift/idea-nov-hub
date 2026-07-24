import assert from "node:assert/strict";
import test from "node:test";
import {
  createTalentHistoricalReviewController,
  HISTORICAL_REVIEW_CONTRACT,
} from "../portal/talent/review.mjs";

const ids = Object.freeze({
  primary: "00000000-0000-4000-8000-000000000001",
  source: "00000000-0000-4000-8000-000000000002",
});

function fixtureGlobal() {
  return {
    NOV_TALENT_CONFIG: {
      writeApiEnabled: true,
      writeApiBaseUrl: "https://example.test/functions/v1/nov-talent-write-api",
    },
    NovHubSession: {
      async getSessionToken() {
        return "fixture-session-token-value-not-real";
      },
    },
  };
}

test("historical review sends one exact authenticated request and validates safe counts", async () => {
  const calls = [];
  const controller = createTalentHistoricalReviewController({
    globalObject: fixtureGlobal(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ok: true,
            data: {
              createdPrimary: 1,
              confirmedLinks: 1,
              remainingUnmapped: 0,
              canonicalEventCreated: false,
              rawValuesIncluded: false,
            },
          };
        },
      };
    },
  });
  const proposal = {
    primaryRecordIds: [ids.primary],
    linkPairs: [{ sourceRecordId: ids.source, targetRecordId: ids.primary }],
  };
  const result = await controller.apply(proposal);
  const duplicate = await controller.apply(proposal);
  assert.equal(result.ok, true);
  assert.equal(result.data.createdPrimary, 1);
  assert.equal(duplicate.category, "already_consumed");
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://example.test/functions/v1/nov-talent-write-api/api/talent/v1/historical/review",
  );
  assert.match(calls[0].options.headers.authorization, /^Bearer /u);
  assert.deepEqual(JSON.parse(calls[0].options.body), proposal);
});

test("historical review rejects ambiguous or malformed proposals before request", async () => {
  let requests = 0;
  const controller = createTalentHistoricalReviewController({
    globalObject: fixtureGlobal(),
    fetchImpl: async () => {
      requests += 1;
      throw new Error("unexpected");
    },
  });
  const result = await controller.apply({
    primaryRecordIds: [ids.primary, ids.primary],
    linkPairs: [],
  });
  assert.equal(result.category, "invalid_request");
  assert.equal(requests, 0);
  assert.equal(HISTORICAL_REVIEW_CONTRACT.requiresOwnerConfirmation, true);
  assert.equal(HISTORICAL_REVIEW_CONTRACT.retry, 0);
});
