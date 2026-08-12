import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1.0.14";

type EdgeHandler = (request: Request) => Response | Promise<Response>;
type MatrixCase = {
  id: string;
  method: string;
  path: string;
  bodyClass: string;
  authClass: string;
  v120Status: number;
  v121Status: number;
  correctiveStatus: number;
  routingBranch: string;
  dataAccessed: boolean;
  dbWrite: number;
};

const matrix = JSON.parse(await Deno.readTextFile(new URL(
  "./fixtures/dbf-edge-root-routing-request-matrix.json",
  import.meta.url,
))) as { cases: MatrixCase[]; observedProbe: Record<string, unknown> };

let handler: EdgeHandler | undefined;
const originalServe = Deno.serve;
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const logs: string[] = [];
let fetchCount = 0;
const profile = Deno.env.get("DBF_EDGE_PROFILE") || "corrective";
const expectedStatusKey = profile === "v120" ? "v120Status"
  : profile === "v121" ? "v121Status"
  : "correctiveStatus";

// Capture the production entrypoint itself. This avoids a second test-only
// router and preserves the exact request parsing and dispatch order.
(Deno as unknown as { serve: (handler: EdgeHandler) => unknown }).serve = (candidate) => {
  handler = candidate;
  return { finished: Promise.resolve() };
};
globalThis.fetch = ((..._args: Parameters<typeof fetch>) => {
  fetchCount += 1;
  throw new Error("Unexpected network/data access in root-routing contract fixture.");
}) as typeof fetch;
console.error = (...values: unknown[]) => logs.push(values.map(String).join(" "));

try {
  const configuredEntrypoint = Deno.env.get("DBF_EDGE_ENTRYPOINT");
  const entrypoint = configuredEntrypoint && /^[A-Za-z]:[/\\]/u.test(configuredEntrypoint)
    ? new URL(`file:///${configuredEntrypoint.replaceAll("\\", "/")}`)
    : configuredEntrypoint
    ? new URL(configuredEntrypoint, import.meta.url)
    : new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url);
  entrypoint.searchParams.set("root-routing-contract", String(Date.now()));
  await import(entrypoint.href);
} finally {
  (Deno as unknown as { serve: typeof Deno.serve }).serve = originalServe;
}

assert(handler, "NOV HUB Edge entrypoint did not register a handler");

const state = "state_1234567890123456789012";
const handoffCode = "x".repeat(43);
const stagingOrigin = "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app";

function requestBody(testCase: MatrixCase): { headers?: HeadersInit; body?: BodyInit } {
  const token = testCase.authClass === "invalid_hub_session" ? "invalid-test-hub-session" : "";
  const json = (action?: string, payload: Record<string, unknown> = {}) => ({
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...(action ? { action } : {}), token, payload }),
  });
  switch (testCase.bodyClass) {
    case "none":
      return {};
    case "empty_form":
      return { headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: "" };
    case "malformed_json":
      return { headers: { "content-type": "application/json" }, body: "{action:bootstrap}" };
    case "form_existing_action":
      return {
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ action: "bootstrap", token, payload: JSON.stringify({ authType: "hub_session" }) }),
      };
    case "json_action_missing":
      return json(undefined, {});
    case "json_unknown_action":
      return json("dbfStagingHandoffUnknownV1", {});
    case "json_existing_action":
      return json("bootstrap", { authType: "hub_session" });
    case "json_handoff_issue":
      return json("dbfStagingHandoffIssueV1", { authType: "hub_session", state });
    case "json_handoff_issue_actor_spoof":
      return json("dbfStagingHandoffIssueV1", { authType: "hub_session", state, actor: "frontend-spoof" });
    case "json_handoff_exchange":
      return json("dbfStagingHandoffExchangeV1", { handoffCode, state, origin: stagingOrigin });
    case "json_handoff_exchange_malformed":
      return json("dbfStagingHandoffExchangeV1", { handoffCode, state, origin: stagingOrigin, actor: "frontend-spoof" });
    default:
      throw new Error(`Unsupported fixture body class: ${testCase.bodyClass}`);
  }
}

Deno.test("Edge root routing request matrix", async () => {
  const results: Array<Record<string, unknown>> = [];
  for (const testCase of matrix.cases) {
    fetchCount = 0;
    const init = requestBody(testCase);
    const headers = new Headers(init.headers);
    if (testCase.authClass === "invalid_iap") {
      headers.set("x-dbf-iap-assertion", "invalid.invalid.invalid");
    }
    const response = await handler!(new Request(`https://edge.fixture.invalid${testCase.path}`, {
      method: testCase.method,
      headers,
      body: testCase.method === "GET" || testCase.method === "OPTIONS" ? undefined : init.body,
    }));
    const responseText = await response.text();
    const expectedStatus = testCase[expectedStatusKey as keyof MatrixCase] as number;
    assertEquals(response.status, expectedStatus, `${profile}/${testCase.id}: ${responseText}`);
    assertEquals(fetchCount, 0, `${testCase.id} accessed a remote API or database`);
    if (testCase.id === "get_liveness") {
      assertEquals(JSON.parse(responseText).dataAccessed, false);
    }
    results.push({
      id: testCase.id,
      method: testCase.method,
      path: testCase.path,
      bodyClass: testCase.bodyClass,
      authClass: testCase.authClass,
      v120Status: testCase.v120Status,
      v121Status: testCase.v121Status,
      expectedStatus,
      correctiveStatus: response.status,
      routingBranch: testCase.routingBranch,
      dataAccessed: false,
      dbWrite: 0,
    });
  }
  console.log(JSON.stringify({ contract: "dbf_edge_root_routing_v1", profile, results }));
});

Deno.test("regression evidence distinguishes malformed transport from valid JSON", async () => {
  const intended = JSON.stringify({
    action: "dbfStagingHandoffIssueV1",
    token: "",
    payload: { authType: "hub_session", state },
  });
  const malformed = "{action:dbfStagingHandoffIssueV1,token:,payload:{state:state_1234567890123456789012}}";
  const validResponse = await handler!(new Request("https://edge.fixture.invalid/nov-hub-api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: intended,
  }));
  const malformedResponse = await handler!(new Request("https://edge.fixture.invalid/nov-hub-api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: malformed,
  }));
  assertEquals(validResponse.status, profile === "v121" ? 400 : 401);
  assertEquals(malformedResponse.status, 404);
  assertEquals(matrix.observedProbe.transmittedBodyClass, "malformed_json_after_native_shell_quoting");
});

Deno.test("negative routing logs contain no request body, credential, or token", () => {
  const joined = logs.join("\n");
  assertMatch(joined, /TOKEN_VERIFICATION_FAILED|IAP_ASSERTION_/u);
  assert(!joined.includes("invalid-test-hub-session"));
  assert(!joined.includes(state));
  assert(!joined.includes(handoffCode));
  assert(!/service_role|private key|db_password|github_token/iu.test(joined));
});

Deno.test({
  name: "restore global test hooks",
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  },
});
