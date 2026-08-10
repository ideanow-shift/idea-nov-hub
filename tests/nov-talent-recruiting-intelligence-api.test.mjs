import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";

const ORIGIN = "https://ideanow-shift.github.io";
const ID = "10000000-0000-4000-8000-000000000001";
function request(method = "GET", authorized = true) { return new Request("https://staging.example.invalid/functions/v1/nov-talent-staging-api/api/talent/v1/recruiting-intelligence", { method, headers: { origin: ORIGIN, ...(authorized ? { authorization: `Bearer ${"a".repeat(32)}` } : {}) } }); }
function fixture({ failSelection = false, role = "hr.admin" } = {}) {
  const calls = [];
  return { calls, handler: createHandler({ hubApiUrl: "https://hub.example.invalid", supabaseUrl: "https://staging.example.invalid", serviceRoleKey: "fixture", now: () => new Date("2026-08-11T03:00:00Z"),
    async fetchImpl(url, init = {}) {
      const target = String(url); calls.push({ target, method: init.method || "GET" });
      if (target.includes("hub.example.invalid")) return Response.json({ ok: true, employee: { id: ID, roleKeys: [role] } });
      if (target.includes("nov_talent_candidates_v1")) return Response.json([{ candidate_id: ID, graduation_year: 2027, current_status_code: "INITIAL", school_id: null, is_active: true }]);
      if (failSelection && target.includes("nov_talent_selection_history_v1")) return Response.json({ code: "down" }, { status: 400 });
      return Response.json([]);
    } }) };
}

test("read-only route requires HUB session and never invokes RPC/write", async () => {
  assert.equal((await fixture().handler(request("GET", false))).status, 401);
  assert.equal((await fixture({ role: "general" }).handler(request())).status, 403);
  const run = fixture();
  const response = await run.handler(request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.recruiting_intelligence_contract_version, "1.0.0");
  assert.equal(body.data.currentPosition.candidateCount, 1);
  assert.equal(run.calls.some((call) => call.method !== "GET" && !call.target.includes("hub.example.invalid")), false);
  assert.equal(run.calls.some((call) => call.target.includes("/rpc/")), false);
  assert.equal((await fixture().handler(request("POST"))).status, 404);
});

test("source failure returns HTTP 200 PREPARING and null metrics", async () => {
  const response = await fixture({ failSelection: true }).handler(request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.sourceCoverageState, "PREPARING");
  assert.equal(body.data.funnel.uniqueCandidateReachedCounts, null);
  assert.deepEqual(body.data.priorities.buckets, []);
});
