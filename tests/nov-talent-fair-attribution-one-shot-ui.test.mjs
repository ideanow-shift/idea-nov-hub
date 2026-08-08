import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";
import { FAIR_ATTRIBUTION_POPULATION_V2 } from "../supabase/functions/nov-talent-staging-api/fair-attribution-population-v2.ts";
import { initializeFairOriginPreparation } from "../portal/talent/app.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const ORIGIN = "https://ideanow-shift.github.io";
const ACTOR = "00000000-0000-4000-8000-000000000009";

function runtime({ role = "hr.admin", enabled = true, approved = true, host = "zgkoofphhivesclehrom.supabase.co", rpcStatus = 200, validatorFails = false } = {}) {
  const calls = [];
  return {
    calls,
    value: {
      hubApiUrl: "https://hub.test/auth",
      supabaseUrl: `https://${host}`,
      serviceRoleKey: "server-only-key",
      populationV2Enabled: enabled,
      populationV2ApprovalTokenSha256: "a".repeat(64),
      populationV2BrowserApproved: approved,
      populationV2BrowserPayloadProvider: async () => ({ manifestJson: "{}", sourceRangeValues: [] }),
      populationV2Validator: async () => {
        if (validatorFails) throw new Error("FIXED_PAYLOAD_INVALID");
        return { logicalCandidateCount: 161, physicalPendingRowCount: 201 };
      },
      populationV2BrowserPreflight: async (_runtime, execution) => execution,
      logger: { error() {} },
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        if (String(url) === "https://hub.test/auth") {
          return new Response(JSON.stringify({ ok: true, employee: { id: ACTOR, roleKeys: [role] } }), { status: 200 });
        }
        return new Response(JSON.stringify(rpcStatus === 200 ? [{
          attribution_count: 201,
          audit_count: 201,
          manifest_canonical_payload_sha256: FAIR_ATTRIBUTION_POPULATION_V2.manifestCanonicalPayloadSha256,
        }] : { code: "55000" }), { status: rpcStatus });
      },
    },
  };
}

function request(method = "GET", { auth = true, body } = {}) {
  return new Request("https://edge.test/api/talent/v1/fair-origin-review/preparation", {
    method,
    headers: { origin: ORIGIN, ...(auth ? { authorization: "Bearer existing.hub.session" } : {}), "content-type": "application/json" },
    body,
  });
}

test("browser readiness is staging, authenticated, role-gated, approved and returns only safe counts", async () => {
  const fixture = runtime();
  const response = await createHandler(fixture.value)(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, data: {
    ready: true, logicalCandidateCount: 161, singleCandidateCount: 121,
    multipleCandidateCount: 40, physicalPendingRowCount: 201,
  } });
  assert.equal(fixture.calls.length, 1);

  assert.equal((await createHandler(runtime().value)(request("GET", { auth: false }))).status, 401);
  assert.equal((await createHandler(runtime({ role: "hr.staff" }).value)(request())).status, 403);
  assert.equal((await createHandler(runtime({ host: "nkmxevmioczcmnldreyo.supabase.co" }).value)(request())).status, 404);
  const disabled = await createHandler(runtime({ enabled: false }).value)(request());
  assert.equal(disabled.status, 200);
  assert.equal((await disabled.json()).data.ready, false);
  assert.equal((await createHandler(runtime({ enabled: false }).value)(request("POST", { body: "{}" }))).status, 503);
  assert.equal((await createHandler(runtime({ approved: false }).value)(request())).status, 200);
});

test("browser execution accepts an empty command and uses only the server-resolved actor", async () => {
  const fixture = runtime();
  const response = await createHandler(fixture.value)(request("POST", { body: "{}" }));
  assert.equal(response.status, 201);
  assert.equal(fixture.calls.length, 2);
  const rpcCall = fixture.calls[1];
  assert.match(rpcCall.url, /rpc\/nov_talent_population_fair_attribution_queue_v2$/u);
  const body = JSON.parse(rpcCall.init.body);
  assert.equal(body.p_actor_employee_id, ACTOR);
  assert.equal(body.p_actor_role, "hr.admin");
  assert.equal(body.p_environment, "idea-nov-staging");
  const envelope = await response.json();
  assert.deepEqual(envelope, { ok: true, data: {
    completed: true, logicalCandidateCount: 161, singleCandidateCount: 121,
    multipleCandidateCount: 40, physicalPendingRowCount: 201,
  } });
  assert.doesNotMatch(JSON.stringify(envelope), /token|actor|manifest|hash|uuid/iu);
});

test("invalid command, failed validation, and second execution fail without retry", async () => {
  const invalid = runtime();
  assert.equal((await createHandler(invalid.value)(request("POST", { body: JSON.stringify({ actorRole: "hr.admin" }) }))).status, 400);
  assert.equal(invalid.calls.length, 1);

  const validation = runtime({ validatorFails: true });
  assert.equal((await createHandler(validation.value)(request("POST", { body: "{}" }))).status, 409);
  assert.equal(validation.calls.length, 1);

  const conflict = runtime({ rpcStatus: 409 });
  const response = await createHandler(conflict.value)(request("POST", { body: "{}" }));
  assert.equal(response.status, 409);
  assert.equal(conflict.calls.length, 2);
});

function element() {
  const listeners = new Map();
  return {
    hidden: false, disabled: false, textContent: "", dataset: {},
    addEventListener(type, listener) { listeners.set(type, listener); },
    async click() { return listeners.get("click")?.({ preventDefault() {} }); },
    showModal() { this.open = true; }, close() { this.open = false; },
  };
}

function documentFixture() {
  const ids = [
    "fair-origin-preparation-panel", "fair-origin-preparation-open", "fair-origin-preparation-dialog",
    "fair-origin-preparation-cancel", "fair-origin-preparation-execute", "fair-origin-preparation-result",
    "fair-origin-preparation-status",
    "fair-origin-preparation-logical", "fair-origin-preparation-single", "fair-origin-preparation-multiple",
    "fair-origin-preparation-physical",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, element()]));
  return { elements, document: { getElementById(id) { return elements[id] || null; } } };
}

const ready = { ok: true, data: { ready: true, logicalCandidateCount: 161, singleCandidateCount: 121, multipleCandidateCount: 40, physicalPendingRowCount: 201 } };

test("operator UI stays hidden outside staging and blocks double click and automatic retry", async () => {
  const production = documentFixture();
  let productionReads = 0;
  initializeFairOriginPreparation(production.document, { NOV_TALENT_CONFIG: { runtimeMode: "mock" } }, { fairOriginPreparationReadiness: async () => { productionReads += 1; } });
  assert.equal(production.elements["fair-origin-preparation-panel"].hidden, true);
  assert.equal(productionReads, 0);

  const fixture = documentFixture();
  let executes = 0;
  initializeFairOriginPreparation(fixture.document, { location: { origin: ORIGIN }, NOV_TALENT_CONFIG: { runtimeMode: "staging" } }, {
    fairOriginPreparationReadiness: async () => ready,
    prepareFairOriginReview: async () => { executes += 1; return { ok: false, category: "api_error" }; },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fixture.elements["fair-origin-preparation-panel"].hidden, false);
  await Promise.all([
    fixture.elements["fair-origin-preparation-execute"].click(),
    fixture.elements["fair-origin-preparation-execute"].click(),
  ]);
  assert.equal(executes, 1);
  assert.equal(fixture.elements["fair-origin-preparation-execute"].disabled, true);
  assert.equal(fixture.elements["fair-origin-preparation-result"].textContent, "準備を完了できませんでした。データは変更されていません。");
});

test("disabled executor keeps the Staging operator summary visible but execution unavailable", async () => {
  const fixture = documentFixture();
  initializeFairOriginPreparation(fixture.document, { location: { origin: ORIGIN }, NOV_TALENT_CONFIG: { runtimeMode: "staging" } }, {
    fairOriginPreparationReadiness: async () => ({ ...ready, data: { ...ready.data, ready: false } }),
    prepareFairOriginReview: async () => { throw new Error("disabled button must not execute"); },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fixture.elements["fair-origin-preparation-panel"].hidden, false);
  assert.equal(fixture.elements["fair-origin-preparation-open"].disabled, true);
  assert.equal(fixture.elements["fair-origin-preparation-logical"].textContent, "161名");
  assert.equal(fixture.elements["fair-origin-preparation-status"].textContent, "現在は実行できません。実行承認後に利用できます。");
});

test("public UI contains no token, actor, UUID or internal execution vocabulary", async () => {
  const [html, app, client] = await Promise.all([
    read("portal/talent/index.html"), read("portal/talent/app.mjs"), read("portal/talent/staging-write.mjs"),
  ]);
  const visible = html.match(/<section id="fair-origin-preparation-panel"[\s\S]*?<\/dialog>/u)?.[0] || "";
  assert.match(visible, /フェア確認データを準備する/);
  assert.doesNotMatch(visible, /Population|Manifest|RPC|Attribution|Hash|token|UUID|candidate_id|fair_id/iu);
  assert.doesNotMatch(app + client, /localStorage|sessionStorage|console\.(?:log|error).*token|actor_employee_id|actor_role/iu);
  assert.match(client, /getNovHubSessionToken/);
  assert.match(client, /body: \{\}/);
});
