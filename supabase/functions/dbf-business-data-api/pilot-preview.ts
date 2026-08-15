type Json = Record<string, unknown>;

type PilotHistoryItem = {
  batchId: string;
  factKind: string;
  fiscalMonth: string;
  sourceType: string;
  status: string;
  revision: number;
  rowCount: number;
  errorCount: number;
  warningCount: number;
};

type PilotBatchPreview = {
  batchId: string;
  rowCount: number;
  validCount: number;
  quarantinedCount: number;
  errorCount: number;
  warningCount: number;
  issues: Array<{ severity: string; ruleCode: string; fieldName?: string | null; message: string }>;
  promotionAllowed: boolean;
};

export const DBF_PILOT_202606_CONTRACT = Object.freeze({
  schemaVersion: "dbf-pilot-month-preview-v1",
  fiscalMonth: "2026-06",
  accountingStatus: "CONFIRMED",
  sourceOwner: "経理部",
  parserContract: "dbf-pilot-202606-v1",
  sourceFileCount: 2,
  mappings: Object.freeze({ exact: 26, companyBindings: 1860, storeBindings: 1392 }),
  auditPages: Object.freeze({ exact: 15, unresolved: 9, quarantined: 10 }),
  batches: Object.freeze([
    Object.freeze({ factKind: "pl", sourceType: "monthly_pl_comparison_source_audit", status: "mapping_required", rawRows: 34, stagingRows: 0, warnings: 3 }),
    Object.freeze({ factKind: "pl", sourceType: "monthly_pl_actual", status: "owner_review", rawRows: 164, stagingRows: 164, warnings: 2 }),
    Object.freeze({ factKind: "budget", sourceType: "monthly_pl_plan", status: "owner_review", rawRows: 777, stagingRows: 777, warnings: 3 }),
    Object.freeze({ factKind: "pl", sourceType: "yayoi_monthly_pl_actual", status: "owner_review", rawRows: 852, stagingRows: 852, warnings: 2 }),
    Object.freeze({ factKind: "bs", sourceType: "yayoi_monthly_bs", status: "owner_review", rawRows: 67, stagingRows: 67, warnings: 2 }),
  ]),
  controls: Object.freeze({
    pl: Object.freeze({ totalSales: 88066258, technicalSales: 72040100, retailSales: 14776957, ecSales: 1249201, ordinaryProfit: 5704265 }),
    bs: Object.freeze({ assets: 570155249, liabilities: 213188431, equity: 356966818, difference: 0 }),
    budget: Object.freeze({ rows: 777, corporationRows: 166, storeRows: 611, sourceConfirmation: "CONFIRMED", confirmation: "provisional", approval: "UNVERIFIED" }),
  }),
  sourcePrecedence: Object.freeze({
    status: "PREVIEW_RULE_DEFINED_PROMOTION_BLOCKED",
    overlappingCandidateCount: 48,
    selectedSource: "yayoi_monthly_pl_actual",
    excludedSource: "monthly_pl_actual",
    precedenceReason: "FINANCIAL_LEDGER_PRECEDES_MANAGEMENT_PRESENTATION_ON_OVERLAPPING_GRAIN",
    canonicalGrain: Object.freeze(["company_id", "store_id", "fiscal_month", "account", "scenario", "grain"]),
    duplicatePromotionCount: 0,
    excelScope: "IDEA NOV finance detail / B/S / detailed accounts",
    pdfScope: "management presentation / FC and stores / HQ and departments / EC / plan / prior period",
  }),
  taxBasis: Object.freeze({
    status: "NOT_COMPARABLE_WITHOUT_NORMALIZATION",
    groups: Object.freeze([
      Object.freeze({ basis: "TAX_EXCLUSIVE", rows: 919, source: "Yayoi Excel P/L and B/S" }),
      Object.freeze({ basis: "TAX_INCLUSIVE", rows: 0, source: "Lua PDF source scope (audit only; no canonical candidate)" }),
      Object.freeze({ basis: "UNKNOWN", rows: 941, source: "Other PDF actual and plan" }),
    ]),
  }),
});

const REQUIRED_SECTIONS = new Set(["all", "source", "batches", "validation", "reconciliation", "summary", "detail"]);

export function pilotPreviewSection(value: unknown) {
  const section = String(value || "all");
  if (!REQUIRED_SECTIONS.has(section)) throw new Error("PILOT_PREVIEW_SECTION_INVALID");
  return section;
}

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function warningGroups(previews: PilotBatchPreview[]) {
  const counts = new Map<string, number>();
  for (const preview of previews) {
    for (const issue of preview.issues || []) {
      if (issue.severity !== "warning") continue;
      counts.set(issue.ruleCode, (counts.get(issue.ruleCode) || 0) + 1);
    }
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ruleCode, count]) => ({ ruleCode, count }));
}

function requiredWarnings(ruleCounts: Map<string, number>) {
  return [
    {
      category: "ACCOUNT_CODE_PROVISIONAL",
      count: ruleCounts.get("ACCOUNT_CODE_ABSENT_SOURCE_ROW_CANDIDATE") || 0,
      status: "OWNER_REVIEW_REQUIRED",
      detail: "Source-row candidate codes are not approved Canonical account codes.",
    },
    {
      category: "TAX_BASIS_MIXED",
      count: ruleCounts.get("PDF_TAX_BASIS_REVIEW") || 0,
      status: "NOT_COMPARABLE_WITHOUT_NORMALIZATION",
      detail: "TAX_EXCLUSIVE, TAX_INCLUSIVE and UNKNOWN remain separated; no automatic tax conversion was applied.",
    },
    {
      category: "BUDGET_APPROVAL_UNVERIFIED",
      count: ruleCounts.get("BUDGET_APPROVAL_UNVERIFIED") || 0,
      status: "UNVERIFIED",
      detail: "777 provisional budget rows require separate Owner approval.",
    },
    {
      category: "STORE_METRICS_MISSING",
      count: 1,
      status: "SOURCE_NOT_SUBMITTED",
      detail: "Missing source is not treated as confirmed zero.",
    },
    {
      category: "TRANSFER_ADJUSTMENT_QUARANTINED",
      count: ruleCounts.get("UNSUPPORTED_SCOPE_ROWS_QUARANTINED") || 0,
      status: "QUARANTINED",
      detail: "BIOEL Tachikawa transfer adjustment is excluded from Canonical operating facts.",
    },
  ];
}

function batchKey(value: { factKind: string; sourceType: string }) {
  return `${value.factKind}:${value.sourceType}`;
}

export function buildDbfPilotMonthPreview(
  history: { items?: PilotHistoryItem[] } | null,
  previews: PilotBatchPreview[],
  section = "all",
) {
  const selectedSection = pilotPreviewSection(section);
  const items = (history?.items || []).filter((item) => item.fiscalMonth === DBF_PILOT_202606_CONTRACT.fiscalMonth);
  const previewByBatch = new Map(previews.map((item) => [item.batchId, item]));
  const batches = items.map((item) => {
    const preview = previewByBatch.get(item.batchId);
    return {
      batchId: item.batchId,
      factKind: item.factKind,
      sourceType: item.sourceType,
      status: item.status,
      revision: number(item.revision),
      rawRows: number(item.rowCount),
      stagingRows: number(preview?.rowCount),
      validRows: number(preview?.validCount),
      quarantinedRows: number(preview?.quarantinedCount),
      errors: number(preview?.errorCount),
      warnings: number(preview?.warningCount),
      promotionAllowed: preview?.promotionAllowed === true,
    };
  });
  const issues = previews.flatMap((item) => item.issues || []);
  const groupedWarnings = warningGroups(previews);
  const ruleCounts = new Map(groupedWarnings.map((item) => [item.ruleCode, item.count]));
  const observed = new Map(batches.map((item) => [batchKey(item), item]));
  const contractMatches = DBF_PILOT_202606_CONTRACT.batches.every((expected) => {
    const item = observed.get(batchKey(expected));
    return item?.status === expected.status
      && item.rawRows === expected.rawRows
      && item.stagingRows === expected.stagingRows
      && item.errors === 0
      && item.warnings === expected.warnings;
  });
  const totals = batches.reduce((sum, item) => ({
    rawRows: sum.rawRows + item.rawRows,
    stagingRows: sum.stagingRows + item.stagingRows,
    errors: sum.errors + item.errors,
    warnings: sum.warnings + item.warnings,
  }), { rawRows: 0, stagingRows: 0, errors: 0, warnings: 0 });
  const statusMatches = items.length === 5
    && previews.length === 5
    && totals.rawRows === 1894
    && totals.stagingRows === 1860
    && totals.errors === 0
    && totals.warnings === 12
    && contractMatches;
  const approvalCount = items.filter((item) => ["approved", "promoted", "superseded"].includes(item.status)).length;
  const promotionCount = items.filter((item) => ["promoted", "superseded"].includes(item.status)).length;

  return {
    schemaVersion: DBF_PILOT_202606_CONTRACT.schemaVersion,
    selectedSection,
    sourceStatus: statusMatches ? "READY_FOR_OWNER_PREVIEW" : "BASELINE_MISMATCH",
    pilotMonth: DBF_PILOT_202606_CONTRACT.fiscalMonth,
    accountingStatus: DBF_PILOT_202606_CONTRACT.accountingStatus,
    sourceOwner: DBF_PILOT_202606_CONTRACT.sourceOwner,
    parserContract: DBF_PILOT_202606_CONTRACT.parserContract,
    summary: {
      sourceFiles: DBF_PILOT_202606_CONTRACT.sourceFileCount,
      importBatches: items.length,
      ...totals,
      promotionCandidates: totals.stagingRows,
      canonicalFactWrites: 0,
      approvals: approvalCount,
      promotions: promotionCount,
    },
    batches,
    mapping: {
      ...DBF_PILOT_202606_CONTRACT.mappings,
      stagingResolvedRows: totals.stagingRows,
      stagingValidRows: totals.stagingRows,
      auditPages: DBF_PILOT_202606_CONTRACT.auditPages,
    },
    validation: {
      errors: totals.errors,
      warnings: totals.warnings,
      ruleCounts: groupedWarnings,
      categories: requiredWarnings(ruleCounts),
      issueMessages: issues.map((issue) => ({ severity: issue.severity, ruleCode: issue.ruleCode, message: issue.message })),
    },
    pl: {
      pdfRows: observed.get("pl:monthly_pl_actual")?.stagingRows || 0,
      excelRows: observed.get("pl:yayoi_monthly_pl_actual")?.stagingRows || 0,
      reconciliation: ruleCounts.has("PDF_EXCEL_RECONCILIATION_PASS") ? "PASS" : "UNVERIFIED",
      controlTotals: DBF_PILOT_202606_CONTRACT.controls.pl,
    },
    bs: {
      rows: observed.get("bs:yayoi_monthly_bs")?.stagingRows || 0,
      balance: ruleCounts.has("BS_BALANCE_PASS") ? "PASS" : "UNVERIFIED",
      ...DBF_PILOT_202606_CONTRACT.controls.bs,
    },
    budget: {
      ...DBF_PILOT_202606_CONTRACT.controls.budget,
      rows: observed.get("budget:monthly_pl_plan")?.stagingRows || 0,
    },
    storeMetrics: { rows: 0, status: "SOURCE_NOT_SUBMITTED", confirmedZero: false },
    sourcePrecedence: DBF_PILOT_202606_CONTRACT.sourcePrecedence,
    taxBasis: DBF_PILOT_202606_CONTRACT.taxBasis,
    gates: {
      ownerApproval: "NOT_EXECUTED",
      canonicalPromotion: "DISABLED",
      sourcePrecedencePreview: "READY",
      budgetApproval: "UNVERIFIED",
      productionWrite: "DISABLED",
    },
  } satisfies Json;
}
