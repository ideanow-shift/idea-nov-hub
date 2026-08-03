import { cleanCandidate, resolveAccess, STATUS_LABELS } from "./domain.ts";

const ORIGIN = "https://ideanow-shift.github.io";
const PREFIXES = ["", "/nov-talent-staging-api", "/functions/v1/nov-talent-staging-api"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
type Runtime = { hubApiUrl: string; supabaseUrl: string; serviceRoleKey: string; fetchImpl: typeof fetch };

function cors(origin: string) {
  const h = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", Vary: "Origin" });
  if (origin === ORIGIN) { h.set("Access-Control-Allow-Origin", ORIGIN); h.set("Access-Control-Allow-Headers", "authorization, content-type"); h.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS"); }
  return h;
}
function out(status: number, body: unknown, origin: string) { return new Response(JSON.stringify(body), { status, headers: cors(origin) }); }
function fail(status: number, safeCode: string, origin: string) { return out(status, { ok: false, message: "処理を完了できませんでした。", safeCode, requestId: crypto.randomUUID() }, origin); }
function pathOf(path: string) { for (const prefix of PREFIXES) if (prefix && path.startsWith(prefix)) return path.slice(prefix.length) || "/"; return path; }

async function authorize(runtime: Runtime, request: Request) {
  const raw = request.headers.get("authorization") || "";
  const token = /^Bearer ([A-Za-z0-9._~-]{1,4096})$/u.exec(raw)?.[1];
  if (!token) return { category: "AUTH_REQUIRED" } as const;
  try {
    const res = await runtime.fetchImpl(runtime.hubApiUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "bootstrap", token, payload: { authType: "hub_session" } }) });
    if (!res.ok) return { category: "AUTH_REQUIRED" } as const;
    const env = await res.json();
    const profile = env?.ok === true ? resolveAccess(env?.employee?.roleKeys) : null;
    const actor = String(env?.employee?.id || env?.employee?.employeeId || env?.employee?.coreEmployeeId || env?.employee?.supabaseEmployeeId || "");
    if (!profile) return { category: "FORBIDDEN" } as const;
    if (!UUID.test(actor)) return { category: "ACTOR_IDENTITY_UNAVAILABLE" } as const;
    return { profile, actor, role: Array.isArray(env.employee.roleKeys) ? String(env.employee.roleKeys[0] || profile) : profile } as const;
  } catch { return { category: "AUTH_REQUIRED" } as const; }
}

function serviceHeaders(runtime: Runtime) { return { apikey: runtime.serviceRoleKey, authorization: `Bearer ${runtime.serviceRoleKey}`, "content-type": "application/json", accept: "application/json" }; }
async function db(runtime: Runtime, path: string, init: RequestInit = {}) { return runtime.fetchImpl(new URL(path, runtime.supabaseUrl), { ...init, headers: { ...serviceHeaders(runtime), ...(init.headers || {}) } }); }
async function rpc(runtime: Runtime, name: string, body: unknown) {
  const result = await db(runtime, `/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
  if (!result.ok) return { ok: false, status: result.status === 409 ? 409 : 400 };
  const rows = await result.json();
  return { ok: true, data: Array.isArray(rows) ? rows[0] : rows };
}

async function readRows(runtime: Runtime) {
  const result = await db(runtime, "/rest/v1/nov_talent_candidates_v1?select=candidate_id,graduation_year,student_name,student_name_kana,school_name,faculty_name,phone,email,line_identifier,current_status_code,acquisition_source,assigned_to,notes,source_type,source_row_no,version,is_active&is_active=eq.true&order=graduation_year.asc,updated_at.desc&limit=1000");
  return result.ok ? await result.json() : null;
}
function workspace(rows: any[], profile: string) {
  const privateFields = profile !== "executive";
  const students = rows.map((r) => ({
    applicationNo: null, businessDate: null, classification: "IMPORTABLE", classificationLabel: r.is_active ? "有効" : "無効",
    displayName: r.student_name || "氏名未登録", email: privateFields ? r.email : null, kana: r.student_name_kana,
    lineRegistrationDate: null, legacyNoPresent: Boolean(r.source_row_no), mappingStatus: "OWNER_CONFIRMED",
    nextActionAt: null, offerDate: null, expectedJoinDate: null, plannedStore: null, phone: privateFields ? r.phone : null,
    preferredStore: null, primaryEligible: true, profileVersion: r.version, supplementVersion: null, reasonLabels: [],
    recordId: r.candidate_id, school: r.school_name, faculty: r.faculty_name, lineIdentifier: privateFields ? r.line_identifier : null,
    acquisitionSource: r.acquisition_source, assignee: r.assigned_to, notes: privateFields ? r.notes : null,
    graduationYear: r.graduation_year, sourceCode: r.source_type || "NOV_TALENT_UI", sourceLabel: r.graduation_year === 2027 ? "27卒" : r.graduation_year === 2028 ? "28卒" : `${r.graduation_year}年卒`,
    sourceKeyStatus: "OWNER_CONFIRMED", status: STATUS_LABELS[r.current_status_code] || "状態未設定", statusCode: r.current_status_code,
    suggestedTargetRecordId: null, suggestionCategory: "NONE"
  }));
  return { fiscalYear: "all", payloadMode: "workspace", overview: { contacts: students.length, entries: 0, exactLinkSuggestions: 0, mapped: students.length, manual: 0, offers: students.filter((s) => s.statusCode === "OFFERED").length, ownerReview: 0, primaryCandidates: students.length, quarantined: 0, remainingManual: 0, total: students.length }, students };
}
function rpcPayload(actor: any, c: any) { return { p_actor_employee_id: actor.actor, p_actor_role: actor.role, p_reason: c.reason, p_graduation_year: c.graduationYear, p_student_name: c.studentName, p_student_name_kana: c.studentNameKana, p_school_name: c.schoolName, p_faculty_name: c.facultyName, p_phone: c.phone, p_email: c.email, p_line_identifier: c.lineIdentifier, p_current_status_code: c.currentStatus, p_acquisition_source: c.acquisitionSource, p_assigned_to: c.assignedTo, p_notes: c.notes }; }

function duplicateSummary(rows: any[], candidate: any, excludedCandidateId: string | null) {
  const text = (value: unknown) => String(value || "").normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
  const digits = (value: unknown) => String(value || "").replace(/[^0-9+]/gu, "");
  const target = {
    phone: digits(candidate.phone), email: text(candidate.email), line: text(candidate.lineIdentifier),
    name: text(candidate.studentName), school: text(candidate.schoolName), year: Number(candidate.graduationYear)
  };
  const reasons = new Set<string>();
  let matchCount = 0;
  for (const row of rows) {
    if (row.candidate_id === excludedCandidateId) continue;
    const strong = (target.phone && target.phone === digits(row.phone))
      || (target.email && target.email === text(row.email))
      || (target.line && target.line === text(row.line_identifier));
    const supporting = target.name && target.school && target.year === Number(row.graduation_year)
      && target.name === text(row.student_name) && target.school === text(row.school_name);
    if (!strong && !supporting) continue;
    matchCount += 1;
    reasons.add(strong ? "STRONG_KEY_MATCH" : "NAME_SCHOOL_YEAR_MATCH");
  }
  return { matchCount, reasonCodes: [...reasons].sort(), automaticMerge: false };
}

export function createHandler(runtime: Runtime) {
  return async (request: Request) => {
    const origin = request.headers.get("origin") || "";
    if (origin !== ORIGIN) return fail(403, "ORIGIN_NOT_ALLOWED", origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const path = pathOf(new URL(request.url).pathname);
    const actor = await authorize(runtime, request);
    if ("category" in actor) {
      const category = String(actor.category || "FORBIDDEN");
      return fail(category === "AUTH_REQUIRED" ? 401 : 403, category, origin);
    }
    const rows = await readRows(runtime);
    if (!rows) return fail(503, "CANDIDATE_STORE_NOT_READY", origin);
    if (request.method === "GET" && path.endsWith("/api/talent/v1/dashboard/summary")) {
      const summary = { contacts: rows.length, lineRegistrations: rows.filter((r:any) => r.current_status_code === "LINE_REGISTERED").length, salonTours: rows.filter((r:any) => String(r.current_status_code).startsWith("SALON_TOUR")).length, interviews: rows.filter((r:any) => r.current_status_code === "AWAITING_INTERVIEW").length, passed: 0, offers: rows.filter((r:any) => r.current_status_code === "OFFERED").length, expectedJoiners: 0 };
      return out(200, { ok: true, data: { config: { appName: "NOV Talent" }, fiscalYear: "current", payloadMode: "summary", summary }, meta: { generatedAt: new Date().toISOString(), requestId: crypto.randomUUID(), source: "nov-talent-staging-api", version: "1" } }, origin);
    }
    if (request.method === "GET" && path.endsWith("/api/talent/v1/workspace")) return out(200, { ok: true, data: workspace(rows, actor.profile), meta: { generatedAt: new Date().toISOString(), requestId: crypto.randomUUID(), source: "nov-talent-staging-api", version: "1" } }, origin);
    const auditMatch = /^\/api\/talent\/v1\/candidates\/([0-9a-f-]+)\/audit$/iu.exec(path);
    if (request.method === "GET" && auditMatch && UUID.test(auditMatch[1])) {
      const result = await db(runtime, `/rest/v1/nov_talent_candidate_audit_log_v1?select=action,changed_fields,candidate_version,occurred_at&candidate_id=eq.${auditMatch[1]}&order=occurred_at.desc&limit=100`);
      return result.ok ? out(200, { ok: true, data: { entries: await result.json() } }, origin) : fail(503, "AUDIT_UNAVAILABLE", origin);
    }
    if (actor.profile === "executive") return fail(403, "WRITE_FORBIDDEN", origin);
    const body = await request.json().catch(() => null);
    if (request.method === "POST" && path.endsWith("/api/talent/v1/candidates/duplicate-check")) {
      const c = cleanCandidate(body);
      const candidateId = body?.candidateId ? String(body.candidateId) : null;
      if (!c || (candidateId && !UUID.test(candidateId))) return fail(400, "INVALID_REQUEST", origin);
      return out(200, { ok: true, data: duplicateSummary(rows, c, candidateId) }, origin);
    }
    if (request.method === "POST" && path.endsWith("/api/talent/v1/candidates")) {
      const c = cleanCandidate(body); if (!c || c.expectedVersion !== null) return fail(400, "INVALID_REQUEST", origin);
      const result = await rpc(runtime, "nov_talent_create_candidate_v1", rpcPayload(actor, c));
      return result.ok ? out(201, { ok: true, data: result.data }, origin) : fail(result.status || 400, "WRITE_FAILED", origin);
    }
    const edit = /^\/api\/talent\/v1\/candidates\/([0-9a-f-]+)$/iu.exec(path);
    if (request.method === "PATCH" && edit && UUID.test(edit[1])) {
      const c = cleanCandidate(body); if (!c || c.expectedVersion === null) return fail(400, "INVALID_REQUEST", origin);
      const result = await rpc(runtime, "nov_talent_update_candidate_v1", { ...rpcPayload(actor, c), p_candidate_id: edit[1], p_expected_version: c.expectedVersion });
      return result.ok ? out(200, { ok: true, data: result.data }, origin) : fail(result.status || 400, result.status === 409 ? "VERSION_CONFLICT" : "WRITE_FAILED", origin);
    }
    const active = /^\/api\/talent\/v1\/candidates\/([0-9a-f-]+)\/active$/iu.exec(path);
    if (request.method === "POST" && active && UUID.test(active[1]) && body?.active === false && Number.isInteger(Number(body?.expectedVersion)) && String(body?.reason || "").trim()) {
      const result = await rpc(runtime, "nov_talent_set_candidate_active_v1", { p_actor_employee_id: actor.actor, p_actor_role: actor.role, p_reason: String(body.reason).slice(0,500), p_candidate_id: active[1], p_expected_version: Number(body.expectedVersion), p_active: false });
      return result.ok ? out(200, { ok: true, data: result.data }, origin) : fail(result.status || 400, result.status === 409 ? "VERSION_CONFLICT" : "WRITE_FAILED", origin);
    }
    return fail(404, "NOT_FOUND", origin);
  };
}

if (typeof Deno !== "undefined" && import.meta.main) Deno.serve(createHandler({ hubApiUrl: Deno.env.get("NOV_HUB_READONLY_AUTH_URL") || "", supabaseUrl: Deno.env.get("SUPABASE_URL") || "", serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", fetchImpl: fetch }));
