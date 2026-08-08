import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";
import { FAIR_ATTRIBUTION_POPULATION_V2, cleanPopulationRequest, sha256Utf8 } from "../supabase/functions/nov-talent-staging-api/fair-attribution-population-v2.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const migrationPath = "supabase/migrations/20260808083816_nov_talent_fair_attribution_population_executor_v2.sql";

test("fixed executor contract contains no private Manifest payload", async () => {
  const contract = JSON.parse(await read("docs/nov_talent/fair_attribution_population_v2/executor-contract-v2.json"));
  assert.equal(contract.environment, "idea-nov-staging");
  assert.equal(contract.project_ref, "zgkoofphhivesclehrom");
  assert.equal(contract.logical_candidate_count, 161);
  assert.equal(contract.physical_pending_row_count, 201);
  assert.equal(contract.expected_attribution_count, 201);
  assert.equal(contract.expected_audit_count, 201);
  assert.equal(contract.retry_count, 0);
  assert.equal("cases" in contract, false);
  assert.equal("candidate_id" in contract, false);
  assert.equal("fair_id" in contract, false);
});

test("Edge validates raw Manifest bytes and canonical payload independently", async () => {
  const source = await read("supabase/functions/nov-talent-staging-api/fair-attribution-population-v2.ts");
  assert.match(source, /sha256Utf8\(request\.manifestJson\)/);
  assert.match(source, /delete canonicalPayload\.manifest_canonical_payload_sha256/);
  assert.match(source, /MANIFEST_CANONICAL_PAYLOAD_INVALID/);
  assert.match(source, /sourcePayload\(request\.sourceRangeValues\)/);
  assert.doesNotMatch(source, /student_name|phone|email|line_identifier/);
});

test("raw-byte hash detects whitespace and byte-level Manifest tampering", async () => {
  const original = '{"manifest_version":"v2"}';
  const whitespaceChanged = '{ "manifest_version":"v2" }';
  const valueChanged = '{"manifest_version":"v3"}';
  assert.notEqual(await sha256Utf8(original), await sha256Utf8(whitespaceChanged));
  assert.notEqual(await sha256Utf8(original), await sha256Utf8(valueChanged));
});

test("request exact-key contract cannot carry actor UUID or role", () => {
  assert.ok(cleanPopulationRequest({ manifestJson: "{}", sourceRangeValues: [] }));
  assert.equal(cleanPopulationRequest({ manifestJson: "{}", sourceRangeValues: [], actor: "attacker" }), null);
  assert.equal(cleanPopulationRequest({ manifestJson: "{}", sourceRangeValues: [], actorRole: "super_admin" }), null);
});

test("RPC is service-role-only, staging-host-only, and search_path fixed", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /zgkoofphhivesclehrom\.supabase\.co/);
  assert.match(sql, /request\.jwt\.claims/);
  assert.match(sql, /v_jwt_role <> 'service_role'/);
  assert.match(sql, /revoke all on function[\s\S]+from public, anon, authenticated, service_role/i);
  assert.match(sql, /grant execute on function[\s\S]+to service_role/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]+to (?:anon|authenticated)/i);
});

test("RPC freezes source identities and prevents concurrent or duplicate execution", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /pg_advisory_xact_lock/);
  for (const table of [
    "nov_talent_candidate_datasets_v1", "nov_talent_candidate_dataset_records_v1",
    "nov_talent_candidates_v1", "nov_talent_fair_masters_v1",
    "nov_talent_candidate_fair_attributions_v1", "nov_talent_candidate_fair_attribution_audit_v1",
  ]) assert.match(sql, new RegExp(`lock table public\\.${table}`));
  assert.match(sql, /population_v2_existing_state_not_empty/);
  assert.match(sql, /v_existing_attribution_count <> 0 or v_existing_audit_count <> 0 or v_existing_confirmed_count <> 0/);
});

test("live Candidate and Fair snapshot hashes use the recovered canonical contracts", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /r\.candidate_id::text, r\.graduation_year::text,[\s\S]+r\.source_row_no::text, r\.source_reference_hash, r\.source_type, c\.version::text/);
  assert.match(sql, /E'\\n' order by r\.candidate_id/);
  assert.match(sql, new RegExp(FAIR_ATTRIBUTION_POPULATION_V2.candidateSnapshotSha256));
  assert.match(sql, /f\.fair_id::text, f\.event_date::text,[\s\S]+case when f\.is_active then 't' else 'f' end, f\.version::text/);
  assert.match(sql, /E'\\n' order by f\.fair_id/);
  assert.match(sql, new RegExp(FAIR_ATTRIBUTION_POPULATION_V2.fairSnapshotSha256));
});

test("single RPC inserts exactly 201 PENDING rows and 201 append-only creation audits", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /'ORIGIN', 'PENDING'/);
  assert.match(sql, /QUEUE_POPULATION_V2_PENDING_CREATED/);
  assert.match(sql, /v_attribution_count <> 201 or v_audit_count <> 201/);
  assert.match(sql, /population_v2_atomic_count_mismatch/);
  assert.match(sql, /where attribution_status <> 'PENDING' or attribution_type <> 'ORIGIN'/);
  assert.doesNotMatch(sql, /update public\.nov_talent_candidates_v1|update public\.nov_talent_fair_masters_v1/i);
  assert.doesNotMatch(sql, /interview_count\s*=|offer_count\s*=|hire_count\s*=/i);
});

function runtime({ role = "hr.admin", enabled = false, approvalHash = "", host = "zgkoofphhivesclehrom.supabase.co", downstream }) {
  const calls = [];
  return {
    calls,
    value: {
      hubApiUrl: "https://hub.test/auth",
      supabaseUrl: `https://${host}`,
      serviceRoleKey: "server-only-key",
      populationV2Enabled: enabled,
      populationV2ApprovalTokenSha256: approvalHash,
      populationV2Validator: async () => ({ logicalCandidateCount: 161, physicalPendingRowCount: 201 }),
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        if (String(url) === "https://hub.test/auth") {
          return new Response(JSON.stringify({ ok: true, employee: { id: "00000000-0000-4000-8000-000000000009", roleKeys: [role] } }), { status: 200 });
        }
        return downstream(url, init);
      },
      logger: { error() {} },
    },
  };
}

function request(approval, body = { manifestJson: "{}", sourceRangeValues: [] }) {
  return new Request("https://edge.test/api/talent/v1/fair-origin-review/population-v2/execute", {
    method: "POST",
    headers: {
      origin: "https://ideanow-shift.github.io",
      authorization: "Bearer signed.session.token",
      "content-type": "application/json",
      "x-nov-talent-owner-approval": approval,
    },
    body: JSON.stringify(body),
  });
}

test("execution is disabled by default even for hr.admin", async () => {
  const fixture = runtime({ downstream: async () => { throw new Error("database must not be reached"); } });
  const response = await createHandler(fixture.value)(request("x".repeat(64)));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).safeCode, "POPULATION_V2_LOCKED");
  assert.equal(fixture.calls.length, 1);
});

test("browser CORS preflight never authorizes the private Owner approval header", async () => {
  const fixture = runtime({ downstream: async () => { throw new Error("database must not be reached"); } });
  const response = await createHandler(fixture.value)(new Request("https://edge.test/api/talent/v1/fair-origin-review/population-v2/execute", {
    method: "OPTIONS",
    headers: { origin: "https://ideanow-shift.github.io", "access-control-request-headers": "x-nov-talent-owner-approval" },
  }));
  assert.equal(response.status, 204);
  assert.doesNotMatch(response.headers.get("access-control-allow-headers") || "", /x-nov-talent-owner-approval/i);
  assert.equal(fixture.calls.length, 0);
});

test("production or any non-staging Supabase host is rejected before database access", async () => {
  const approval = "owner-approval-token-" + "x".repeat(32);
  const fixture = runtime({ enabled: true, approvalHash: await sha256Utf8(approval), host: "nkmxevmioczcmnldreyo.supabase.co", downstream: async () => { throw new Error("database must not be reached"); } });
  const response = await createHandler(fixture.value)(request(approval));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).safeCode, "POPULATION_V2_STAGING_ONLY");
  assert.equal(fixture.calls.length, 1);
});

test("Owner approval token is independent from HUB role", async () => {
  const configured = "configured-owner-approval-" + "a".repeat(32);
  const fixture = runtime({ enabled: true, approvalHash: await sha256Utf8(configured), downstream: async () => { throw new Error("database must not be reached"); } });
  const response = await createHandler(fixture.value)(request("wrong-owner-approval-" + "b".repeat(32)));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).safeCode, "POPULATION_V2_APPROVAL_REQUIRED");
  assert.equal(fixture.calls.length, 1);
});

test("authorized execution makes one retry-0 RPC and uses only server-resolved actor", async () => {
  const approval = "approved-by-owner-" + "z".repeat(40);
  const fixture = runtime({
    enabled: true,
    approvalHash: await sha256Utf8(approval),
    downstream: async () => new Response(JSON.stringify([{
      attribution_count: 201,
      audit_count: 201,
      manifest_canonical_payload_sha256: FAIR_ATTRIBUTION_POPULATION_V2.manifestCanonicalPayloadSha256,
    }]), { status: 200 }),
  });
  const response = await createHandler(fixture.value)(request(approval));
  assert.equal(response.status, 201);
  assert.equal(fixture.calls.length, 2);
  assert.match(fixture.calls[1].url, /rpc\/nov_talent_population_fair_attribution_queue_v2$/);
  const rpcBody = JSON.parse(fixture.calls[1].init.body);
  assert.equal(rpcBody.p_actor_employee_id, "00000000-0000-4000-8000-000000000009");
  assert.equal(rpcBody.p_actor_role, "hr.admin");
  assert.equal(rpcBody.p_environment, "idea-nov-staging");
  assert.equal("actor" in JSON.parse(await request(approval).text()), false);
  assert.deepEqual(await response.json(), { ok: true, data: {
    attributionCount: 201,
    auditCount: 201,
    status: "PENDING",
    manifestCanonicalPayloadSha256: FAIR_ATTRIBUTION_POPULATION_V2.manifestCanonicalPayloadSha256,
  } });
});

test("rejection logs only safe class metadata and never the private payload", async () => {
  const approval = "approved-by-owner-" + "z".repeat(40);
  const logs = [];
  const fixture = runtime({ enabled: true, approvalHash: await sha256Utf8(approval), downstream: async () => { throw new Error("database must not be reached"); } });
  fixture.value.logger = { error(message) { logs.push(message); } };
  fixture.value.populationV2Validator = async () => { throw new Error("MANIFEST_CANONICAL_PAYLOAD_INVALID"); };
  const privateMarker = "PRIVATE-MANIFEST-MARKER-MUST-NOT-LOG";
  const response = await createHandler(fixture.value)(request(approval, { manifestJson: JSON.stringify({ privateMarker }), sourceRangeValues: [] }));
  assert.equal(response.status, 409);
  assert.equal(logs.length, 1);
  assert.doesNotMatch(logs[0], /PRIVATE-MANIFEST-MARKER|manifestJson|sourceRangeValues|candidate_id|fair_id/);
  assert.match(logs[0], /MANIFEST_CANONICAL_PAYLOAD_INVALID/);
});

test("unauthorized HUB role cannot execute even with an Owner token", async () => {
  const approval = "approved-by-owner-" + "z".repeat(40);
  const fixture = runtime({ role: "hr.staff", enabled: true, approvalHash: await sha256Utf8(approval), downstream: async () => { throw new Error("database must not be reached"); } });
  const response = await createHandler(fixture.value)(request(approval));
  assert.equal(response.status, 403);
  assert.equal(fixture.calls.length, 1);
});

test("CLI is fixed to Staging, validation-only by default, and contains no retry loop", async () => {
  const cli = await read("review/nov-talent-fair-attribution-population-v2/execute-population-v2.mjs");
  assert.match(cli, /if \(!execute\)/);
  assert.match(cli, /mode: "validation-only"/);
  assert.match(cli, /Exactly one HTTP call/);
  assert.doesNotMatch(cli, /for \(let attempt|while \(|setTimeout\(/);
  assert.doesNotMatch(cli, /console\.(?:log|error)\((?:manifest|manifestJson|sourceValues|manifestBytes)/);
  assert.doesNotMatch(cli, /console\.(?:log|error)\([^\n]*(?:candidate_id|fair_id|student_name|phone|email)/);
});

test("Workspace Contract remains 1.0.0 and population has no Portal UI route", async () => {
  const [schema, html, app] = await Promise.all([
    read("contracts/nov-talent/workspace/v1.schema.json"),
    read("portal/talent/index.html"),
    read("portal/talent/app.mjs"),
  ]);
  assert.match(schema, /"const": "1\.0\.0"/);
  assert.doesNotMatch(html + app, /population-v2\/execute|OWNER_APPROVAL|manifestJson/);
});
