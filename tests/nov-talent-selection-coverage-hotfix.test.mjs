import assert from "node:assert/strict";
import test from "node:test";

import { buildSelectionFactCoverage } from "../portal/talent/app.mjs";
import { createSelectionCoverageExact1Executor } from "../portal/talent/exact1.mjs";
import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";

const ORIGIN = "https://ideanow-shift.github.io";
const TOKEN = "fixture-session-token-value-not-real";
const ACTOR_ID = "10000000-0000-4000-8000-000000009999";

function uuid(index) {
  return `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

const candidates = Array.from({ length: 636 }, (_, index) => ({
  candidate_id: uuid(index + 1), graduation_year: index < 528 ? 2027 : 2028,
  student_name: `fixture-${index + 1}`, student_name_kana: null,
  school_id: null, fair_id: null, school_name: null, faculty_name: null,
  phone: null, email: null, line_identifier: null, current_status_code: null,
  acquisition_source: null, assigned_to: null, notes: null,
  source_type: index < 528 ? "CONTACTS_27" : "CONTACTS_28",
  source_row_no: index + 1, version: 1, is_active: true
}));

const sourceFacts = Array.from({ length: 126 }, (_, index) => ({
  source_type: "ENTRIES_27",
  source_row_no: index + 1,
  fact_code: index % 2 === 0 ? "INTERVIEW_COMPLETED" : "OFFERED",
  fact_date: index < 42 ? "2026-08-01" : null,
  candidate_id: null,
  version: 1
}));

const baseViews = Object.freeze({
  nov_talent_candidates_v1: candidates,
  nov_talent_recruitment_events_v1: [],
  nov_talent_selection_history_v1: [],
  nov_talent_next_actions_v1: [],
  nov_talent_fair_metrics_v1: [],
  nov_talent_recruitment_source_facts_v1: sourceFacts,
  nov_talent_school_masters_v1: [],
  nov_talent_fair_masters_v1: []
});

function handler({ failSourceFacts = false } = {}) {
  return createHandler({
    hubApiUrl: "https://hub.example.invalid/functions/v1/nov-hub-api",
    supabaseUrl: "https://staging.example.invalid",
    serviceRoleKey: "server-only-fixture",
    logger: { error() {} },
    async fetchImpl(url) {
      if (String(url).includes("nov-hub-api")) {
        return Response.json({ ok: true, employee: { id: ACTOR_ID, roleKeys: ["hr.admin"] } });
      }
      if (failSourceFacts && String(url).includes("nov_talent_recruitment_source_facts_v1")) {
        return Response.json({ message: "fixture unavailable" }, { status: 503 });
      }
      const view = Object.keys(baseViews).find((name) => String(url).includes(name));
      assert.ok(view, `unexpected downstream view: ${String(url)}`);
      return Response.json(baseViews[view]);
    }
  });
}

async function requestPath(path, options) {
  const response = await handler(options)(new Request(
    `https://staging.example.invalid/functions/v1/nov-talent-staging-api${path}`,
    { headers: { origin: ORIGIN, authorization: `Bearer ${TOKEN}` } }
  ));
  return { response, envelope: await response.json() };
}

test("Workspace keeps v1.0.0 valid by exposing only dated evidence detail", async () => {
  const { response, envelope } = await requestPath("/api/talent/v1/workspace");
  assert.equal(response.status, 200);
  assert.equal(envelope.data.workspace_contract_version, "1.0.0");
  assert.equal(envelope.data.students.length, 636);
  assert.equal(envelope.data.dashboard.selectionHistoryCount, 0);
  assert.equal(envelope.data.overview.remainingManual, 126);
  assert.equal(envelope.data.unlinkedSelectionHistory.length, 42);
  assert.ok(envelope.data.unlinkedSelectionHistory.every((row) => row.date === "2026-08-01"));
  assert.equal(JSON.stringify(envelope).includes("1970-01-01"), false);
});

test("Coverage preserves 42 dated and 84 undated Evidence without promoting it to Selection", async () => {
  const { response, envelope } = await requestPath("/api/talent/v1/selection-coverage");
  assert.equal(response.status, 200);
  assert.equal(envelope.data.selection_coverage_contract_version, "1.0.0");
  assert.equal(envelope.data.sourceCoverageState, "READY");
  assert.equal(envelope.data.unlinkedEvidenceTotal, 126);
  assert.equal(envelope.data.datedUnlinkedEvidence, 42);
  assert.equal(envelope.data.undatedUnlinkedEvidence, 84);
  assert.equal(envelope.data.unlinkedUniqueCandidates, null);
  assert.equal(envelope.data.officialSelectionRows, 0);
  assert.equal(envelope.data.officialUniqueCandidates, 0);
  assert.equal(envelope.data.metrics.reduce((sum, row) => sum + row.unlinkedEvidenceTotal, 0), 126);

  const view = buildSelectionFactCoverage({}, envelope.data);
  assert.equal(view.state, "PARTIAL");
  assert.equal(view.unlinkedEvidenceTotal, 126);
  assert.equal(view.datedUnlinkedEvidence, 42);
  assert.equal(view.undatedUnlinkedEvidence, 84);
  assert.equal(view.officialSelectionTotal, 0);
});

test("Coverage source failure is preparing while Candidate Workspace remains HTTP 200", async () => {
  const coverage = await requestPath("/api/talent/v1/selection-coverage", { failSourceFacts: true });
  assert.equal(coverage.response.status, 200);
  assert.equal(coverage.envelope.data.sourceCoverageState, "PREPARING");
  assert.equal(coverage.envelope.data.unlinkedEvidenceTotal, null);
  assert.equal(coverage.envelope.data.datedUnlinkedEvidence, null);
  assert.equal(coverage.envelope.data.undatedUnlinkedEvidence, null);

  const workspace = await requestPath("/api/talent/v1/workspace", { failSourceFacts: true });
  assert.equal(workspace.response.status, 200);
  assert.equal(workspace.envelope.data.students.length, 636);
  assert.equal(workspace.envelope.data.partialStatus.state, "partial");
  assert.equal(workspace.envelope.data.overview.remainingManual, 0);
  assert.deepEqual(workspace.envelope.data.unlinkedSelectionHistory, []);
});

test("browser executor validates the independent Coverage response contract", async () => {
  const edge = handler();
  const globalObject = {
    NOV_TALENT_CONFIG: {
      readonlyApiEnabled: true,
      readonlyApiBaseUrl: "https://staging.example.invalid/functions/v1/nov-talent-staging-api/",
      workspaceContractVersion: "1.0.0"
    },
    NovHubSession: { async getSessionToken() { return TOKEN; } },
    fetch: (url, init = {}) => edge(new Request(url, { ...init, headers: { ...init.headers, origin: ORIGIN } }))
  };
  const executor = createSelectionCoverageExact1Executor({ globalObject });
  const result = await executor.run();
  assert.equal(result.okBoolean, true);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.data.unlinkedEvidenceTotal, 126);
  assert.equal(result.data.undatedUnlinkedEvidence, 84);
});
