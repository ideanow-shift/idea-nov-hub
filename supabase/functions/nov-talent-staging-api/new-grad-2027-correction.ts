export const NEW_GRAD_2027_CORRECTION_PREFLIGHT_CONTRACT_VERSION = "1.0.0";

const EXPECTED = Object.freeze({
  recruitingTrack: "NEW_GRAD",
  graduationYear: 2027,
  scope: "COMPANY",
  oldPeriod: Object.freeze({ start: "2025-09-01", end: "2026-08-31" }),
  newPeriod: Object.freeze({ start: "2026-04-01", end: "2027-03-31" }),
  targets: Object.freeze({
    CONTACT_COUNT: 563,
    SALON_VISIT_COUNT: 112,
    APPLICATION_COUNT: 45,
    OFFERED_COUNT: 37,
    OFFER_ACCEPTED_COUNT: 37,
  }),
  budget: Object.freeze({ amount: 7385350, currency: "JPY" }),
});

type ReadResult = { ok: boolean; rows?: unknown[] };
type Reader = (path: string) => Promise<ReadResult>;

export async function newGrad2027CorrectionPreflight(
  read: Reader,
  writesEnabled: boolean,
) {
  const targetSelect =
    "recruiting_track,graduation_year,target_metric,recruiting_period_code,recruiting_period_start,recruiting_period_end,target_count,version,row_version,record_state";
  const budgetSelect =
    "recruiting_track,graduation_year,recruiting_period_code,recruiting_period_start,recruiting_period_end,total_budget,currency,version,row_version,record_state";
  const [targetResult, budgetResult] = await Promise.all([
    read(
      `/rest/v1/nov_talent_recruiting_funnel_targets_v1?select=${targetSelect}&recruiting_track=eq.NEW_GRAD&graduation_year=eq.2027&order=target_metric.asc,record_state.asc&limit=20`,
    ),
    read(
      `/rest/v1/nov_talent_recruiting_budgets_v1?select=${budgetSelect}&recruiting_track=eq.NEW_GRAD&graduation_year=eq.2027&order=record_state.asc&limit=10`,
    ),
  ]);
  if (
    !targetResult.ok || !budgetResult.ok || !Array.isArray(targetResult.rows) ||
    !Array.isArray(budgetResult.rows)
  ) return envelope("UNAVAILABLE", false, writesEnabled);
  const targets = targetResult.rows as any[];
  const budgets = budgetResult.rows as any[];
  const old = (row: any) =>
    row?.recruiting_track === "NEW_GRAD" &&
    Number(row.graduation_year) === 2027 &&
    row.recruiting_period_code === "GRAD_2027" &&
    row.recruiting_period_start === EXPECTED.oldPeriod.start &&
    row.recruiting_period_end === EXPECTED.oldPeriod.end;
  const approved = targets.filter((row) => row.record_state === "APPROVED");
  const drafts = targets.filter((row) => row.record_state === "DRAFT");
  const expectedApproved = [
    ["CONTACT_COUNT", 563],
    ["SALON_VISIT_COUNT", 112],
    ["APPLICATION_COUNT", 45],
  ];
  const expectedDrafts = [["OFFERED_COUNT", 37], ["OFFER_ACCEPTED_COUNT", 37]];
  const exactRows = (rows: any[], expected: any[][], rowVersion: number) =>
    rows.length === expected.length &&
    expected.every(([metric, count]) =>
      rows.some((row) =>
        old(row) && row.target_metric === metric &&
        Number(row.target_count) === count && Number(row.version) === 1 &&
        Number(row.row_version) === rowVersion
      )
    );
  const activeApprovedDuplicates =
    new Set(approved.map((row) => row.target_metric)).size !== approved.length;
  const approvedBudgets = budgets.filter((row) =>
    row.record_state === "APPROVED"
  );
  const current = (row: any) =>
    row?.recruiting_track === "NEW_GRAD" &&
    Number(row.graduation_year) === 2027 &&
    row.recruiting_period_code === "GRAD_2027" &&
    row.recruiting_period_start === EXPECTED.newPeriod.start &&
    row.recruiting_period_end === EXPECTED.newPeriod.end;
  const completedTargets = approved.filter((row) => current(row));
  const completed = completedTargets.length === 5 &&
    Object.entries(EXPECTED.targets).every(([metric, count]) =>
      completedTargets.some((row) =>
        row.target_metric === metric && Number(row.target_count) === count &&
        Number(row.version) >= 2
      )
    ) &&
    approvedBudgets.some((row) =>
      current(row) && Number(row.total_budget) === 7385350 &&
      row.currency === "JPY" && Number(row.version) >= 2
    );
  if (completed) return envelope("COMPLETED", false, writesEnabled);
  const exactBudget = approvedBudgets.length === 1 && old(approvedBudgets[0]) &&
    Number(approvedBudgets[0].total_budget) === 7385350 &&
    approvedBudgets[0].currency === "JPY" &&
    Number(approvedBudgets[0].version) === 1 &&
    Number(approvedBudgets[0].row_version) === 2;
  const pass = exactRows(approved, expectedApproved, 2) &&
    exactRows(drafts, expectedDrafts, 1) && exactBudget &&
    !activeApprovedDuplicates && targets.length === 5 && budgets.length === 1;
  return envelope(pass ? "PASS" : "BLOCKED", pass, writesEnabled);
}

function envelope(state: string, pass: boolean, writesEnabled: boolean) {
  return Object.freeze({
    ok: true,
    data: Object.freeze({
      recruiting_planning_correction_preflight_contract_version:
        NEW_GRAD_2027_CORRECTION_PREFLIGHT_CONTRACT_VERSION,
      state,
      exactPreflightPassed: pass,
      canExecute: pass && writesEnabled === true,
      preview: EXPECTED,
    }),
  });
}
