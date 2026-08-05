const DATA_STATES = new Set(["available", "collecting", "preparing", "unavailable", "validation_error"]);
const STORE_STATUSES = new Set(["Good", "Stable", "Improving", "Needs Attention"]);
const ACTOR_SCOPES = new Set(["all_group", "department", "own_store", "franchise", "denied"]);
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const PROFIT_STATES = new Set(["confirmed", "collecting", "preparing", "unavailable", "validation_error"]);
const PERCENT_DISPLAY = /^-?\d+(?:\.\d)?%$/;
const FORBIDDEN_KEYS = new Set([
  "source_workbook", "source_cell", "raw_fact_id", "numerator_amount", "denominator_amount",
  "approval_actor_id", "service_role", "service_role_key", "private_account_name"
]);

export class ProjectionContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProjectionContractError";
    this.code = code;
    this.status = 422;
    this.retryable = false;
  }
}

function fail(code, message) {
  throw new ProjectionContractError(code, message);
}

function record(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("SCHEMA_MISMATCH", `${path} must be an object.`);
  return value;
}

function array(value, path) {
  if (!Array.isArray(value)) fail("SCHEMA_MISMATCH", `${path} must be an array.`);
  return value;
}

function requiredText(value, path) {
  const text = String(value ?? "").trim();
  if (!text) fail("REQUIRED_FIELD_MISSING", `${path} is required.`);
  return text;
}

function period(value, path) {
  const text = requiredText(value, path);
  if (!PERIOD.test(text)) fail("INVALID_PERIOD", `${path} must be YYYY-MM.`);
  return text;
}

function state(value, path) {
  const text = requiredText(value, path);
  if (!DATA_STATES.has(text)) fail("INVALID_DATA_STATE", `${path} has an invalid state.`);
  return text;
}

function nullablePeriod(value, path) {
  return value === null || value === undefined || value === "" ? null : period(value, path);
}

function nullableNumber(value, path) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) fail("INVALID_NUMBER", `${path} must be number or null.`);
  return value;
}

function assertNoForbiddenKeys(value, path = "projection") {
  if (Array.isArray(value)) return value.forEach((child, index) => assertNoForbiddenKeys(child, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([key, child]) => {
    if (FORBIDDEN_KEYS.has(key)) fail("FORBIDDEN_FIELD", `${path}.${key} is not a consumer field.`);
    assertNoForbiddenKeys(child, `${path}.${key}`);
  });
}

function metric(value, path) {
  const source = record(value, path);
  const dataState = state(source.data_state, `${path}.data_state`);
  const rawValue = nullableNumber(source.value ?? null, `${path}.value`);
  const displayValue = source.display_value === null ? null : requiredText(source.display_value, `${path}.display_value`);
  if (dataState !== "available" && (rawValue !== null || displayValue !== null)) {
    fail("VALUE_STATE_CONFLICT", `${path} cannot expose a value unless available.`);
  }
  if (source.unit === "percent" && displayValue !== null && !PERCENT_DISPLAY.test(displayValue)) {
    fail("INVALID_PERCENT_DISPLAY", `${path}.display_value must have one decimal place at most and %.`);
  }
  return {
    label: requiredText(source.label ?? source.metric_code, `${path}.label`),
    value: rawValue,
    displayValue,
    unit: source.unit ?? null,
    dataState,
    reason: source.reason_code ? String(source.reason_code) : null,
    period: source.period ? period(source.period, `${path}.period`) : null,
    periodMode: source.period_mode ? String(source.period_mode) : null,
    confirmedPeriodLabel: source.confirmed_period_label ? String(source.confirmed_period_label) : null
  };
}

function metricsObject(value, path) {
  const source = record(value ?? {}, path);
  return Object.fromEntries(Object.entries(source).map(([key, item]) => [key, metric(item, `${path}.${key}`)]));
}

function action(value, path) {
  const source = record(value, path);
  return {
    id: requiredText(source.action_id, `${path}.action_id`),
    storeKey: source.store_id ? String(source.store_id) : null,
    storeName: source.store_name ? String(source.store_name) : "",
    status: source.severity === "attention" ? "Needs Attention" : source.severity === "improving" ? "Improving" : "Stable",
    reason: requiredText(source.reason, `${path}.reason`),
    recommendation: requiredText(source.title, `${path}.title`),
    ruleId: source.related_kpi ? String(source.related_kpi) : "projection-rule",
    detailLink: source.detail_link ? String(source.detail_link) : null
  };
}

function store(value, path) {
  const source = record(value, path);
  const storeStatus = requiredText(source.store_status, `${path}.store_status`);
  if (!STORE_STATUSES.has(storeStatus)) fail("INVALID_STORE_STATUS", `${path}.store_status is invalid.`);
  const metrics = {
    sales: metric(source.sales_gross, `${path}.sales_gross`),
    operatingProfit: metric(source.operating_profit, `${path}.operating_profit`),
    operatingProfitMargin: metric(source.operating_profit_margin, `${path}.operating_profit_margin`),
    ordinaryProfitMargin: metric(source.ordinary_profit_margin, `${path}.ordinary_profit_margin`),
    totalRepeat: metric(source.total_repeat, `${path}.total_repeat`),
    productivity: metric(source.productivity, `${path}.productivity`),
    ...metricsObject(source.detail_metrics ?? {}, `${path}.detail_metrics`)
  };
  const priorityRank = Number(source.priority_rank);
  if (!Number.isInteger(priorityRank) || priorityRank < 0) fail("INVALID_PRIORITY_RANK", `${path}.priority_rank is invalid.`);
  return {
    storeKey: requiredText(source.store_id, `${path}.store_id`),
    storeName: requiredText(source.store_name, `${path}.store_name`),
    ownership: source.ownership_type === null ? null : requiredText(source.ownership_type, `${path}.ownership_type`),
    area: source.area ?? null,
    areaManager: source.area_manager ?? null,
    monthlyFocus: source.monthly_focus ?? null,
    corporation: source.corporation ?? null,
    scopeKey: source.scope_key ? String(source.scope_key) : null,
    period: period(source.sales_period, `${path}.sales_period`),
    accountingState: state(source.data_state, `${path}.data_state`),
    lastUpdatedAt: source.last_updated_at ?? null,
    status: storeStatus,
    statusReason: requiredText(source.store_status_reason, `${path}.store_status_reason`),
    statusRuleId: source.status_rule_id ? String(source.status_rule_id) : "projection",
    priorityRank,
    metrics,
    actions: array(source.this_month_actions ?? [], `${path}.this_month_actions`).slice(0, 3)
      .map((item, index) => action(item, `${path}.this_month_actions[${index}]`))
  };
}

export function validateProjectionResponse(value) {
  assertNoForbiddenKeys(value);
  const root = record(value, "projection");
  const meta = record(root.meta, "projection.meta");
  const salesPeriod = period(meta.sales_period, "projection.meta.sales_period");
  const profitState = requiredText(meta.profit_state, "projection.meta.profit_state");
  if (!PROFIT_STATES.has(profitState)) fail("INVALID_PROFIT_STATE", "projection.meta.profit_state is invalid.");
  const confirmedPeriod = nullablePeriod(meta.confirmed_through_period, "projection.meta.confirmed_through_period");
  if (profitState === "confirmed" && !confirmedPeriod) fail("CONFIRMED_PERIOD_REQUIRED", "confirmed_through_period is required for confirmed profit.");
  if (confirmedPeriod && confirmedPeriod > salesPeriod) fail("PERIOD_CONFLICT", "Accounting confirmed period cannot be after sales period.");
  if (meta.profit_definition !== "store_operating_profit") fail("INVALID_PROFIT_DEFINITION", "Store operating profit is required.");
  if (meta.operating_margin_definition !== "operating_profit_over_sales_net") fail("INVALID_MARGIN_DEFINITION", "Operating margin must use tax-exclusive sales.");
  if (meta.head_office_allocation_included !== false) fail("HEAD_OFFICE_ALLOCATION_FORBIDDEN", "V1 must not include head-office allocation.");
  const actorScope = requiredText(meta.actor_scope, "projection.meta.actor_scope");
  if (!ACTOR_SCOPES.has(actorScope)) fail("INVALID_ACTOR_SCOPE", "projection.meta.actor_scope is invalid.");
  if (actorScope === "denied") fail("ACTOR_SCOPE_DENIED", "Projection denied this actor.");
  const sourceStores = array(root.stores, "projection.stores");
  if (actorScope === "own_store" && sourceStores.length > 1) {
    fail("ACTOR_SCOPE_MISMATCH", "Store manager projection contains multiple stores.");
  }
  const actorRole = requiredText(meta.actor_role ?? (actorScope === "own_store" ? "store_manager" : "representative"), "projection.meta.actor_role");
  validateProfitVisibility({ profitState, actorRole, executiveSummary: root.executive_summary, stores: sourceStores });
  const stores = sourceStores.map((item, index) => store(item, `projection.stores[${index}]`));
  const actorScopeKey = meta.actor_scope_key ? String(meta.actor_scope_key) : null;
  if (actorScope === "department" || actorScope === "franchise") {
    if (!actorScopeKey || stores.some((item) => item.scopeKey !== actorScopeKey)) {
      fail("ACTOR_SCOPE_MISMATCH", "Projection contains a store outside the server-resolved actor scope.");
    }
  }
  const ids = stores.map((item) => item.storeKey);
  if (new Set(ids).size !== ids.length) fail("DUPLICATE_STORE_ID", "Projection contains duplicate store IDs.");
  const sorted = stores.every((item, index) => index === 0 || stores[index - 1].priorityRank <= item.priorityRank);
  if (!sorted) fail("INVALID_PRIORITY_ORDER", "Projection stores are not ordered by priority_rank.");
  const executiveSource = record(root.executive_summary ?? {}, "projection.executive_summary");
  const executiveMetrics = metricsObject(executiveSource.metrics ?? {}, "projection.executive_summary.metrics");
  return {
    audience: actorScope === "own_store" ? "store_manager" : "executive",
    role: actorRole,
    meta: {
      salesPeriod,
      profitState,
      accountingConfirmedThroughPeriod: confirmedPeriod,
      confirmationState: state(meta.confirmation_state, "projection.meta.confirmation_state"),
      lastUpdatedAt: meta.last_updated_at ?? null,
      actorScope,
      actorScopeKey,
      reflectedStoreCount: nullableNumber(meta.reflected_store_count, "projection.meta.reflected_store_count"),
      accountingVersionId: requiredText(meta.accounting_version_id, "projection.meta.accounting_version_id"),
      kpiDefinitionSetVersion: requiredText(meta.kpi_definition_set_version, "projection.meta.kpi_definition_set_version"),
      projectionVersion: requiredText(meta.projection_version, "projection.meta.projection_version"),
      adapterMode: requiredText(meta.adapter_mode, "projection.meta.adapter_mode")
    },
    accounting: {
      period: confirmedPeriod,
      confirmedThroughPeriod: confirmedPeriod,
      profitState,
      salesPeriod,
      confirmationState: state(meta.confirmation_state, "projection.meta.confirmation_state"),
      lastUpdatedAt: meta.last_updated_at ?? null,
      reflectedStoreCount: Number(meta.reflected_store_count || 0),
      totalStoreCount: stores.length
    },
    executiveSummary: {
      metrics: Object.values(executiveMetrics),
      needsAttentionStoreCount: Number(executiveSource.needs_attention_store_count ?? 0),
      dataState: executiveSource.data_state ? state(executiveSource.data_state, "projection.executive_summary.data_state") : "preparing",
      reasonCode: executiveSource.reason_code ?? null
    },
    priorityActions: array(root.priority_actions ?? [], "projection.priority_actions")
      .slice(0, 3).map((item, index) => action(item, `projection.priority_actions[${index}]`)),
    businessDrivers: normalizeDrivers(root.business_drivers),
    trends: normalizeTrends(root.trends),
    stores,
    selectedStore: root.selected_store ?? null
  };
}

function validateProfitVisibility({ profitState, actorRole, executiveSummary, stores }) {
  const executiveMetrics = executiveSummary?.metrics || {};
  if (profitState !== "confirmed") {
    ["operatingProfit", "operatingProfitMargin", "ordinaryProfit"].forEach((key) => {
      assertMetricHidden(executiveMetrics[key], "projection.executive_summary.metrics." + key);
    });
    stores.forEach((item, index) => {
      assertMetricHidden(item.operating_profit, "projection.stores[" + index + "].operating_profit");
      assertMetricHidden(item.operating_profit_margin, "projection.stores[" + index + "].operating_profit_margin");
      assertMetricHidden(item.detail_metrics?.ordinaryProfit, "projection.stores[" + index + "].detail_metrics.ordinaryProfit");
    });
  }
  if (actorRole === "sales_manager" && stores.some((item) => item.ownership_type !== "Direct")) {
    fail("ACTOR_SCOPE_MISMATCH", "Sales manager projection must contain direct stores only.");
  }
  if (["sales_manager", "area_manager"].includes(actorRole)) {
    stores.forEach((item, index) => {
      if (item.ownership_type !== "FC") return;
      assertMetricHidden(item.operating_profit, "projection.stores[" + index + "].operating_profit");
      assertMetricHidden(item.operating_profit_margin, "projection.stores[" + index + "].operating_profit_margin");
      assertMetricHidden(item.detail_metrics?.ordinaryProfit, "projection.stores[" + index + "].detail_metrics.ordinaryProfit");
    });
  }
}

function assertMetricHidden(value, path) {
  if (!value) return;
  if (value.value !== null || value.display_value !== null || value.data_state === "available") {
    fail("UNCONFIRMED_PROFIT_EXPOSED", path + " must be null until formally confirmed.");
  }
}

function normalizeDrivers(value) {
  const source = record(value ?? {}, "projection.business_drivers");
  return Object.fromEntries(Object.entries(source).map(([group, entries]) => [
    group,
    array(entries, `projection.business_drivers.${group}`).map((entry, index) => {
      const item = record(entry, `projection.business_drivers.${group}[${index}]`);
      return { label: requiredText(item.label, `projection.business_drivers.${group}[${index}].label`), items: [metric(item.metric, `projection.business_drivers.${group}[${index}].metric`)] };
    })
  ]));
}

function normalizeTrends(value) {
  const source = value == null ? {} : record(value, "projection.trends");
  return Object.fromEntries(Object.entries(source).map(([metricCode, series]) => {
    const metricSeries = record(series, "projection.trends." + metricCode);
    return [metricCode, Object.fromEntries(Object.entries(metricSeries).map(([range, points]) => [
      range,
      array(points, "projection.trends." + metricCode + "." + range).map((point, index) => {
        const item = record(point, "projection.trends." + metricCode + "." + range + "[" + index + "]");
        return {
          period: period(item.period, "projection.trends." + metricCode + "." + range + "[" + index + "].period"),
          value: nullableNumber(item.value ?? null, "projection.trends." + metricCode + "." + range + "[" + index + "].value"),
          dataState: state(item.data_state, "projection.trends." + metricCode + "." + range + "[" + index + "].data_state")
        };
      })
    ]))];
  }));
}

export const PROJECTION_CONTRACT = Object.freeze({
  version: "store-sales-projection-v1",
  dataStates: [...DATA_STATES],
  storeStatuses: [...STORE_STATUSES],
  actorScopes: [...ACTOR_SCOPES],
  forbiddenConsumerFields: [...FORBIDDEN_KEYS]
});
