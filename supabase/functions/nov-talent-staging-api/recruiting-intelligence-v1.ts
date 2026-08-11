export const RECRUITING_INTELLIGENCE_CONTRACT_VERSION = "1.1.0";
const DATA_KEYS = ["assigneeWorkload", "currentPosition", "fairResults", "funnel", "generatedAt", "graduationYears", "managementDiagnostics", "planningComparison", "priorities", "recruiting_intelligence_contract_version", "schoolProgress", "sourceAvailability", "sourceCoverageState", "targets"];

export function validateRecruitingIntelligenceResponseV1(value: any) {
  if (!value || value.ok !== true || !value.data || Object.keys(value).sort().join("|") !== "data|ok") return { ok: false as const, path: "response", rule: "exact_keys" };
  const data = value.data;
  if (Object.keys(data).sort().join("|") !== DATA_KEYS.join("|")) return { ok: false as const, path: "response.data", rule: "exact_keys" };
  if (data.recruiting_intelligence_contract_version !== RECRUITING_INTELLIGENCE_CONTRACT_VERSION) return { ok: false as const, path: "response.data.recruiting_intelligence_contract_version", rule: "const" };
  if (!["COMPLETE", "PREPARING"].includes(data.sourceCoverageState) || Number.isNaN(Date.parse(data.generatedAt))) return { ok: false as const, path: "response.data", rule: "format" };
  for (const key of ["currentPosition", "funnel", "graduationYears", "schoolProgress", "assigneeWorkload", "priorities", "fairResults", "managementDiagnostics"]) if (!["READY", "PREPARING"].includes(data[key]?.state)) return { ok: false as const, path: `response.data.${key}.state`, rule: "enum" };
  if (data.targets?.state !== "UNSET" || data.targets?.candidateTarget !== null || data.targets?.achievementRate !== null) return { ok: false as const, path: "response.data.targets", rule: "target_unset" };
  if (!["READY", "PREPARING"].includes(data.planningComparison?.state) || !Array.isArray(data.planningComparison?.rows)) return { ok: false as const, path: "response.data.planningComparison", rule: "shape" };
  if (data.planningComparison.state === "PREPARING" && data.planningComparison.rows.length !== 0) return { ok: false as const, path: "response.data.planningComparison.rows", rule: "preparing_empty" };
  for (const [index, row] of data.planningComparison.rows.entries()) {
    if (!row || Object.keys(row).sort().join("|") !== "approvedPlanningVersion|budget|graduationYear|metrics|period|recruitingTrack|scope") return { ok: false as const, path: `response.data.planningComparison.rows[${index}]`, rule: "exact_keys" };
    if (!["NEW_GRAD", "MID_CAREER"].includes(row.recruitingTrack) || row.scope !== "COMPANY" || !row.period || !/^\d{4}-\d{2}-\d{2}$/u.test(row.period.start) || !/^\d{4}-\d{2}-\d{2}$/u.test(row.period.end)) return { ok: false as const, path: `response.data.planningComparison.rows[${index}]`, rule: "identity" };
    if (Object.keys(row.metrics || {}).sort().join("|") !== "APPLICATION_COUNT|CONTACT_COUNT|OFFERED_COUNT|OFFER_ACCEPTED_COUNT|SALON_VISIT_COUNT") return { ok: false as const, path: `response.data.planningComparison.rows[${index}].metrics`, rule: "exact_keys" };
    for (const [metric, value] of Object.entries(row.metrics) as [string, any][]) if (!value || !["APPROVED", "NO_APPROVED_TARGET"].includes(value.targetStatus) || !["READY", "ACTUAL_SOURCE_UNAVAILABLE"].includes(value.actualSourceStatus) || (value.targetStatus === "NO_APPROVED_TARGET" && value.plan !== null) || (value.actualSourceStatus === "ACTUAL_SOURCE_UNAVAILABLE" && [value.actual, value.achievementRate, value.remaining].some((item) => item !== null))) return { ok: false as const, path: `response.data.planningComparison.rows[${index}].metrics.${metric}`, rule: "status_semantics" };
    if (!row.budget || !["APPROVED", "NO_APPROVED_TARGET"].includes(row.budget.targetStatus) || row.budget.actualSourceStatus !== "ACTUAL_SOURCE_UNAVAILABLE" || row.budget.actualSpend !== null || row.budget.remaining !== null) return { ok: false as const, path: `response.data.planningComparison.rows[${index}].budget`, rule: "status_semantics" };
  }
  return { ok: true as const, value };
}

export const OFFICIAL_SELECTION_CODES = ["APPLICATION_RECEIVED", "INTERVIEW_PLANNED", "INTERVIEW_COMPLETED", "OFFERED", "OFFER_ACCEPTED", "WITHDRAWN", "REJECTED"] as const;
const TERMINAL = new Set(["OFFER_ACCEPTED", "WITHDRAWN", "REJECTED"]);
const FOLLOW_UP_REQUIRED = new Set(["APPLICATION_RECEIVED", "INTERVIEW_PLANNED", "INTERVIEW_COMPLETED", "OFFERED"]);
const DAY = 86_400_000;

type Availability = Record<"candidates" | "selectionHistory" | "communications" | "nextActions" | "fairAttributions" | "schoolMasters" | "planningTargets" | "planningBudgets", boolean>;
type Input = { now: Date; candidates: any[]; selections: any[]; communications: any[]; actions: any[]; attributions: any[]; schoolMasters?: any[]; planningTargets?: any[]; planningBudgets?: any[]; availability: Availability };

const countBy = (rows: any[], key: string) => Object.fromEntries(rows.map((row) => String(row[key] || "UNREGISTERED")).filter(Boolean)
  .reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map<string, number>()));
const dateValue = (value: unknown) => { const time = Date.parse(String(value || "")); return Number.isFinite(time) ? time : null; };
const isoDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/u.test(String(value || "")) ? String(value) : null;
const PLAN_METRICS = ["CONTACT_COUNT", "SALON_VISIT_COUNT", "APPLICATION_COUNT", "OFFERED_COUNT", "OFFER_ACCEPTED_COUNT"] as const;
const SELECTION_SOURCE = Object.freeze({ APPLICATION_COUNT: "APPLICATION_RECEIVED", OFFERED_COUNT: "OFFERED", OFFER_ACCEPTED_COUNT: "OFFER_ACCEPTED" });

function planningComparison(input: Input, selections: any[]) {
  if (!input.availability.planningTargets || !input.availability.planningBudgets || !input.availability.selectionHistory) return { state: "PREPARING", rows: [] };
  const targets = (input.planningTargets || []).filter((row) => row.record_state === "APPROVED");
  const budgets = (input.planningBudgets || []).filter((row) => row.record_state === "APPROVED");
  const identity = (row: any) => [row.recruiting_track, row.graduation_year ?? "", row.recruiting_period_code, row.recruiting_period_start, row.recruiting_period_end, row.scope_type].join("|");
  const targetKeys = new Set<string>();
  const budgetKeys = new Set<string>();
  for (const row of targets) {
    const key = `${identity(row)}|${row.target_metric}`;
    if (targetKeys.has(key)) return { state: "PREPARING", rows: [] };
    targetKeys.add(key);
  }
  for (const row of budgets) {
    const key = identity(row);
    if (budgetKeys.has(key)) return { state: "PREPARING", rows: [] };
    budgetKeys.add(key);
  }
  const identities = [...new Set([...targets, ...budgets].map(identity))].sort();
  const rows = identities.map((key) => {
    const targetRows = targets.filter((row) => identity(row) === key);
    const budget = budgets.find((row) => identity(row) === key) || null;
    const exemplar = targetRows[0] || budget;
    const cohortIds = exemplar.recruiting_track === "NEW_GRAD"
      ? new Set(input.candidates.filter((candidate) => Number(candidate.graduation_year) === Number(exemplar.graduation_year)).map((candidate) => candidate.candidate_id))
      : null;
    const metrics = Object.fromEntries(PLAN_METRICS.map((metric) => {
      const target = targetRows.find((row) => row.target_metric === metric) || null;
      const selectionCode = (SELECTION_SOURCE as Record<string, string>)[metric] || null;
      const sourceStatus = selectionCode !== null && cohortIds !== null ? "READY" : "ACTUAL_SOURCE_UNAVAILABLE";
      const actual = sourceStatus === "READY" ? new Set(selections.filter((row) => row.selection_code === selectionCode && cohortIds!.has(row.candidate_id)).map((row) => row.candidate_id)).size : null;
      const plan = target ? Number(target.target_count) : null;
      return [metric, {
        targetStatus: target ? "APPROVED" : "NO_APPROVED_TARGET", plan, approvedVersion: target ? Number(target.version) : null,
        actualSourceStatus: sourceStatus, actual,
        achievementRate: target && sourceStatus === "READY" && plan !== null && plan > 0 && actual !== null ? actual / plan : null,
        remaining: target && sourceStatus === "READY" ? Math.max(plan! - actual!, 0) : null
      }];
    }));
    return {
      recruitingTrack: exemplar.recruiting_track, graduationYear: exemplar.graduation_year ?? null,
      period: { code: exemplar.recruiting_period_code, start: exemplar.recruiting_period_start, end: exemplar.recruiting_period_end }, scope: exemplar.scope_type,
      approvedPlanningVersion: new Set([...targetRows.map((row) => Number(row.version)), ...(budget ? [Number(budget.version)] : [])]).size === 1 ? Number((targetRows[0] || budget).version) : null,
      metrics,
      budget: budget ? { targetStatus: "APPROVED", plan: Number(budget.total_budget), currency: budget.currency, approvedVersion: Number(budget.version), actualSourceStatus: "ACTUAL_SOURCE_UNAVAILABLE", actualSpend: null, remaining: null }
        : { targetStatus: "NO_APPROVED_TARGET", plan: null, currency: null, approvedVersion: null, actualSourceStatus: "ACTUAL_SOURCE_UNAVAILABLE", actualSpend: null, remaining: null }
    };
  });
  return { state: "READY", rows };
}

export function buildRecruitingIntelligenceV1(input: Input) {
  const ready = input.availability;
  const complete = Object.values(ready).every(Boolean);
  const activeIds = new Set(input.candidates.map((row) => String(row.candidate_id || "")).filter(Boolean));
  const selections = input.selections.filter((row) => activeIds.has(String(row.candidate_id || "")) && row.is_active !== false && (OFFICIAL_SELECTION_CODES as readonly string[]).includes(row.selection_code));
  const communications = input.communications.filter((row) => activeIds.has(String(row.candidate_id || "")));
  const corrected = new Set(communications.map((row) => String(row.correction_of_event_id || "")).filter(Boolean));
  const effectiveCommunications = communications.filter((row) => !corrected.has(String(row.event_id || "")));
  const actions = input.actions.filter((row) => activeIds.has(String(row.candidate_id || "")) && row.is_active !== false);
  const selectionsByCandidate = new Map<string, any[]>();
  const communicationsByCandidate = new Map<string, any[]>();
  const actionsByCandidate = new Map<string, any[]>();
  for (const [rows, target] of [[selections, selectionsByCandidate], [effectiveCommunications, communicationsByCandidate], [actions, actionsByCandidate]] as const) {
    for (const row of rows) { const id = String(row.candidate_id); const values = target.get(id) || []; values.push(row); target.set(id, values); }
  }
  const latestSelection = new Map<string, any>();
  for (const [id, values] of selectionsByCandidate) latestSelection.set(id, [...values].sort((a, b) => String(b.effective_date).localeCompare(String(a.effective_date)) || String(b.created_at || "").localeCompare(String(a.created_at || "")) || String(b.selection_history_id).localeCompare(String(a.selection_history_id)))[0]);
  const currentProjection = ready.candidates ? countBy(input.candidates, "current_status_code") : null;
  const funnel = ready.selectionHistory ? Object.fromEntries(OFFICIAL_SELECTION_CODES.map((code) => [code, new Set(selections.filter((row) => row.selection_code === code).map((row) => row.candidate_id)).size])) : null;
  const graduationYears = ready.candidates && ready.selectionHistory ? Object.fromEntries([...new Set(input.candidates.map((row) => String(row.graduation_year)))].sort().map((year) => {
    const ids = new Set(input.candidates.filter((row) => String(row.graduation_year) === year).map((row) => row.candidate_id));
    return [year, { candidateCount: ids.size, officialSelectionCandidateCount: new Set(selections.filter((row) => ids.has(row.candidate_id)).map((row) => row.candidate_id)).size }];
  })) : null;
  const activeSchoolIds = new Set((input.schoolMasters || []).filter((row) => row.is_active !== false).map((row) => String(row.school_id || "")).filter(Boolean));
  const schoolProgress = ready.candidates && ready.selectionHistory && ready.schoolMasters ? [...activeSchoolIds].sort().map((schoolId) => {
    const ids = new Set(input.candidates.filter((row) => String(row.school_id || "") === schoolId).map((row) => row.candidate_id));
    return { schoolId, candidateCount: ids.size, officialSelectionCandidateCount: new Set(selections.filter((row) => ids.has(row.candidate_id)).map((row) => row.candidate_id)).size };
  }) : null;
  const todayParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(input.now).map((part) => [part.type, part.value]));
  const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  const todayTime = Date.parse(`${today}T00:00:00+09:00`);
  const bucketOrder = ["OVERDUE", "DUE_TODAY", "AWAITING_REPLY", "SELECTION_WITHOUT_NEXT_ACTION", "UNASSIGNED_ACTION", "STALLED"];
  const buckets = Object.fromEntries(bucketOrder.map((key) => [key, [] as any[]]));
  if (ready.candidates && ready.selectionHistory && ready.communications && ready.nextActions) for (const candidate of input.candidates) {
    const id = String(candidate.candidate_id || "");
    const status = String(candidate.current_status_code || "");
    if (TERMINAL.has(status)) continue;
    const candidateActions = actionsByCandidate.get(id) || [];
    const open = candidateActions.filter((row) => row.state === "OPEN");
    const openWithDue = open.filter((row) => isoDate(row.due_date));
    const overdue = openWithDue.filter((row) => String(row.due_date) < today);
    const dueToday = openWithDue.filter((row) => String(row.due_date) === today);
    const comms = communicationsByCandidate.get(id) || [];
    const awaiting = comms.some((row) => row.awaiting_reply === true);
    const latestFact = latestSelection.get(id);
    const latestActivityTimes = [
      ...comms.map((row) => dateValue(row.communication_at)),
      ...(selectionsByCandidate.get(id) || []).map((row) => dateValue(row.effective_date)),
      ...candidateActions.map((row) => dateValue(row.completed_at || row.updated_at || row.created_at))
    ].filter((value): value is number => value !== null);
    const latestActivity = latestActivityTimes.length ? Math.max(...latestActivityTimes) : null;
    const futureOpen = openWithDue.some((row) => String(row.due_date) > today);
    const row = { candidateId: id, graduationYear: Number(candidate.graduation_year), deadline: openWithDue.map((action) => String(action.due_date)).sort()[0] || null, latestOfficialActivityAt: latestActivity === null ? null : new Date(latestActivity).toISOString() };
    let bucket = overdue.length ? "OVERDUE" : dueToday.length ? "DUE_TODAY" : awaiting && (!open.length || overdue.length) ? "AWAITING_REPLY"
      : latestFact && FOLLOW_UP_REQUIRED.has(latestFact.selection_code) && !open.length ? "SELECTION_WITHOUT_NEXT_ACTION"
      : candidateActions.some((action) => ["OPEN", "ON_HOLD"].includes(action.state) && !action.assigned_employee_id) ? "UNASSIGNED_ACTION"
      : !futureOpen && latestActivity !== null && todayTime - latestActivity >= 7 * DAY ? "STALLED" : null;
    if (bucket) buckets[bucket].push(row);
  }
  const compare = (a: any, b: any) => String(a.deadline || "9999-12-31").localeCompare(String(b.deadline || "9999-12-31")) || String(a.latestOfficialActivityAt || "").localeCompare(String(b.latestOfficialActivityAt || "")) || a.candidateId.localeCompare(b.candidateId);
  const priorityBuckets = bucketOrder.map((bucket) => ({ bucket, count: buckets[bucket].length, candidates: buckets[bucket].sort(compare).slice(0, 200), truncated: buckets[bucket].length > 200 }));
  const confirmed = input.attributions.filter((row) => row.attribution_type === "ORIGIN" && row.attribution_status === "CONFIRMED");
  const pending = input.attributions.filter((row) => row.attribution_type === "ORIGIN" && row.attribution_status === "PENDING");
  const comparison = planningComparison(input, selections);
  return {
    recruiting_intelligence_contract_version: RECRUITING_INTELLIGENCE_CONTRACT_VERSION,
    generatedAt: input.now.toISOString(), sourceCoverageState: complete && comparison.state === "READY" ? "COMPLETE" : "PREPARING", sourceAvailability: ready,
    currentPosition: { state: ready.candidates ? "READY" : "PREPARING", candidateCount: ready.candidates ? input.candidates.length : null, projectionCounts: currentProjection },
    funnel: { state: ready.selectionHistory ? "READY" : "PREPARING", uniqueCandidateReachedCounts: funnel, rates: null },
    graduationYears: { state: ready.candidates && ready.selectionHistory ? "READY" : "PREPARING", rows: graduationYears },
    schoolProgress: { state: ready.candidates && ready.selectionHistory && ready.schoolMasters ? "READY" : "PREPARING", rows: schoolProgress },
    assigneeWorkload: { state: ready.nextActions ? "READY" : "PREPARING", openActionCounts: ready.nextActions ? countBy(actions.filter((row) => ["OPEN", "ON_HOLD"].includes(row.state)).map((row) => ({ assignee: row.assigned_employee_id || "UNASSIGNED" })), "assignee") : null },
    priorities: { state: ready.candidates && ready.selectionHistory && ready.communications && ready.nextActions ? "READY" : "PREPARING", stallThresholdDays: 7, buckets: ready.candidates && ready.selectionHistory && ready.communications && ready.nextActions ? priorityBuckets : [] },
    fairResults: { state: ready.fairAttributions && ready.selectionHistory ? "READY" : "PREPARING", confirmedOriginCandidateCount: ready.fairAttributions ? new Set(confirmed.map((row) => row.candidate_id)).size : null,
      rows: ready.fairAttributions && ready.selectionHistory ? [...new Set(confirmed.map((row) => String(row.fair_id)))].sort().map((fairId) => { const ids = new Set(confirmed.filter((row) => String(row.fair_id) === fairId).map((row) => row.candidate_id)); return { fairId, confirmedOriginCandidateCount: ids.size, officialSelectionCandidateCount: new Set(selections.filter((row) => ids.has(row.candidate_id)).map((row) => row.candidate_id)).size }; }) : null },
    managementDiagnostics: { state: ready.fairAttributions ? "READY" : "PREPARING", pendingFairAttributionCandidateCount: ready.fairAttributions ? new Set(pending.map((row) => row.candidate_id)).size : null, pendingFairAttributionRowCount: ready.fairAttributions ? pending.length : null },
    planningComparison: comparison,
    targets: { state: "UNSET", candidateTarget: null, achievementRate: null }
  };
}
