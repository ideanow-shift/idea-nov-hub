import {
  buildCandidateSummary,
  buildCandidateWorkspace,
  resolveTalentAccessProfile,
  validateCandidateDatasetRows,
  type TalentAccessProfile,
} from "./domain.ts";

const ALLOWED_ORIGIN = "https://ideanow-shift.github.io";
const FUNCTION_PATH = "/nov-talent-staging-readonly-api";
const GATEWAY_PATH = `/functions/v1${FUNCTION_PATH}`;
const SUMMARY_ROUTE = "/api/talent/v1/dashboard/summary";
const WORKSPACE_ROUTE = "/api/talent/v1/workspace";
const MAX_BEARER_LENGTH = 4096;

type Runtime = {
  hubApiUrl: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchImpl: typeof fetch;
};

function headers(origin: string) {
  const value = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  });
  if (origin === ALLOWED_ORIGIN) {
    value.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    value.set("Access-Control-Allow-Headers", "authorization, content-type");
    value.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  }
  return value;
}

function response(status: number, body: unknown, origin: string) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

function safeFailure(status: number, safeCode: string, origin: string) {
  return response(status, { ok: false, message: "NOV Talentを表示できません。", requestId: crypto.randomUUID(), safeCode }, origin);
}

function readBearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  if (value.length > MAX_BEARER_LENGTH + 7) return null;
  return /^Bearer ([A-Za-z0-9._~-]+)$/u.exec(value)?.[1] || null;
}

function routeFor(pathname: string) {
  for (const route of [SUMMARY_ROUTE, WORKSPACE_ROUTE]) {
    if (pathname === route || pathname === `${FUNCTION_PATH}${route}` || pathname === `${GATEWAY_PATH}${route}`) return route;
  }
  return null;
}

function fiscalYearFor(url: URL) {
  const value = String(url.searchParams.get("fiscalYear") || "current");
  return /^(current|2027|2028)$/u.test(value) ? value : null;
}

async function authorize(runtime: Runtime, bearer: string): Promise<TalentAccessProfile | null> {
  try {
    const result = await runtime.fetchImpl(runtime.hubApiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "bootstrap", token: bearer, payload: { authType: "hub_session" } }),
    });
    if (!result.ok) return null;
    const envelope = await result.json();
    return envelope?.ok === true ? resolveTalentAccessProfile(envelope?.employee?.roleKeys) : null;
  } catch {
    return null;
  }
}

async function readActiveRows(runtime: Runtime) {
  const authHeaders = {
    apikey: runtime.serviceRoleKey,
    authorization: `Bearer ${runtime.serviceRoleKey}`,
    accept: "application/json",
  };
  const datasetUrl = new URL("/rest/v1/nov_talent_candidate_datasets_v1", runtime.supabaseUrl);
  datasetUrl.searchParams.set("select", "dataset_id,actual_candidate_count,actual_2027_count,actual_2028_count");
  datasetUrl.searchParams.set("state", "eq.ACTIVE");
  datasetUrl.searchParams.set("limit", "2");
  const datasetResponse = await runtime.fetchImpl(datasetUrl, { method: "GET", headers: authHeaders });
  if (!datasetResponse.ok) return null;
  const datasets = await datasetResponse.json();
  if (!Array.isArray(datasets) || datasets.length !== 1) return null;
  const dataset = datasets[0];
  const expectedTotal = Number(dataset.actual_candidate_count);
  const expected2027 = Number(dataset.actual_2027_count);
  const expected2028 = Number(dataset.actual_2028_count);
  if (![expectedTotal, expected2027, expected2028].every(Number.isInteger) || expectedTotal !== expected2027 + expected2028) return null;

  const recordsUrl = new URL("/rest/v1/nov_talent_candidate_dataset_records_v1", runtime.supabaseUrl);
  recordsUrl.searchParams.set("select", "candidate_id,graduation_year,source_type,source_row_no,student_name,student_name_kana,school_name,faculty_name,phone,email,line_identifier");
  recordsUrl.searchParams.set("dataset_id", `eq.${dataset.dataset_id}`);
  recordsUrl.searchParams.set("order", "graduation_year.asc,source_row_no.asc");
  recordsUrl.searchParams.set("limit", "1000");
  const recordsResponse = await runtime.fetchImpl(recordsUrl, { method: "GET", headers: authHeaders });
  if (!recordsResponse.ok) return null;
  const rows = validateCandidateDatasetRows(await recordsResponse.json());
  if (!rows || rows.length !== expectedTotal
    || rows.filter((row) => row.graduation_year === 2027).length !== expected2027
    || rows.filter((row) => row.graduation_year === 2028).length !== expected2028) return null;
  return rows;
}

export function createHandler(runtime: Runtime) {
  return async (request: Request) => {
    const origin = request.headers.get("origin") || "";
    if (origin !== ALLOWED_ORIGIN) return safeFailure(403, "ORIGIN_NOT_ALLOWED", origin);
    const route = routeFor(new URL(request.url).pathname);
    if (!route) return safeFailure(404, "NOT_FOUND", origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
    if (request.method !== "GET") return safeFailure(405, "METHOD_NOT_ALLOWED", origin);
    const fiscalYear = fiscalYearFor(new URL(request.url));
    if (!fiscalYear) return safeFailure(400, "INVALID_REQUEST", origin);
    const bearer = readBearer(request);
    if (!bearer) return safeFailure(401, "AUTH_REQUIRED", origin);
    const accessProfile = await authorize(runtime, bearer);
    if (!accessProfile) return safeFailure(403, "FORBIDDEN", origin);
    const rows = await readActiveRows(runtime).catch(() => null);
    if (!rows) return safeFailure(503, "ACTIVE_DATASET_NOT_READY", origin);
    const requestId = crypto.randomUUID();
    if (route === SUMMARY_ROUTE) {
      return response(200, {
        ok: true,
        data: { config: { appName: "NOV Talent" }, fiscalYear, payloadMode: "summary", summary: buildCandidateSummary(rows, fiscalYear) },
        meta: { generatedAt: new Date().toISOString(), requestId, source: "nov-talent-staging-readonly-api", version: "1" },
      }, origin);
    }
    return response(200, {
      ok: true,
      data: buildCandidateWorkspace(rows, accessProfile, fiscalYear),
      meta: { generatedAt: new Date().toISOString(), requestId, source: "nov-talent-staging-readonly-api", version: "1" },
    }, origin);
  };
}

if (typeof Deno !== "undefined" && import.meta.main) {
  Deno.serve(createHandler({
    hubApiUrl: Deno.env.get("NOV_HUB_READONLY_AUTH_URL") || "",
    supabaseUrl: Deno.env.get("SUPABASE_URL") || "",
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    fetchImpl: fetch,
  }));
}
