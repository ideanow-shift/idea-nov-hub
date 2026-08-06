import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  validateWorkspaceResponse,
  WORKSPACE_CONTRACT_VERSION
} from "../portal/talent/generated/workspace-contract-v1.mjs";

const root = new URL("../", import.meta.url);
const uuid = (index) => `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

function dashboard() {
  const availability = Object.fromEntries([
    "candidateCount", "entries", "eventCount", "fairCount", "graduation2027", "graduation2028",
    "interviewHistory", "interviewPlanned", "lineRegistrations", "offeredElsewhere", "offers", "rejected",
    "salonTourCompleted", "salonTourPlanned", "schoolCount", "todayActions", "withdrawals"
  ].map((key) => [key, false]));
  return {
    availability,
    candidateCount: 0, entries: 0, eventCount: 0, fairCount: 1, graduation2027: 0, graduation2028: 0,
    interviewHistory: 0, interviewPlanned: 0, lineRegistrations: 0, offeredElsewhere: 0, offers: 0,
    rejected: 0, salonTourCompleted: 0, salonTourPlanned: 0, schoolCount: 0,
    selectionHistoryCount: 0, todayActions: 0, undatedActions: 0, unlinkedInterviewHistoryCount: 0, withdrawals: 0
  };
}

function response({ fairCount = null, version = WORKSPACE_CONTRACT_VERSION } = {}) {
  return {
    ok: true,
    data: {
      workspace_contract_version: version,
      accessProfile: "recruiter",
      canWrite: true,
      dashboard: dashboard(),
      fairMasters: [{
        assigned_to: null, contact_count: fairCount, created_at: "2026-08-06T00:00:00.000Z",
        event_date: "2026-08-06", event_format: null, expected_contacts: fairCount,
        fair_id: uuid(1), fair_name: "契約検証フェア", hire_count: fairCount, interview_count: fairCount,
        is_active: true, line_registration_count: fairCount, note: null, offer_count: fairCount,
        organizer_name: null, participant_count: fairCount, participating_salons: fairCount,
        participation_fee: fairCount, salon_tour_count: fairCount, total_attendance: fairCount,
        venue: null, version: 1
      }],
      fiscalYear: "all",
      overview: { contacts: 0, entries: 0, exactLinkSuggestions: 0, mapped: 0, manual: 0, offers: 0, ownerReview: 0, primaryCandidates: 0, quarantined: 0, remainingManual: 0, total: 0 },
      partialStatus: { retryCount: 0, state: "partial", unavailableViews: ["school_masters"] },
      payloadMode: "workspace",
      schoolMasters: [],
      students: [],
      summary: { contacts: 0, expectedJoiners: 0, interviews: 0, lineRegistrations: 0, offers: 0, passed: 0, salonTours: 0 },
      todayTasks: [],
      unlinkedSelectionHistory: []
    },
    meta: { generatedAt: "2026-08-06T00:00:00.000Z", requestId: "contract-fixture", source: "fixture", version: "3" }
  };
}

test("generated API and frontend contract artifacts are current", () => {
  execFileSync(process.execPath, ["scripts/generate-nov-talent-workspace-contract.mjs", "--check"], {
    cwd: new URL("../", import.meta.url), stdio: "pipe"
  });
});

test("Workspace Contract v1 accepts exact API payload and partial auxiliary state", () => {
  const result = validateWorkspaceResponse(response());
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.data.partialStatus.state, "partial");
});

test("Workspace Contract v1 rejects unknown keys and version mismatch", () => {
  const unknown = response();
  unknown.data.unexpected = true;
  const unknownResult = validateWorkspaceResponse(unknown);
  assert.deepEqual(
    { ok: unknownResult.ok, path: unknownResult.path, rule: unknownResult.rule },
    { ok: false, path: "workspace.data.unexpected", rule: "additionalProperties" }
  );
  const mismatch = validateWorkspaceResponse(response({ version: "2.0.0" }));
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.path, "workspace.data.workspace_contract_version");
});

test("nullable numeric fields preserve null, formal zero, and positive values", () => {
  for (const value of [null, 0, 12]) {
    const result = validateWorkspaceResponse(response({ fairCount: value }));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.value.data.fairMasters[0].contact_count, value);
  }
});

test("legacy v0 is accepted only by the explicit backward-compatible frontend phase", () => {
  const legacy = response();
  delete legacy.data.workspace_contract_version;
  assert.equal(validateWorkspaceResponse(legacy).ok, false);
  const compatible = validateWorkspaceResponse(legacy, { allowLegacyV0: true });
  assert.equal(compatible.ok, true, JSON.stringify(compatible));
  assert.equal(compatible.legacyUpgraded, true);
  assert.equal(compatible.value.data.workspace_contract_version, WORKSPACE_CONTRACT_VERSION);
});

test("Schema, generated Edge, Frontend config, and Pages metadata share version 1.0.0", () => {
  const schema = JSON.parse(readFileSync(new URL("../contracts/nov-talent/workspace/v1.schema.json", import.meta.url), "utf8"));
  const edge = readFileSync(new URL("../supabase/functions/nov-talent-staging-api/workspace-contract-v1.generated.ts", import.meta.url), "utf8");
  const api = readFileSync(new URL("../supabase/functions/nov-talent-staging-api/index.ts", import.meta.url), "utf8");
  const config = readFileSync(new URL("../portal/talent/runtime-config.candidate.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const exact1 = readFileSync(new URL("../portal/talent/exact1.mjs", import.meta.url), "utf8");
  assert.equal(schema["x-workspace-contract-version"], WORKSPACE_CONTRACT_VERSION);
  assert.match(edge, /WORKSPACE_CONTRACT_VERSION = "1\.0\.0"/u);
  assert.match(api, /validateWorkspaceResponse\(responseBody\)/u);
  assert.match(config, /workspaceContractVersion:\s*"1\.0\.0"/u);
  assert.match(html, /nov-talent-workspace-contract-version" content="1\.0\.0"/u);
  assert.match(exact1, /from "\.\/generated\/workspace-contract-v1\.mjs/u);
  assert.doesNotMatch(exact1, /WORKSPACE_DATA_KEYS/u);
});
