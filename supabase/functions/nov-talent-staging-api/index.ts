import { cleanActivity, cleanCandidate, cleanRecruitmentMaster, cleanSourceFactLink, resolveAccess, STATUS_LABELS } from "./domain.ts";

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
    const roles = (Array.isArray(env.employee.roleKeys) ? env.employee.roleKeys : [])
      .map((value: unknown) => String(value || "").trim().toLowerCase());
    const role = roles.find((value: string) => ["super_admin", "backoffice", "hr.admin", "hr.staff", "executive"].includes(value));
    if (!role) return { category: "FORBIDDEN" } as const;
    return { profile, actor, role } as const;
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
  const result = await db(runtime, "/rest/v1/nov_talent_candidates_v1?select=candidate_id,graduation_year,student_name,student_name_kana,school_id,fair_id,school_name,faculty_name,phone,email,line_identifier,current_status_code,acquisition_source,assigned_to,notes,source_type,source_row_no,version,is_active&is_active=eq.true&order=graduation_year.asc,updated_at.desc&limit=1000");
  return result.ok ? await result.json() : null;
}
async function readDashboardFacts(runtime: Runtime) {
  const [eventsResult, selectionsResult, actionsResult, fairsResult, sourceFactsResult, schoolMastersResult, fairMastersResult] = await Promise.all([
    db(runtime, "/rest/v1/nov_talent_recruitment_events_v1?select=event_id,candidate_id,event_code,event_date,event_name,event_state,contact_content,assigned_to,notes,version,is_active&order=event_date.desc&limit=5000"),
    db(runtime, "/rest/v1/nov_talent_selection_history_v1?select=selection_history_id,candidate_id,selection_code,effective_date,assigned_to,notes,version,is_active&order=effective_date.desc&limit=5000"),
    db(runtime, "/rest/v1/nov_talent_next_actions_v1?select=next_action_id,candidate_id,action_code,due_date,action_text,assigned_to,notes,state,completed_at,version,is_active&order=due_date.asc.nullslast&limit=1000"),
    db(runtime, "/rest/v1/nov_talent_fair_metrics_v1?select=graduation_year,event_date,contact_count,line_registration_count,salon_tour_count&order=event_date.desc&limit=1000"),
    db(runtime, "/rest/v1/nov_talent_recruitment_source_facts_v1?select=source_type,source_row_no,fact_code,fact_date,candidate_id,version&order=source_type.asc,source_row_no.asc&limit=5000"),
    db(runtime, "/rest/v1/nov_talent_school_masters_v1?select=school_id,school_name,faculty_name,assigned_to,version,is_active&order=school_name.asc&limit=1000"),
    db(runtime, "/rest/v1/nov_talent_fair_masters_v1?select=fair_id,fair_name,event_date,participation_fee,venue,assigned_to,participant_count,contact_count,line_registration_count,salon_tour_count,interview_count,offer_count,hire_count,version,is_active&order=event_date.desc&limit=1000")
  ]);
  if (![eventsResult, selectionsResult, actionsResult, fairsResult, sourceFactsResult, schoolMastersResult, fairMastersResult].every((result) => result.ok)) return null;
  return {
    events: await eventsResult.json(), selections: await selectionsResult.json(),
    actions: await actionsResult.json(), fairs: await fairsResult.json(),
    sourceFacts: await sourceFactsResult.json(), schoolMasters: await schoolMastersResult.json(), fairMasters: await fairMastersResult.json()
  };
}

function groupByCandidate(rows: any[]) {
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const key = String(row.candidate_id || "");
    if (!key) continue;
    const values = grouped.get(key) || [];
    values.push(row);
    grouped.set(key, values);
  }
  return grouped;
}

function dashboardMetrics(rows: any[], facts: any) {
  const today = new Date().toISOString().slice(0, 10);
  const activeEvents = facts.events.filter((row: any) => row.is_active !== false);
  const activeSelections = facts.selections.filter((row: any) => row.is_active !== false);
  const activeActions = facts.actions.filter((row: any) => row.is_active !== false);
  const distinct = (source: any[], codeKey: string, code: string) => new Set(source
    .filter((row) => row[codeKey] === code).map((row) => row.candidate_id)).size;
  const sourceFactCount = (code: string) => facts.sourceFacts.filter((row: any) => row.fact_code === code).length;
  const hasSourceFact = (code: string) => facts.sourceFacts.some((row: any) => row.fact_code === code);
  const hasEvent = (code: string) => activeEvents.some((row: any) => row.event_code === code);
  const candidateStatusCount = (code: string) => rows.filter((row) => row.current_status_code === code).length;
  const linkedCount = (code: string) => distinct(activeSelections, "selection_code", code);
  const sourceOrLinked = (code: string) => Math.max(sourceFactCount(code), linkedCount(code), candidateStatusCount(code));
  const plannedEventCount = (code: string) => distinct(activeEvents, "event_code", code)
    + sourceFactCount(code);
  const interviewHistory = sourceFactCount("INTERVIEW_COMPLETED") + linkedCount("INTERVIEW_COMPLETED");
  const openActions = activeActions.filter((row: any) => row.state === "OPEN");
  const dueActions = openActions.filter((row: any) => row.due_date && String(row.due_date) <= today);
  const undatedActions = openActions.filter((row: any) => !row.due_date);
  return {
    candidateCount: rows.length,
    graduation2027: rows.filter((row) => Number(row.graduation_year) === 2027).length,
    graduation2028: rows.filter((row) => Number(row.graduation_year) === 2028).length,
    lineRegistrations: Math.max(distinct(activeEvents, "event_code", "LINE_REGISTERED"), candidateStatusCount("LINE_REGISTERED")),
    salonTourCompleted: Math.max(distinct(activeEvents, "event_code", "SALON_TOUR_COMPLETED"), sourceOrLinked("SALON_TOUR_COMPLETED")),
    interviewHistory,
    entries: sourceFactCount("APPLICATION_RECEIVED") || linkedCount("APPLICATION_RECEIVED"),
    salonTourPlanned: plannedEventCount("SALON_TOUR_PLANNED"),
    interviewPlanned: activeEvents.filter((row:any) => row.event_code === "INTERVIEW_PLANNED" && row.event_date >= today).length
      + activeSelections.filter((row:any) => row.selection_code === "INTERVIEW_PLANNED" && row.effective_date >= today).length
      + facts.sourceFacts.filter((row:any) => row.fact_code === "INTERVIEW_PLANNED" && row.fact_date >= today).length,
    offers: sourceOrLinked("OFFERED"),
    offeredElsewhere: sourceOrLinked("OFFERED_ELSEWHERE"),
    withdrawals: sourceOrLinked("WITHDRAWN"),
    rejected: sourceOrLinked("REJECTED"),
    schoolCount: facts.schoolMasters.filter((row:any) => row.is_active !== false).length,
    fairCount: facts.fairMasters.filter((row:any) => row.is_active !== false).length,
    todayActions: dueActions.length,
    undatedActions: undatedActions.length,
    eventCount: activeEvents.length,
    selectionHistoryCount: activeSelections.length + facts.sourceFacts.length,
    unlinkedInterviewHistoryCount: facts.sourceFacts.filter((row:any) => row.fact_code === "INTERVIEW_COMPLETED" && !row.candidate_id).length,
    availability: {
      candidateCount: true, graduation2027: true, graduation2028: true, lineRegistrations: true,
      salonTourCompleted: true, interviewHistory: hasSourceFact("INTERVIEW_COMPLETED") || hasEvent("INTERVIEW_COMPLETED"),
      entries: hasSourceFact("APPLICATION_RECEIVED"),
      salonTourPlanned: hasEvent("SALON_TOUR_PLANNED"),
      interviewPlanned: hasSourceFact("INTERVIEW_COMPLETED") || hasEvent("INTERVIEW_COMPLETED") || hasEvent("INTERVIEW_PLANNED"),
      offers: hasSourceFact("OFFERED"), offeredElsewhere: true, withdrawals: hasSourceFact("WITHDRAWN"), rejected: hasSourceFact("REJECTED"),
      schoolCount: true, fairCount: true, eventCount: true,
      todayActions: activeActions.length > 0
    }
  };
}

function workspace(rows: any[], profile: string, facts: any) {
  const privateFields = profile !== "executive";
  const eventsByCandidate = groupByCandidate(facts.events);
  const selectionsByCandidate = groupByCandidate(facts.selections);
  const actionsByCandidate = groupByCandidate(facts.actions);
  const students = rows.map((r) => {
    const events = eventsByCandidate.get(r.candidate_id) || [];
    const selections = selectionsByCandidate.get(r.candidate_id) || [];
    const actions = actionsByCandidate.get(r.candidate_id) || [];
    const nextAction = actions.find((item) => item.is_active !== false && item.state === "OPEN") || null;
    return ({
    applicationNo: null, businessDate: null, classification: "IMPORTABLE", classificationLabel: r.is_active ? "有効" : "無効",
    displayName: r.student_name || "氏名未登録", email: privateFields ? r.email : null, kana: r.student_name_kana,
    lineRegistrationDate: null, legacyNoPresent: Boolean(r.source_row_no), mappingStatus: "OWNER_CONFIRMED",
    nextActionAt: nextAction?.due_date || null, nextActionLabel: nextAction ? actionLabel(nextAction.action_code) : null,
    offerDate: selections.find((item) => item.selection_code === "OFFERED")?.effective_date || null,
    expectedJoinDate: null, plannedStore: null, phone: privateFields ? r.phone : null,
    preferredStore: null, primaryEligible: true, profileVersion: r.version, supplementVersion: null, reasonLabels: [],
    recordId: r.candidate_id, schoolId: r.school_id, fairId: r.fair_id, school: r.school_name, faculty: r.faculty_name, lineIdentifier: privateFields ? r.line_identifier : null,
    acquisitionSource: r.acquisition_source, assignee: r.assigned_to, notes: privateFields ? r.notes : null,
    graduationYear: r.graduation_year, sourceCode: r.source_type || "NOV_TALENT_UI", sourceLabel: r.graduation_year === 2027 ? "27卒" : r.graduation_year === 2028 ? "28卒" : `${r.graduation_year}年卒`,
    sourceKeyStatus: "OWNER_CONFIRMED", status: STATUS_LABELS[r.current_status_code] || "状態未設定", statusCode: r.current_status_code,
    suggestedTargetRecordId: null, suggestionCategory: "NONE",
    selectionHistory: selections.map((item) => ({ id: item.selection_history_id, version: item.version, date: item.effective_date, code: item.selection_code,
      label: STATUS_LABELS[item.selection_code] || item.selection_code, assignedTo: item.assigned_to, notes: privateFields ? item.notes : null, active: item.is_active })),
    contactHistory: events.filter((item) => ["CONTACT_RECORDED", "LINE_REGISTERED"].includes(item.event_code))
      .map((item) => ({ id: item.event_id, version: item.version, date: item.event_date, code: item.event_code,
        label: item.event_name || eventLabel(item.event_code), state: item.event_state,
        content: privateFields ? item.contact_content : null, assignedTo: item.assigned_to, notes: privateFields ? item.notes : null, active: item.is_active })),
    eventHistory: events.filter((item) => !["CONTACT_RECORDED", "LINE_REGISTERED"].includes(item.event_code))
      .map((item) => ({ id: item.event_id, version: item.version, date: item.event_date, code: item.event_code,
        label: item.event_name || STATUS_LABELS[item.event_code] || item.event_code, state: item.event_state,
        content: privateFields ? item.contact_content : null, assignedTo: item.assigned_to, notes: privateFields ? item.notes : null, active: item.is_active })),
    nextActions: actions.map((item) => ({ id: item.next_action_id, version: item.version, date: item.due_date, code: item.action_code,
      label: item.action_text || actionLabel(item.action_code), state: item.state, assignedTo: item.assigned_to,
      notes: privateFields ? item.notes : null, completedAt: item.completed_at, active: item.is_active }))
  });
  });
  const dashboard = dashboardMetrics(rows, facts);
  const unlinkedSelectionHistory = facts.sourceFacts.filter((item:any) => item.fact_code === "INTERVIEW_COMPLETED" && !item.candidate_id)
    .map((item:any) => ({ sourceType: item.source_type, sourceRowNo: item.source_row_no, code: item.fact_code,
      label: STATUS_LABELS[item.fact_code] || item.fact_code, date: item.fact_date, version: item.version }));
  return { fiscalYear: "all", payloadMode: "workspace", accessProfile: profile, canWrite: profile !== "executive", dashboard,
    todayTasks: facts.actions.filter((item:any) => item.is_active !== false && item.state === "OPEN" && item.due_date && item.due_date <= new Date().toISOString().slice(0,10))
      .slice(0,5).map((item:any) => ({ candidateId: item.candidate_id, dueDate: item.due_date,
        label: item.action_text || actionLabel(item.action_code), assignedTo: item.assigned_to })),
    unlinkedSelectionHistory, schoolMasters: facts.schoolMasters, fairMasters: facts.fairMasters,
    overview: { contacts: students.length, entries: dashboard.entries, exactLinkSuggestions: 0, mapped: students.length, manual: 0, offers: dashboard.offers, ownerReview: unlinkedSelectionHistory.length, primaryCandidates: students.length, quarantined: 0, remainingManual: unlinkedSelectionHistory.length, total: students.length }, students };
}
function actionLabel(code: string) {
  return ({ FOLLOW_UP: "次回対応を確認", SALON_TOUR_FOLLOW_UP: "見学対応を確認", INTERVIEW_FOLLOW_UP: "面接対応を確認", OFFER_FOLLOW_UP: "内定フォローを確認" } as Record<string, string>)[code] || "次回対応を確認";
}
function eventLabel(code: string) {
  return ({ CONTACT_RECORDED: "接触記録", LINE_REGISTERED: "LINE登録",
    SALON_TOUR_PLANNED: "サロン見学［予定］", SALON_TOUR_COMPLETED: "サロン見学［済］",
    INTERVIEW_PLANNED: "面接［予定］", INTERVIEW_COMPLETED: "面接［済］" } as Record<string,string>)[code] || "採用イベント";
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
    const facts = await readDashboardFacts(runtime);
    if (!facts) return fail(503, "DASHBOARD_FACT_STORE_NOT_READY", origin);
    if (request.method === "GET" && path.endsWith("/api/talent/v1/dashboard/summary")) {
      const dashboard = dashboardMetrics(rows, facts);
      const summary = { contacts: rows.length,
        lineRegistrations: new Set(facts.events.filter((r:any) => r.is_active !== false && r.event_code === "LINE_REGISTERED").map((r:any) => r.candidate_id)).size,
        salonTours: new Set(facts.events.filter((r:any) => r.is_active !== false && r.event_code === "SALON_TOUR_COMPLETED").map((r:any) => r.candidate_id)).size,
        interviews: new Set(facts.events.filter((r:any) => r.is_active !== false && r.event_code === "INTERVIEW_COMPLETED").map((r:any) => r.candidate_id)).size,
        passed: new Set(facts.selections.filter((r:any) => r.is_active !== false && r.selection_code === "OFFER_ACCEPTED").map((r:any) => r.candidate_id)).size,
        offers: dashboard.offers,
        expectedJoiners: rows.filter((r:any) => r.current_status_code === "EXPECTED_JOIN").length };
      return out(200, { ok: true, data: { config: { appName: "NOV Talent" }, fiscalYear: "current", payloadMode: "summary", summary }, meta: { generatedAt: new Date().toISOString(), requestId: crypto.randomUUID(), source: "nov-talent-staging-api", version: "1" } }, origin);
    }
    if (request.method === "GET" && path.endsWith("/api/talent/v1/workspace")) return out(200, { ok: true, data: workspace(rows, actor.profile, facts), meta: { generatedAt: new Date().toISOString(), requestId: crypto.randomUUID(), source: "nov-talent-staging-api", version: "2" } }, origin);
    const auditMatch = /^\/api\/talent\/v1\/candidates\/([0-9a-f-]+)\/audit$/iu.exec(path);
    if (request.method === "GET" && auditMatch && UUID.test(auditMatch[1])) {
      const [candidateAudit, activityAudit] = await Promise.all([
        db(runtime, `/rest/v1/nov_talent_candidate_audit_log_v1?select=action,changed_fields,candidate_version,occurred_at&candidate_id=eq.${auditMatch[1]}&order=occurred_at.desc&limit=100`),
        db(runtime, `/rest/v1/nov_talent_recruitment_activity_audit_v1?select=entity_type,action,changed_fields,entity_version,occurred_at&candidate_id=eq.${auditMatch[1]}&order=occurred_at.desc&limit=100`)
      ]);
      return candidateAudit.ok && activityAudit.ok ? out(200, { ok: true, data: {
        entries: await candidateAudit.json(), activityEntries: await activityAudit.json()
      } }, origin) : fail(503, "AUDIT_UNAVAILABLE", origin);
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
    if (request.method === "POST" && path.endsWith("/api/talent/v1/activities")) {
      const activity = cleanActivity(body);
      if (!activity || !UUID.test(activity.candidateId) || (activity.entityId && !UUID.test(activity.entityId))) return fail(400, "INVALID_REQUEST", origin);
      const result = await rpc(runtime, "nov_talent_mutate_recruiting_activity_v1", {
        p_actor_employee_id: actor.actor, p_actor_role: actor.role, p_reason: activity.reason,
        p_operation: activity.operation, p_entity_type: activity.entityType,
        p_entity_id: activity.entityId, p_candidate_id: activity.candidateId,
        p_expected_version: activity.expectedVersion,
        p_payload: { code: activity.code, date: activity.date, name: activity.name, state: activity.state,
          content: activity.content, assignedTo: activity.assignedTo, notes: activity.notes }
      });
      return result.ok ? out(activity.operation === "CREATE" ? 201 : 200, { ok: true, data: result.data }, origin)
        : fail(result.status || 400, result.status === 409 ? "VERSION_CONFLICT" : "WRITE_FAILED", origin);
    }
    if (request.method === "POST" && path.endsWith("/api/talent/v1/masters")) {
      const master = cleanRecruitmentMaster(body);
      if (!master || (master.entityId && !UUID.test(master.entityId))) return fail(400, "INVALID_REQUEST", origin);
      const result = await rpc(runtime, "nov_talent_mutate_recruitment_master_v1", {
        p_actor_employee_id: actor.actor, p_actor_role: actor.role, p_reason: master.reason,
        p_entity_type: master.entityType, p_operation: master.operation, p_entity_id: master.entityId,
        p_expected_version: master.expectedVersion, p_payload: master.payload
      });
      return result.ok ? out(master.operation === "CREATE" ? 201 : 200, { ok: true, data: result.data }, origin)
        : fail(result.status || 400, result.status === 409 ? "VERSION_CONFLICT" : "WRITE_FAILED", origin);
    }
    const masterLink = /^\/api\/talent\/v1\/candidates\/([0-9a-f-]+)\/master-links$/iu.exec(path);
    if (request.method === "POST" && masterLink && UUID.test(masterLink[1])) {
      const schoolId = body?.schoolId ? String(body.schoolId) : null;
      const fairId = body?.fairId ? String(body.fairId) : null;
      const expectedVersion = Number(body?.expectedVersion); const reason = String(body?.reason || "").trim();
      if ((schoolId && !UUID.test(schoolId)) || (fairId && !UUID.test(fairId)) || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !reason) return fail(400,"INVALID_REQUEST",origin);
      const result = await rpc(runtime,"nov_talent_set_candidate_master_links_v1",{ p_actor_employee_id:actor.actor,p_actor_role:actor.role,p_reason:reason.slice(0,500),p_candidate_id:masterLink[1],p_expected_version:expectedVersion,p_school_id:schoolId,p_fair_id:fairId });
      return result.ok ? out(200,{ok:true,data:result.data},origin) : fail(result.status||400,result.status===409?"VERSION_CONFLICT":"WRITE_FAILED",origin);
    }
    if (request.method === "POST" && path.endsWith("/api/talent/v1/unlinked-selection/link")) {
      const link = cleanSourceFactLink(body);
      if (!link || !UUID.test(link.candidateId)) return fail(400, "INVALID_REQUEST", origin);
      const result = await rpc(runtime, "nov_talent_link_source_fact_v1", {
        p_actor_employee_id: actor.actor, p_actor_role: actor.role, p_reason: link.reason,
        p_source_type: link.sourceType, p_source_row_no: link.sourceRowNo, p_fact_code: link.factCode,
        p_candidate_id: link.candidateId, p_expected_version: link.expectedVersion
      });
      return result.ok ? out(200, { ok: true, data: result.data }, origin)
        : fail(result.status || 400, result.status === 409 ? "VERSION_CONFLICT" : "WRITE_FAILED", origin);
    }
    const edit = /^\/api\/talent\/v1\/candidates\/([0-9a-f-]+)$/iu.exec(path);
    if (request.method === "PATCH" && edit && UUID.test(edit[1])) {
      const c = cleanCandidate(body); if (!c || c.expectedVersion === null) return fail(400, "INVALID_REQUEST", origin);
      const result = await rpc(runtime, "nov_talent_update_candidate_v1", { ...rpcPayload(actor, c), p_candidate_id: edit[1], p_expected_version: c.expectedVersion });
      return result.ok ? out(200, { ok: true, data: result.data }, origin) : fail(result.status || 400, result.status === 409 ? "VERSION_CONFLICT" : "WRITE_FAILED", origin);
    }
    const active = /^\/api\/talent\/v1\/candidates\/([0-9a-f-]+)\/active$/iu.exec(path);
    if (request.method === "POST" && active && UUID.test(active[1]) && typeof body?.active === "boolean" && Number.isInteger(Number(body?.expectedVersion)) && String(body?.reason || "").trim()) {
      const result = await rpc(runtime, "nov_talent_set_candidate_active_v1", { p_actor_employee_id: actor.actor, p_actor_role: actor.role, p_reason: String(body.reason).slice(0,500), p_candidate_id: active[1], p_expected_version: Number(body.expectedVersion), p_active: body.active });
      return result.ok ? out(200, { ok: true, data: result.data }, origin) : fail(result.status || 400, result.status === 409 ? "VERSION_CONFLICT" : "WRITE_FAILED", origin);
    }
    return fail(404, "NOT_FOUND", origin);
  };
}

if (typeof Deno !== "undefined" && import.meta.main) Deno.serve(createHandler({ hubApiUrl: Deno.env.get("NOV_HUB_READONLY_AUTH_URL") || "", supabaseUrl: Deno.env.get("SUPABASE_URL") || "", serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", fetchImpl: fetch }));
