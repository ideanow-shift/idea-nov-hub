import { assertEquals } from "jsr:@std/assert@1.0.14";

type EdgeHandler = (request: Request) => Response | Promise<Response>;
type JsonRecord = Record<string, unknown>;

const EMPLOYEE_ID = "10000000-0000-4000-8000-000000000001";
const SESSION_ID = "10000000-0000-4000-8000-000000000002";
const COMPANY_DIRECT = "e4059116-bdb3-4e13-9763-bbc77bdfe062";
const COMPANY_FC = "20000000-0000-4000-8000-000000000002";
const SIGNING_SECRET = "local-fixture-signing-secret-32-bytes-minimum";
const SERVICE_KEY = "local-fixture-service-role-key";
const FACT_SHA = "a".repeat(64);

function store(index: number, storeType: "本部" | "直営" | "FC"): JsonRecord {
  return {
    id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    store_no: String(index).padStart(4, "0"),
    store_id: storeType === "本部" ? "honbu" : `store-${String(index).padStart(2, "0")}`,
    store_name: storeType === "本部" ? "本部" : `架空店舗${index}`,
    corporation_id: storeType === "FC" ? COMPANY_FC : COMPANY_DIRECT,
    store_type: storeType,
    is_active: true,
  };
}

const STORES = [
  store(0, "本部"),
  ...Array.from({ length: 13 }, (_, index) => store(index + 1, "直営")),
  ...Array.from({ length: 7 }, (_, index) => store(index + 14, "FC")),
];

const CORPORATIONS = [
  { id: COMPANY_DIRECT, corporation_name: "架空直営法人", is_active: true },
  { id: COMPANY_FC, corporation_name: "架空FC法人", is_active: true },
];

const PROFILES = [
  { corporation_id: COMPANY_DIRECT, fiscal_year_end_month: 3 },
  { corporation_id: COMPANY_FC, fiscal_year_end_month: 3 },
];

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function encodeJson(value: JsonRecord): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function signSession(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "HS256", typ: "NOV-HUB-APP-SESSION", v: 1 });
  const payload = encodeJson({
    v: 1,
    sub: EMPLOYEE_ID,
    sid: SESSION_ID,
    aud: "store_operations_staging_session_v1",
    iat: now - 1,
    exp: now + 600,
  });
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)));
  return `${input}.${base64Url(signature)}`;
}

function months(start: string, end: string): string[] {
  const result: string[] = [];
  for (let current = start; current <= end;) {
    result.push(current);
    const value = new Date(`${current}T00:00:00Z`);
    value.setUTCMonth(value.getUTCMonth() + 1);
    current = value.toISOString().slice(0, 10);
  }
  return result;
}

Deno.test("exact Edge HTTP entrypoint resolves effective operator with local synthetic services", async () => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  let handler: EdgeHandler | undefined;
  const calls: Array<{ name: string; method: string }> = [];

  Deno.env.set("SUPABASE_URL", "https://fixture.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
  Deno.env.set("PIN_HASH_PEPPER", "local-fixture-pin-pepper-32-bytes-minimum");
  Deno.env.set("FIREBASE_API_KEY", "local-fixture-firebase-key");
  Deno.env.set("HUB_APP_SESSION_SIGNING_SECRET", SIGNING_SECRET);

  (Deno as unknown as { serve: (candidate: EdgeHandler) => unknown }).serve = (candidate) => {
    handler = candidate;
    return { finished: Promise.resolve() };
  };

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const authorization = request.headers.get("authorization");
    const apiKey = request.headers.get("apikey");
    if (url.origin !== "https://fixture.supabase.co" || method !== "POST"
      || authorization !== `Bearer ${SERVICE_KEY}` || apiKey !== SERVICE_KEY
      || !url.pathname.startsWith("/rest/v1/rpc/")) {
      throw new Error("Unexpected outbound request from Edge fixture");
    }
    const name = decodeURIComponent(url.pathname.slice("/rest/v1/rpc/".length));
    const body = JSON.parse(await request.text() || "{}") as JsonRecord;
    calls.push({ name, method });

    if (name === "store_operations_uat_resolve_hub_employee_access_v1") {
      return Response.json([{
        employeeId: EMPLOYEE_ID,
        roleKeys: ["executive"],
        scope: { mode: "all", storeIds: [] },
      }]);
    }
    if (name === "store_operations_uat_master_read_v1") {
      return Response.json([{ stores: STORES, corporations: CORPORATIONS, corporation_business_profiles: PROFILES }]);
    }
    if (name === "store_corporation_effective_operator_range_read_v1") {
      const storeIds = body.p_store_ids as string[];
      const rows = months(String(body.p_start_month), String(body.p_end_month)).flatMap((fiscalMonth) =>
        STORES.filter((row) => row.store_type !== "本部" && storeIds.includes(String(row.id))).map((row) => ({
          fiscal_month: fiscalMonth,
          store_id: row.id,
          corporation_id: row.corporation_id,
          corporation_no: row.corporation_id === COMPANY_DIRECT ? "0001" : "0002",
        }))
      );
      return Response.json(rows);
    }
    if (name === "dbf_store_monthly_actual_range_read_v1") {
      if (body.p_company_id !== COMPANY_DIRECT) return Response.json([]);
      return Response.json([{
        fiscal_month: "2026-07-01",
        company_id: COMPANY_DIRECT,
        store_id: STORES[1].id,
        metric_code: "TOTAL_SALES",
        value_kind: "amount",
        metric_value: "1234567.00",
        definition_version: "v1",
        display_name: "総売上",
        description: "Synthetic monthly gross sales.",
        source_type: "store_operating_result",
        source_file_sha256: FACT_SHA,
        imported_at: "2026-09-13T00:00:00Z",
        fact_version: 1,
      }]);
    }
    if (name === "dbf_store_monthly_budget_range_read_v1") return Response.json([]);
    throw new Error(`Unexpected RPC ${name}`);
  }) as typeof fetch;

  try {
    const entrypoint = new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url);
    entrypoint.searchParams.set("local-http-e2e", String(Date.now()));
    await import(entrypoint.href);
    assertEquals(typeof handler, "function");

    const response = await handler!(new Request("https://edge.fixture.invalid/nov-hub-api", {
      method: "POST",
      headers: {
        authorization: `Bearer ${await signSession()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "storeMonthlyActualProjectionV1",
        payload: { selectedMonth: "2026-07", authType: "store_operations_staging_session" },
      }),
    }));
    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(body.ok, true);
    assertEquals(body.data.stores.length, 20);
    assertEquals(body.data.readiness.confirmedStoreCount, 1);
    assertEquals(body.data.readiness.missingStoreCount, 19);
    assertEquals(body.data.readiness.effectiveOperatorRowCount, 480);
    assertEquals(body.data.readiness.ownershipMismatchExcludedCount, 0);
    assertEquals(body.data.stores[0].operatorDataState, "confirmed");
    assertEquals(calls.length, 10);
    assertEquals(calls.every((call) => call.method === "POST"), true);
  } finally {
    globalThis.fetch = originalFetch;
    (Deno as unknown as { serve: typeof Deno.serve }).serve = originalServe;
  }
});
