import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createStagingCandidateClient } from "../portal/talent/staging-write.mjs";
import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("attribution and append-only audit tables are isolated canonical records", async () => {
  const sql = await read("supabase/migrations/20260807210000_nov_talent_fair_attribution_review_workflow.sql");
  assert.match(sql, /create table public\.nov_talent_candidate_fair_attributions_v1/);
  assert.match(sql, /create table public\.nov_talent_candidate_fair_attribution_audit_v1/);
  assert.match(sql, /before update or delete/);
  assert.match(sql, /fair_attribution_audit_append_only/);
  assert.doesNotMatch(sql, /update public\.nov_talent_candidates_v1|update public\.nov_talent_fair_masters_v1/);
});

test("PENDING, CONFIRMED and REJECTED transitions keep explicit evidence", async () => {
  const sql = await read("supabase/migrations/20260807210000_nov_talent_fair_attribution_review_workflow.sql");
  for (const state of ["PENDING", "CONFIRMED", "REJECTED"]) assert.match(sql, new RegExp(`'${state}'`));
  assert.match(sql, /confirmed_by is not null and confirmed_at is not null/);
  assert.match(sql, /rejected_by is not null and rejected_at is not null/);
  assert.match(sql, /previous_status,new_status,reviewer,reviewer_role,reason,evidence_reference/);
});

test("a Candidate can have at most one confirmed ORIGIN Fair", async () => {
  const sql = await read("supabase/migrations/20260807210000_nov_talent_fair_attribution_review_workflow.sql");
  assert.match(sql, /create unique index nov_talent_one_confirmed_origin_per_candidate_v1/);
  assert.match(sql, /where attribution_type = 'ORIGIN' and attribution_status = 'CONFIRMED'/);
  assert.match(sql, /candidate_confirmed_origin_conflict/);
});

test("new tables are default-deny with forced RLS and explicit server grants", async () => {
  const sql = await read("supabase/migrations/20260807210000_nov_talent_fair_attribution_review_workflow.sql");
  assert.equal((sql.match(/enable row level security/g) || []).length, 2);
  assert.equal((sql.match(/force row level security/g) || []).length, 2);
  assert.match(sql, /revoke all[\s\S]+from public, anon, authenticated, service_role/);
  assert.match(sql, /grant select, insert, update[\s\S]+to service_role/);
  assert.doesNotMatch(sql, /grant (?:select|insert|update|delete).*to (?:anon|authenticated)/i);
});

test("only the approved HR administration roles can review", async () => {
  const [sql, api] = await Promise.all([
    read("supabase/migrations/20260807210000_nov_talent_fair_attribution_review_workflow.sql"),
    read("supabase/functions/nov-talent-staging-api/index.ts")
  ]);
  assert.match(sql, /not in \('super_admin','backoffice','hr\.admin'\)/);
  assert.doesNotMatch(sql, /not in \('super_admin','backoffice','hr\.admin','hr\.staff'\)/);
  assert.match(api, /actor\.profile !== "full"/);
  assert.match(api, /REVIEW_FORBIDDEN/);
});

test("review endpoints are routed before Workspace dashboard fan-out", async () => {
  const api = await read("supabase/functions/nov-talent-staging-api/index.ts");
  assert.ok(api.indexOf('path.startsWith("/api/talent/v1/fair-origin-review")') < api.indexOf("const rowResult = await readRows"));
  assert.match(api, /nov_talent_list_fair_attribution_review_v1/);
  assert.match(api, /nov_talent_list_fair_attribution_history_v1/);
  assert.match(api, /nov_talent_review_fair_attribution_v1/);
});

test("server decision validator is fail-closed and optimistic", async () => {
  const [domain, sql] = await Promise.all([
    read("supabase/functions/nov-talent-staging-api/domain.ts"),
    read("supabase/migrations/20260807210000_nov_talent_fair_attribution_review_workflow.sql")
  ]);
  assert.match(domain, /cleanFairAttributionDecision/);
  assert.match(domain, /expectedVersion/);
  assert.match(domain, /evidenceReference/);
  assert.match(sql, /fair_attribution_version_conflict/);
  assert.match(sql, /for update/);
});

test("browser uses the server API and never exposes a service key", async () => {
  const calls = [];
  const globalObject = {
    NOV_TALENT_CONFIG: { runtimeMode: "staging", networkEnabled: true, writeEnabled: true, writeApiBaseUrl: "https://example.test/functions/v1/nov-talent-staging-api" },
    fetch: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true, data: { entries: [] } }) }; }
  };
  const client = createStagingCandidateClient({ globalObject, sessionTokenProvider: async () => "signed-session" });
  const result = await client.fairOriginReviewQueue();
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /fair-origin-review$/);
  assert.equal(calls[0].init.headers.Authorization, "Bearer signed-session");
  assert.doesNotMatch(await read("portal/talent/staging-write.mjs"), /SUPABASE_SERVICE_ROLE_KEY/);
});

test("management UI asks a plain-language question and supports confirm reject and hold", async () => {
  const [html, app] = await Promise.all([read("portal/talent/index.html"), read("portal/talent/app.mjs")]);
  assert.match(html, /フェアきっかけ確認/);
  assert.match(html, /この学生はこのフェアがきっかけで合っていますか/);
  for (const label of ["このフェアで確認", "このフェアではない", "保留"]) assert.match(app, new RegExp(label));
  assert.doesNotMatch(html, />Attribution<|>Canonical<|>Projection</);
});

test("KPI publication remains outside this workflow", async () => {
  const [sql, app] = await Promise.all([
    read("supabase/migrations/20260807210000_nov_talent_fair_attribution_review_workflow.sql"),
    read("portal/talent/app.mjs")
  ]);
  assert.doesNotMatch(sql, /set\s+(interview_count|offer_count|hire_count)\s*=/i);
  assert.match(app, /集計準備中/);
});

test("Workspace Contract remains v1.0.0 and is not edited by review endpoints", async () => {
  const [html, contract] = await Promise.all([
    read("portal/talent/index.html"),
    read("contracts/nov-talent/workspace/v1.schema.json")
  ]);
  assert.match(html, /nov-talent-workspace-contract-version" content="1\.0\.0"/);
  assert.match(contract, /"const": "1\.0\.0"/);
});

test("migration intentionally creates no candidate rows or automatic confirmations", async () => {
  const sql = await read("supabase/migrations/20260807210000_nov_talent_fair_attribution_review_workflow.sql");
  assert.match(sql, /Schema only: this migration intentionally creates no attribution candidates/);
  assert.doesNotMatch(sql, /on conflict[\s\S]+nov_talent_candidate_fair_attributions_v1/i);
  assert.doesNotMatch(sql, /update public\.nov_talent_candidate_fair_attributions_v1 set attribution_status='CONFIRMED'/i);
});

function apiRuntime(roleKeys, downstream) {
  const calls = [];
  return {
    calls,
    runtime: {
      hubApiUrl: "https://hub.test/auth", supabaseUrl: "https://staging.test", serviceRoleKey: "server-only-key",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        if (String(url) === "https://hub.test/auth") return new Response(JSON.stringify({ ok: true, employee: { id: "00000000-0000-4000-8000-000000000009", roleKeys } }), { status: 200 });
        return downstream(url, init);
      }, logger: { error() {} }
    }
  };
}

test("authorized Queue read skips Candidate and dashboard fan-out", async () => {
  const fixture = apiRuntime(["hr.admin"], async () => new Response(JSON.stringify([]), { status: 200 }));
  const response = await createHandler(fixture.runtime)(new Request("https://edge.test/api/talent/v1/fair-origin-review", { headers: { origin: "https://ideanow-shift.github.io", authorization: "Bearer signed.session.token" } }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.entries, []);
  assert.equal(fixture.calls.length, 2);
  assert.match(fixture.calls[1].url, /rpc\/nov_talent_list_fair_attribution_review_v1$/);
  assert.doesNotMatch(fixture.calls[1].url, /candidates|fair_metrics|selection_history/);
});

test("hr.staff cannot read or mutate the Fair origin review workflow", async () => {
  const fixture = apiRuntime(["hr.staff"], async () => { throw new Error("database must not be reached"); });
  const response = await createHandler(fixture.runtime)(new Request("https://edge.test/api/talent/v1/fair-origin-review", { headers: { origin: "https://ideanow-shift.github.io", authorization: "Bearer signed.session.token" } }));
  assert.equal(response.status, 403);
  assert.equal(fixture.calls.length, 1);
});

test("optimistic or duplicate-origin conflicts return HTTP 409 without leaking DB text", async () => {
  const fixture = apiRuntime(["backoffice"], async () => new Response(JSON.stringify({ code: "40001", message: "private database detail" }), { status: 500 }));
  const response = await createHandler(fixture.runtime)(new Request("https://edge.test/api/talent/v1/fair-origin-review/00000000-0000-4000-8000-000000000001/decision", {
    method: "POST", headers: { origin: "https://ideanow-shift.github.io", authorization: "Bearer signed.session.token", "content-type": "application/json" },
    body: JSON.stringify({ decision: "CONFIRMED", expectedVersion: 1, reason: "正本を確認", evidenceReference: "CONTACTS_27:ROW:1" })
  }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.safeCode, "VERSION_CONFLICT");
  assert.doesNotMatch(JSON.stringify(body), /private database detail/);
});
