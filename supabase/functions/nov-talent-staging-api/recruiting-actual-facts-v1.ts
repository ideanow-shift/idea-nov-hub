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

const coverageState = (rows: any[], metric: string, start: string, end: string) => {
  const current = rows.find((row: any) => row.selection_code === metric && row.coverage_state === "COMPLETE"
    && row.recruiting_period_start === start && row.recruiting_period_end === end && !row.superseded_by_release_id);
  return current ? "COMPLETE" as const : "UNAVAILABLE" as const;
};

const contactBackfillReady = (receipts: any[], engagementFacts: any[]) => {
  const completed = receipts.filter((row: any) => row.backfill_code === "CONTACT_2027_HUMAN_REVIEW" && row.receipt_state === "COMPLETED");
  const voided = receipts.filter((row: any) => row.backfill_code === "CONTACT_2027_HUMAN_REVIEW" && row.receipt_state === "VOIDED");
  const receipt = completed[0];
  const facts = effective(engagementFacts).filter((row: any) => row.source_type === "CONTACTS_27_HUMAN_REVIEW"
    && row.engagement_type === "CONTACT" && row.engagement_status === "COMPLETED" && row.original_actor_status === "UNAVAILABLE");
  return completed.length === 1 && voided.length === 0
    && receipt?.review_status === "APPROVED_FOR_BACKFILL"
    && receipt?.review_package_sha256 === "139d6b1b222cd7a7d820375c08e1b4ace811fc285ed89e27dd924d2bfb8c9125"
    && receipt?.canonical_source_sha256 === "725cc4b8ae933081dc30fd7ce37179741661d795a20edaed542023b4d3621a77"
    && Number(receipt?.source_event_count) === 11 && Number(receipt?.unique_candidate_count) === 10
    && Number(receipt?.fact_count) === 11 && facts.length === 11
    && new Set(facts.map((row: any) => row.candidate_id)).size === 10;
};

const salonVisitBackfillReady = (
  receipts: any[], engagementFacts: any[], engagementAudits: any[],
  candidateIds: Set<string>, start: string, end: string,
) => {
  const completed = receipts.filter((row: any) => row.backfill_code === "SALON_VISIT_2027_HUMAN_REVIEW" && row.receipt_state === "COMPLETED");
  const voided = receipts.filter((row: any) => row.backfill_code === "SALON_VISIT_2027_HUMAN_REVIEW" && row.receipt_state === "VOIDED");
  const receipt = completed[0];
  const facts = effective(engagementFacts).filter((row: any) => row.source_type === "CONTACTS_27_SALON_VISIT_HUMAN_REVIEW"
    && row.engagement_type === "SALON_VISIT" && row.engagement_status === "COMPLETED"
    && row.original_actor_status === "UNAVAILABLE" && row.store_id && row.source_event_id
    && candidateIds.has(String(row.candidate_id))
    && String(row.occurred_at).slice(0, 10) >= start && String(row.occurred_at).slice(0, 10) <= end);
  const factIds = new Set(facts.map((row: any) => String(row.engagement_fact_id)));
  const audits = engagementAudits.filter((row: any) => row.event_type === "FACT_APPENDED" && factIds.has(String(row.engagement_fact_id)));
  return completed.length === 1 && voided.length === 0
    && receipt?.review_status === "APPROVED_FOR_BACKFILL"
    && receipt?.review_package_sha256 === "10c87773b376dddaf044dc1c3e2dd88e68b759e2a237df0e406a8a563a192540"
    && receipt?.canonical_source_sha256 === "ed954ba2a5553ab645d5050cd8ed036aad6e749435d09a9fcfe256255426c023"
    && receipt?.original_actor_status === "UNAVAILABLE"
    && Number(receipt?.source_event_count) === 4 && Number(receipt?.unique_candidate_count) === 4
    && Number(receipt?.fact_count) === 15 && facts.length === 15
    && new Set(facts.map((row: any) => row.candidate_id)).size === 4
    && new Set(facts.map((row: any) => row.source_event_id)).size === 4
    && new Set(facts.map((row: any) => row.store_id)).size === 8
    && new Set(facts.map((row: any) => row.source_fingerprint)).size === 15
    && audits.length === 15 && new Set(audits.map((row: any) => row.engagement_fact_id)).size === 15;
};

export function buildRecruitingActualFactsV1(input: {
  candidates: any[]; selections: any[]; engagementFacts: any[]; engagementAudits: any[]; coverageReleases: any[]; spendFacts: any[];
  backfillReceipts: any[]; salonVisitBackfillReceipts: any[];
  planningTargets: any[]; planningBudgets: any[]; availability: Record<string, boolean>;
}) {
  const targets = input.planningTargets.filter((row: any) => row.recruiting_track === "NEW_GRAD" && row.graduation_year === 2027
    && row.scope_type === "COMPANY" && row.record_state === "APPROVED");
  const target = new Map(targets.map((row: any) => [row.target_metric, Number(row.target_count)]));
  const first = targets[0];
  const budgetRow = input.planningBudgets.find((row: any) => row.recruiting_track === "NEW_GRAD" && row.graduation_year === 2027
    && row.scope_type === "COMPANY" && row.record_state === "APPROVED");
  const start = first?.recruiting_period_start || "2026-04-01";
  const end = first?.recruiting_period_end || "2027-03-31";
  const candidateIds = new Set(input.candidates.filter((row: any) => Number(row.graduation_year) === 2027).map((row: any) => String(row.candidate_id)));
  const contactSourcesAvailable = input.availability.engagementFacts && input.availability.backfillReceipts;
  const salonVisitSourcesAvailable = input.availability.engagementFacts && input.availability.engagementAudits
    && input.availability.salonVisitBackfillReceipts;
  const contactStatus: ActualSourceStatus = !contactSourcesAvailable ? "PREPARING"
    : contactBackfillReady(input.backfillReceipts, input.engagementFacts) ? "READY" : "ACTUAL_SOURCE_UNAVAILABLE";
  const salonVisitStatus: ActualSourceStatus = !salonVisitSourcesAvailable ? "PREPARING"
    : salonVisitBackfillReady(input.salonVisitBackfillReceipts, input.engagementFacts, input.engagementAudits, candidateIds, start, end)
    ? "READY" : "ACTUAL_SOURCE_UNAVAILABLE";
  const spendStatus: ActualSourceStatus = !input.availability.spendFacts ? "PREPARING" : input.spendFacts.length ? "PARTIAL_SOURCE" : "ACTUAL_SOURCE_UNAVAILABLE";
  const selectionCoverage = (metric: string) => !input.availability.coverageReleases || !input.availability.selections ? "PREPARING" as const
    : coverageState(input.coverageReleases, metric, start, end);
  const decorate = (plan: number | null, value: MetricResult, coverage: "COMPLETE" | "PARTIAL" | "UNAVAILABLE" | "PREPARING") => ({
    targetStatus: plan === null ? "NO_APPROVED_TARGET" : "APPROVED", plan, ...value, coverageState: coverage, sourceAsOf: null
  });
  return {
    recruiting_actual_fact_contract_version: RECRUITING_ACTUAL_FACT_CONTRACT_VERSION,
    recruiting_intelligence_contract_version: RECRUITING_INTELLIGENCE_ACTUAL_CONTRACT_VERSION,
    planningBinding: { recruitingTrack: "NEW_GRAD", graduationYear: 2027, periodStart: start, periodEnd: end, scope: "COMPANY" },
    metrics: {
      CONTACT_COUNT: decorate(target.get("CONTACT_COUNT") ?? null, engagementActual({ plan: target.get("CONTACT_COUNT") ?? null, type: "CONTACT", sourceStatus: contactStatus, rows: input.engagementFacts, candidateIds, start, end }), contactStatus === "READY" ? "COMPLETE" : contactStatus === "PREPARING" ? "PREPARING" : "UNAVAILABLE"),
      SALON_VISIT_COUNT: decorate(target.get("SALON_VISIT_COUNT") ?? null, engagementActual({ plan: target.get("SALON_VISIT_COUNT") ?? null, type: "SALON_VISIT", sourceStatus: salonVisitStatus, rows: input.engagementFacts, candidateIds, start, end }), salonVisitStatus === "READY" ? "COMPLETE" : salonVisitStatus === "PREPARING" ? "PREPARING" : "UNAVAILABLE"),
      APPLICATION_COUNT: decorate(target.get("APPLICATION_COUNT") ?? null, selectionActual({ plan: target.get("APPLICATION_COUNT") ?? null, selectionCode: "APPLICATION_RECEIVED", coverageState: selectionCoverage("APPLICATION_RECEIVED"), rows: input.selections, candidateIds, start, end }), selectionCoverage("APPLICATION_RECEIVED")),
      OFFERED_COUNT: decorate(target.get("OFFERED_COUNT") ?? null, selectionActual({ plan: target.get("OFFERED_COUNT") ?? null, selectionCode: "OFFERED", coverageState: selectionCoverage("OFFERED"), rows: input.selections, candidateIds, start, end }), selectionCoverage("OFFERED")),
      OFFER_ACCEPTED_COUNT: decorate(target.get("OFFER_ACCEPTED_COUNT") ?? null, selectionActual({ plan: target.get("OFFER_ACCEPTED_COUNT") ?? null, selectionCode: "OFFER_ACCEPTED", coverageState: selectionCoverage("OFFER_ACCEPTED"), rows: input.selections, candidateIds, start, end }), selectionCoverage("OFFER_ACCEPTED"))
    },
    budget: decorate(budgetRow ? Number(budgetRow.total_budget) : null, spendActual({ plan: budgetRow ? Number(budgetRow.total_budget) : null, sourceStatus: spendStatus, rows: input.spendFacts, track: "NEW_GRAD", graduationYear: 2027, start, end }), spendStatus === "PREPARING" ? "PREPARING" : spendStatus === "PARTIAL_SOURCE" ? "PARTIAL" : "UNAVAILABLE")
  };
}
