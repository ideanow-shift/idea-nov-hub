import assert from "node:assert/strict";
import test from "node:test";
import {
  createTalentStudentProfileController,
  normalizeStudentProfileForm,
} from "../portal/talent/student-profile.mjs";

const payload = {
  applicationNo: null,
  expectedVersion: 0,
  displayName: "表示 氏名",
  kana: "ヒョウジ シメイ",
  school: "表示学校",
  phone: "",
  email: "owner@example.test",
  preferredStore: "",
  currentStatus: "CONTACT",
  nextActionAt: "2026-08-01",
  offerDate: null,
  expectedJoinDate: null,
  plannedStore: null,
};

test("student profile form normalizes bounded nullable fields", () => {
  const normalized = normalizeStudentProfileForm(payload);
  assert.equal(normalized.displayName, "表示 氏名");
  assert.equal(normalized.phone, null);
  assert.equal(normalized.currentStatus, "CONTACT");
  assert.equal(normalizeStudentProfileForm({ ...payload, email: "invalid" }), null);
  assert.equal(normalizeStudentProfileForm({ ...payload, extra: true }), null);
});

test("student profile controller sends one authenticated canonical write", async () => {
  const calls = [];
  const controller = createTalentStudentProfileController({
    globalObject: {
      NOV_TALENT_CONFIG: {
        writeApiEnabled: true,
        writeApiBaseUrl: "https://example.test/functions/v1/nov-talent-write-api",
      },
      NovHubSession: {
        async getSessionToken() { return "fixture-session-token-value-not-real"; },
      },
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            data: {
              applicationNo: "NT-2027-000001",
              profileVersion: 1,
              operation: "CREATE",
            },
          };
        },
      };
    },
  });
  const result = await controller.save(payload);
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].options.headers.authorization, /^Bearer /u);
  assert.equal(JSON.parse(calls[0].options.body).displayName, "表示 氏名");
});
