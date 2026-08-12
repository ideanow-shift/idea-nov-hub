export const RECRUITING_ACTUAL_FACT_CONTRACT_VERSION = "1.0.0" as const;
export const RECRUITING_INTELLIGENCE_ACTUAL_CONTRACT_VERSION = "1.2.0" as const;

export type ActualSourceStatus = "READY" | "PARTIAL_SOURCE" | "ACTUAL_SOURCE_UNAVAILABLE" | "PREPARING";
export type MetricResult = Readonly<{
  state: "PLAN_AVAILABLE_ACTUAL_AVAILABLE" | "PLAN_AVAILABLE_ACTUAL_SOURCE_UNAVAILABLE" | "NO_APPROVED_TARGET";
  actualSourceStatus: ActualSourceStatus;
  actualState: "ACTUAL_CONFIRMED" | "ACTUAL_CONFIRMED_ZERO" | "ACTUAL_PROVISIONAL" | "UNAVAILABLE";
  actual: number | null;
  referenceValue: number | null;
  eventCount: number | null;
  actualGrain: "UNIQUE_CANDIDATE" | "JPY";
  remaining: number | null;
  achievementRate: number | null;
}>;

const effective = <T extends { engagement_fact_id?: string; spend_fact_id?: string; correction_of_fact_id?: string | null }>(rows: T[]) => {
  const replaced = new Set(rows.map((row) => row.correction_of_fact_id).filter(Boolean));
  return rows.filter((row) => !replaced.has(row.engagement_fact_id || row.spend_fact_id));
};

function result(plan: number | null, status: ActualSourceStatus, confirmed: number | null, referenceValue: number | null, eventCount: number | null, grain: "UNIQUE_CANDIDATE" | "JPY"): MetricResult {
  const targetMissing = plan === null;
  const ready = status === "READY";
  return Object.freeze({
    state: targetMissing ? "NO_APPROVED_TARGET" : ready ? "PLAN_AVAILABLE_ACTUAL_AVAILABLE" : "PLAN_AVAILABLE_ACTUAL_SOURCE_UNAVAILABLE",
    actualSourceStatus: status,
    actualState: ready ? (confirmed === 0 ? "ACTUAL_CONFIRMED_ZERO" : "ACTUAL_CONFIRMED") : status === "PARTIAL_SOURCE" ? "ACTUAL_PROVISIONAL" : "UNAVAILABLE",
    actual: ready ? confirmed : null,
    referenceValue: status === "PARTIAL_SOURCE" ? referenceValue : null,
    eventCount,
    actualGrain: grain,
    remaining: !targetMissing && ready && confirmed !== null ? Math.max(0, plan - confirmed) : null,
    achievementRate: !targetMissing && ready && confirmed !== null && plan > 0 ? confirmed / plan : null
  });
}

export function engagementActual(input: { plan: number | null; type: "CONTACT" | "SALON_VISIT"; sourceStatus: ActualSourceStatus; rows: any[]; candidateIds: Set<string>; start: string; end: string; }) {
  const rows = effective(input.rows).filter((row: any) => row.engagement_type === input.type && row.engagement_status === "COMPLETED"
    && input.candidateIds.has(row.candidate_id) && String(row.occurred_at).slice(0, 10) >= input.start && String(row.occurred_at).slice(0, 10) <= input.end);
  const unique = new Set(rows.map((row: any) => row.candidate_id)).size;
  return result(input.plan, input.sourceStatus, unique, unique, rows.length, "UNIQUE_CANDIDATE");
}

export function selectionActual(input: { plan: number | null; selectionCode: string; coverageState: "COMPLETE" | "PARTIAL" | "UNAVAILABLE" | "PREPARING"; rows: any[]; candidateIds: Set<string>; start: string; end: string; }) {
  const status: ActualSourceStatus = input.coverageState === "COMPLETE" ? "READY" : input.coverageState === "PARTIAL" ? "PARTIAL_SOURCE" : input.coverageState === "PREPARING" ? "PREPARING" : "ACTUAL_SOURCE_UNAVAILABLE";
  const rows = input.rows.filter((row: any) => row.is_active === true && row.selection_code === input.selectionCode && input.candidateIds.has(row.candidate_id)
    && row.effective_date >= input.start && row.effective_date <= input.end);
  const unique = new Set(rows.map((row: any) => row.candidate_id)).size;
  return result(input.plan, status, unique, unique, rows.length, "UNIQUE_CANDIDATE");
}

export function spendActual(input: { plan: number | null; sourceStatus: ActualSourceStatus; rows: any[]; track: string; graduationYear: number | null; start: string; end: string; }) {
  const rows = effective(input.rows).filter((row: any) => row.recruiting_track === input.track && row.graduation_year === input.graduationYear
    && row.occurred_at >= input.start && row.occurred_at <= input.end);
  const confirmed = rows.filter((row: any) => row.spend_status === "CONFIRMED").reduce((sum: number, row: any) => sum + Number(row.amount), 0);
  const provisional = rows.filter((row: any) => row.spend_status === "PROVISIONAL").reduce((sum: number, row: any) => sum + Number(row.amount), 0);
  return result(input.plan, input.sourceStatus, confirmed, provisional, rows.length, "JPY");
}
