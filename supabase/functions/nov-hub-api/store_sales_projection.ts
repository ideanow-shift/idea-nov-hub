export type DataState = "available" | "collecting" | "preparing" | "unavailable" | "validation_error";
export type StoreStatus = "Good" | "Stable" | "Improving" | "Needs Attention";

export interface ProjectionMetric {
  label: string;
  displayValue: string | null;
  dataState: DataState;
  reason?: string;
  updatedAt?: string | null;
}

export interface StoreSalesProjectionInput {
  storeKey: string;
  storeName: string;
  ownership: "Direct" | "FC" | null;
  area?: string | null;
  corporation?: string | null;
  period: string;
  accountingState: "confirmed" | "collecting" | "preparing";
  lastUpdatedAt: string | null;
  metrics: Record<string, ProjectionMetric>;
  signals: {
    operatingProfitMarginDisplay?: number | null;
    ordinaryProfitNegative?: boolean;
    salesTargetAchievementDisplay?: number | null;
    salesYearOverYearDisplay?: number | null;
    improvingMetricCount?: number;
    validationErrorCount?: number;
    overdueDataDays?: number;
  };
}

export interface StatusRule {
  id: string;
  status: StoreStatus;
  priority: number;
  matches(input: StoreSalesProjectionInput): boolean;
  reason(input: StoreSalesProjectionInput): string;
  recommendation: string;
}

export const STORE_STATUS_RULE_REGISTRY: readonly StatusRule[] = Object.freeze([
  {
    id: "ordinary-profit-negative",
    status: "Needs Attention",
    priority: 100,
    matches: (input) => input.signals.ordinaryProfitNegative === true,
    reason: () => "経常利益が赤字です",
    recommendation: "費用構成と売上計上を確認",
  },
  {
    id: "operating-margin-below-15",
    status: "Needs Attention",
    priority: 90,
    matches: (input) => {
      const value = input.signals.operatingProfitMarginDisplay;
      return typeof value === "number" && value < 15;
    },
    reason: (input) => `営業利益率が基準の15.0%を下回っています（${input.signals.operatingProfitMarginDisplay?.toFixed(1)}%）`,
    recommendation: "人件費・材料費・販促費の推移を確認",
  },
  {
    id: "validation-error",
    status: "Needs Attention",
    priority: 85,
    matches: (input) => (input.signals.validationErrorCount || 0) > 0,
    reason: (input) => `確認が必要なデータが${input.signals.validationErrorCount}件あります`,
    recommendation: "取込エラーと未提出データを確認",
  },
  {
    id: "data-overdue",
    status: "Needs Attention",
    priority: 80,
    matches: (input) => (input.signals.overdueDataDays || 0) >= 7,
    reason: (input) => `データの未確定が${input.signals.overdueDataDays}日続いています`,
    recommendation: "月次データの提出・承認状況を確認",
  },
  {
    id: "improving",
    status: "Improving",
    priority: 50,
    matches: (input) => (input.signals.improvingMetricCount || 0) >= 2,
    reason: () => "複数の主要指標が前月から改善しています",
    recommendation: "改善要因を確認し、継続施策を決定",
  },
  {
    id: "good-performance",
    status: "Good",
    priority: 30,
    matches: (input) =>
      (input.signals.operatingProfitMarginDisplay || 0) >= 20 &&
      (input.signals.salesTargetAchievementDisplay || 0) >= 100,
    reason: () => "利益率と売上達成率が基準を満たしています",
    recommendation: "好調要因を他店舗へ共有",
  },
]);

const STATUS_ORDER: Record<StoreStatus, number> = {
  "Needs Attention": 0,
  Improving: 1,
  Stable: 2,
  Good: 3,
};

function evaluatedRules(input: StoreSalesProjectionInput): StatusRule[] {
  return STORE_STATUS_RULE_REGISTRY
    .filter((rule) => rule.matches(input))
    .sort((left, right) => right.priority - left.priority);
}

export function evaluateStoreStatus(input: StoreSalesProjectionInput): {
  status: StoreStatus;
  ruleId: string;
  reason: string;
} {
  const matched = evaluatedRules(input)[0];
  if (!matched) {
    return {
      status: "Stable",
      ruleId: "stable-default",
      reason: "確認可能な指標は安定範囲です",
    };
  }
  return { status: matched.status, ruleId: matched.id, reason: matched.reason(input) };
}

function storeActions(input: StoreSalesProjectionInput) {
  return evaluatedRules(input)
    .filter((rule) => rule.status === "Needs Attention" || rule.status === "Improving")
    .slice(0, 3)
    .map((rule) => ({
      id: `${input.storeKey}:${rule.id}`,
      storeKey: input.storeKey,
      storeName: input.storeName,
      status: rule.status,
      reason: rule.reason(input),
      recommendation: rule.recommendation,
      ruleId: rule.id,
    }));
}

function metric(input: StoreSalesProjectionInput, key: string, fallbackLabel: string): ProjectionMetric {
  return input.metrics[key] || {
    label: fallbackLabel,
    displayValue: null,
    dataState: "preparing",
    reason: "データソースを準備しています",
  };
}

export function buildStoreSalesProjection(
  inputs: StoreSalesProjectionInput[],
  generatedAt = new Date().toISOString(),
  executiveMetrics: Record<string, ProjectionMetric> = {},
) {
  const stores = inputs.map((input) => {
    const evaluated = evaluateStoreStatus(input);
    return {
      storeKey: input.storeKey,
      storeName: input.storeName,
      ownership: input.ownership,
      area: input.area || null,
      corporation: input.corporation || null,
      period: input.period,
      accountingState: input.accountingState,
      lastUpdatedAt: input.lastUpdatedAt,
      status: evaluated.status,
      statusReason: evaluated.reason,
      statusRuleId: evaluated.ruleId,
      metrics: input.metrics,
      actions: storeActions(input),
    };
  }).sort((left, right) =>
    STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
    left.storeName.localeCompare(right.storeName, "ja"));

  const actions = stores
    .flatMap((store) => store.actions)
    .sort((left, right) => STATUS_ORDER[left.status] - STATUS_ORDER[right.status])
    .slice(0, 3);

  const availableInputs = inputs.filter((input) => input.accountingState === "confirmed");
  const period = inputs[0]?.period || null;
  const lastUpdatedAt = inputs.map((input) => input.lastUpdatedAt).filter(Boolean).sort().at(-1) || null;
  const allMetrics = (key: string, label: string) => ({
    label,
    items: inputs.map((input) => metric(input, key, label)),
  });
  const executiveMetric = (key: string, label: string): ProjectionMetric =>
    executiveMetrics[key] || {
      label,
      displayValue: null,
      dataState: "preparing",
      reason: "Accounting projectionの全社集計を準備しています",
    };

  return {
    contractVersion: "store-sales-projection-v1",
    generatedAt,
    accounting: {
      period,
      confirmationState: inputs.length > 0 && availableInputs.length === inputs.length
        ? "confirmed"
        : availableInputs.length > 0 ? "collecting" : "preparing",
      lastUpdatedAt,
      reflectedStoreCount: availableInputs.length,
      totalStoreCount: inputs.length,
    },
    executiveSummary: {
      metrics: [
        executiveMetric("sales", "全社売上（税抜）"),
        executiveMetric("operatingProfit", "営業利益"),
        executiveMetric("ordinaryProfit", "経常利益"),
        executiveMetric("grossProfitMargin", "売上総利益率"),
        executiveMetric("operatingProfitMargin", "営業利益率"),
        executiveMetric("ordinaryProfitMargin", "経常利益率"),
      ],
      needsAttentionStoreCount: stores.filter((store) => store.status === "Needs Attention").length,
    },
    priorityActions: actions,
    businessDrivers: {
      results: [allMetrics("sales", "売上"), allMetrics("operatingProfit", "利益")],
      customer: [allMetrics("totalRepeat", "Total Repeat")],
      value: [
        allMetrics("totalTicket", "Total Ticket"),
        allMetrics("technicalTicket", "Technical"),
        allMetrics("retailTicket", "Retail"),
        allMetrics("regularRetail", "Regular"),
        allMetrics("mid", "MID"),
      ],
      operations: [
        allMetrics("totalRepeat", "Total Repeat"),
        allMetrics("productivity", "Productivity"),
        allMetrics("retailPurchaseRate", "Retail Purchase Rate"),
      ],
    },
    stores,
  };
}
