import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createTalentStagingSupplementController,
  normalizeTalentStagingSupplement,
  STAGING_SUPPLEMENT_UI_CONTRACT,
} from "../portal/talent/staging-supplement.mjs";

const root = new URL("../", import.meta.url);
const recordId = "00000000-0000-4000-8000-000000000001";

function payload(overrides = {}) {
  return {
    stagingRecordId: recordId,
    expectedVersion: 0,
    displayName: "Test User",
    kana: "テスト ユーザー",
    school: "Test School",
    phone: "000-0000-0000",
    email: "test@example.invalid",
    preferredStore: "Test Store",
    currentStatus: "CONTACT",
    nextActionAt: "2026-07-25",
    offerDate: "",
    expectedJoinDate: "",
    plannedStore: "",
    ...overrides,
  };
}

test("staging supplement contract is exact, optimistic, and non-canonical", () => {
  const normalized = normalizeTalentStagingSupplement(payload());
  assert.equal(normalized.stagingRecordId, recordId);
  assert.equal(normalized.expectedVersion, 0);
  assert.equal(STAGING_SUPPLEMENT_UI_CONTRACT.createsCanonicalApplication, false);
  assert.equal(STAGING_SUPPLEMENT_UI_CONTRACT.rawValuesInResult, false);
  assert.equal(normalizeTalentStagingSupplement({ ...payload(), unexpected: true }), null);
  assert.equal(normalizeTalentStagingSupplement({ ...payload(), expectedVersion: -1 }), null);
  assert.equal(normalizeTalentStagingSupplement({ ...payload(), email: "not-an-email" }), null);
});

test("staging supplement controller sends one fixed request and accepts safe result", async () => {
  let calls = 0;
  let requestBody = null;
  const controller = createTalentStagingSupplementController({
    globalObject: {
      NOV_TALENT_CONFIG: { writeApiEnabled: true, writeApiBaseUrl: "https://example.invalid/functions" },
      NovHubSession: { getSessionToken: async () => "synthetic-session-token-123456" },
      fetch: async (url, options) => {
        calls += 1;
        assert.equal(url, "https://example.invalid/functions/api/talent/v1/staging/supplement");
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({
          ok: true,
          data: { stagingRecordId: recordId, supplementVersion: 1, operation: "CREATE" },
        }), { status: 200 });
      },
    },
  });
  const result = await controller.save(payload());
  assert.equal(result.ok, true);
  assert.equal(result.data.operation, "CREATE");
  assert.equal(calls, 1);
  assert.equal(requestBody.stagingRecordId, recordId);
  assert.equal("applicationNo" in requestBody, false);
});

test("staging supplement SQL keeps the write boundary and audit path", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260725190000_nov_talent_staging_supplements.sql", root), "utf8");
  assert.match(sql, /create table if not exists public\.nov_talent_historical_staging_supplements_v1/iu);
  assert.match(sql, /create table if not exists public\.nov_talent_historical_staging_supplement_audit_v1/iu);
  assert.match(sql, /save_nov_talent_staging_supplement_v1/iu);
  assert.match(sql, /supplement_version/iu);
  assert.match(sql, /staging_record_not_editable/iu);
  assert.match(sql, /supplement_version_conflict/iu);
  assert.match(sql, /nov_talent_applications_v1/iu);
  assert.doesNotMatch(sql, /insert into public\.nov_talent_applications_v1/iu);
  assert.match(sql, /source_sheet_code in \('CONTACTS_27', 'ENTRIES_27', 'OFFERS_27'\)/iu);
  assert.match(sql, /get_nov_talent_staging_workspace_v2/iu);
});
