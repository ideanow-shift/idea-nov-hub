type JsonRecord = Record<string, unknown>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const DECIMAL = /^-?\d+(?:\.\d+)?$/u;
const MONTH = /^20\d{2}-(0[1-9]|1[0-2])$/u;
const OFFICIAL_STORE_BASELINE = Object.freeze({ total: 20, direct: 13, fc: 7 });

export const CORPORATE_ACCOUNTING_COMPANY_ID =
  "e4059116-bdb3-4e13-9763-bbc77bdfe062";

export class ConsumerReadError extends Error {
  constructor(public code: string, public status = 503) {
    super(code);
  }
}

function object(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConsumerReadError(code);
  }
  return value as JsonRecord;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizedMonth(value: unknown): string {
  const month = text(value);
  if (!MONTH.test(month)) {
    throw new ConsumerReadError("INVALID_FISCAL_MONTH", 400);
  }
  return `${month}-01`;
}

type CanonicalCompany = { id: string; code: string; name: string };
type OfficialStore = {
  rawId: string;
  companyId: string;
  storeKey: string;
  storeName: string;
  corporationName: string;
  ownership: "DIRECT" | "FC";
};

export function resolveCorporateCompany(
  masterValue: unknown,
): CanonicalCompany {
  const master = object(masterValue, "CANONICAL_MASTER_OPTIONS_UNAVAILABLE");
  const companies = Array.isArray(master.companies) ? master.companies : [];
  const candidates = companies.map((value) =>
    object(value, "CANONICAL_MASTER_OPTIONS_INVALID")
  )
    .filter((row) =>
      text(row.id).toLowerCase() === CORPORATE_ACCOUNTING_COMPANY_ID
    );
  if (candidates.length !== 1) {
    throw new ConsumerReadError("CORPORATE_COMPANY_SCOPE_UNAVAILABLE");
  }
  const row = candidates[0];
  const id = text(row.id).toLowerCase();
  const code = text(row.code);
  const name = text(row.name);
  if (!UUID.test(id) || !code || !name) {
    throw new ConsumerReadError("CORPORATE_COMPANY_SCOPE_INVALID");
  }
  return { id, code, name };
}

export function resolveOfficialOperatingStores(
  masterValue: unknown,
  projectionValue: unknown,
): OfficialStore[] {
  const master = object(masterValue, "CANONICAL_MASTER_OPTIONS_UNAVAILABLE");
  const projection = object(
    projectionValue,
    "OFFICIAL_STORE_PROJECTION_UNAVAILABLE",
  );
  const masterCompanies = Array.isArray(master.companies)
    ? master.companies
    : [];
  const masterStores = Array.isArray(master.stores) ? master.stores : [];
  const projectedStores = Array.isArray(projection.stores)
    ? projection.stores
    : [];
  if (projectedStores.length !== OFFICIAL_STORE_BASELINE.total) {
    throw new ConsumerReadError("OFFICIAL_STORE_BASELINE_REJECTED");
  }

  const companyById = new Map<string, CanonicalCompany>();
  for (const value of masterCompanies) {
    const row = object(value, "CANONICAL_MASTER_OPTIONS_INVALID");
    const id = text(row.id).toLowerCase();
    const code = text(row.code);
    const name = text(row.name);
    if (!UUID.test(id) || !code || !name || companyById.has(id)) {
      throw new ConsumerReadError("CANONICAL_COMPANY_SET_INVALID");
    }
    companyById.set(id, { id, code, name });
  }

  const storeByCode = new Map<string, JsonRecord>();
  for (const value of masterStores) {
    const row = object(value, "CANONICAL_MASTER_OPTIONS_INVALID");
    const code = text(row.code);
    if (!code || storeByCode.has(code)) {
      throw new ConsumerReadError("CANONICAL_STORE_SET_INVALID");
    }
    storeByCode.set(code, row);
  }

  const seen = new Set<string>();
  const stores = projectedStores.map((value) => {
    const row = object(value, "OFFICIAL_STORE_PROJECTION_INVALID");
    const storeKey = text(row.storeKey);
    const storeName = text(row.storeName);
    const corporationName = text(row.corporationName);
    const ownership = text(row.ownership).toUpperCase();
    if (
      !storeKey || !storeName || !corporationName ||
      !["DIRECT", "FC"].includes(ownership) || seen.has(storeKey)
    ) {
      throw new ConsumerReadError("OFFICIAL_STORE_PROJECTION_INVALID");
    }
    seen.add(storeKey);
    const canonical = storeByCode.get(storeKey);
    if (!canonical) {
      throw new ConsumerReadError("OFFICIAL_STORE_CANONICAL_BINDING_REJECTED");
    }
    const rawId = text(canonical.id).toLowerCase();
    const companyId = text(canonical.companyId).toLowerCase();
    const canonicalName = text(canonical.name);
    const company = companyById.get(companyId);
    if (
      !UUID.test(rawId) || !UUID.test(companyId) ||
      canonicalName !== storeName || company?.name !== corporationName
    ) {
      throw new ConsumerReadError("OFFICIAL_STORE_CANONICAL_BINDING_REJECTED");
    }
    return {
      rawId,
      companyId,
      storeKey,
      storeName,
      corporationName,
      ownership: ownership as "DIRECT" | "FC",
    };
  });

  const direct = stores.filter((store) => store.ownership === "DIRECT").length;
  const fc = stores.filter((store) => store.ownership === "FC").length;
  if (
    direct !== OFFICIAL_STORE_BASELINE.direct ||
    fc !== OFFICIAL_STORE_BASELINE.fc
  ) {
    throw new ConsumerReadError("OFFICIAL_STORE_BASELINE_REJECTED");
  }
  return stores;
}

export function buildStoreMonthlyActualProjection(
  selectedMonth: unknown,
  stores: OfficialStore[],
  factValue: unknown,
) {
  const fiscalMonth = normalizedMonth(selectedMonth);
  const facts = Array.isArray(factValue) ? factValue : [];
  const storeById = new Map(stores.map((store) => [store.rawId, store]));
  const factsByStore = new Map<string, JsonRecord[]>();
  for (const value of facts) {
    const fact = object(value, "STORE_MONTHLY_FACT_INVALID");
    const storeId = text(fact.store_id).toLowerCase();
    const companyId = text(fact.company_id).toLowerCase();
    const store = storeById.get(storeId);
    const metricCode = text(fact.metric_code);
    const valueKind = text(fact.value_kind);
    const metricValue = text(fact.metric_value);
    const sourceFileSha256 = text(fact.source_file_sha256).toLowerCase();
    const factVersion = Number(fact.fact_version);
    if (
      !store || store.companyId !== companyId ||
      text(fact.fiscal_month) !== fiscalMonth || !metricCode ||
      !["amount", "quantity", "rate"].includes(valueKind) ||
      !DECIMAL.test(metricValue) ||
      !SHA256.test(sourceFileSha256) || !Number.isInteger(factVersion) ||
      factVersion < 1
    ) {
      throw new ConsumerReadError("STORE_MONTHLY_FACT_INVALID");
    }
    const current = factsByStore.get(storeId) || [];
    if (current.some((item) => text(item.metric_code) === metricCode)) {
      throw new ConsumerReadError("STORE_MONTHLY_FACT_DUPLICATE");
    }
    current.push(fact);
    factsByStore.set(storeId, current);
  }

  const projectedStores = stores.map((store) => {
    const storeFacts = (factsByStore.get(store.rawId) || [])
      .sort((left, right) =>
        text(left.metric_code).localeCompare(text(right.metric_code), "en")
      );
    return {
      storeKey: store.storeKey,
      storeName: store.storeName,
      corporationName: store.corporationName,
      ownership: store.ownership,
      fiscalMonth: fiscalMonth.slice(0, 7),
      dataState: storeFacts.length ? "confirmed" : "preparing",
      metrics: storeFacts.map((fact) => ({
        metricCode: text(fact.metric_code),
        valueKind: text(fact.value_kind),
        value: text(fact.metric_value),
        definitionVersion: text(fact.definition_version),
        displayName: text(fact.display_name),
        description: text(fact.description),
        sourceEvidence: {
          sourceType: text(fact.source_type),
          sourceFileSha256: text(fact.source_file_sha256).toLowerCase(),
          importedAt: text(fact.imported_at),
          factVersion: Number(fact.fact_version),
        },
      })),
    };
  });

  return {
    contractVersion: "STORE_MONTHLY_ACTUAL_V1",
    fiscalMonth: fiscalMonth.slice(0, 7),
    scope: {
      mode: "all",
      serverResolved: true,
      rawStoreIdsReturned: false,
      operatingStoreBaseline: { ...OFFICIAL_STORE_BASELINE },
      visibleStoreCount: projectedStores.length,
    },
    readiness: {
      confirmedStoreCount:
        projectedStores.filter((store) => store.dataState === "confirmed")
          .length,
      missingStoreCount:
        projectedStores.filter((store) => store.dataState === "preparing")
          .length,
      factRowCount: facts.length,
      missingDataPolicy: "preparing-not-zero",
    },
    responsibility: {
      operatingMetrics: "public.dbf_store_monthly_metric_facts",
      corporateFinancialLineItems: "public.dbf_pl_detail_facts",
      corporateFinancialLineItemsIncluded: false,
    },
    stores: projectedStores,
  };
}

export function buildCorporateAccountingActualProjection(
  selectedMonth: unknown,
  company: CanonicalCompany,
  factValue: unknown,
) {
  const fiscalMonth = normalizedMonth(selectedMonth);
  const facts = Array.isArray(factValue) ? factValue : [];
  const seen = new Set<string>();
  const lines = facts.map((value) => {
    const fact = object(value, "CORPORATE_ACCOUNTING_FACT_INVALID");
    const companyId = text(fact.company_id).toLowerCase();
    const statementType = text(fact.statement_type);
    const lineType = text(fact.line_type);
    const accountCode = text(fact.account_code);
    const accountName = text(fact.account_name);
    const amount = text(fact.amount_value);
    const sourceFileSha256 = text(fact.source_file_sha256).toLowerCase();
    const factVersion = Number(fact.fact_version);
    const key = `${statementType}:${lineType}:${accountCode}`;
    if (
      companyId !== company.id || text(fact.fiscal_month) !== fiscalMonth ||
      !["pl", "bs"].includes(statementType) ||
      !["detail", "aggregate", "balance"].includes(lineType) ||
      !accountCode || !accountName || !DECIMAL.test(amount) ||
      !SHA256.test(sourceFileSha256) ||
      !Number.isInteger(factVersion) || factVersion < 1 || seen.has(key)
    ) {
      throw new ConsumerReadError("CORPORATE_ACCOUNTING_FACT_INVALID");
    }
    seen.add(key);
    return {
      statementType,
      lineType,
      accountCode,
      accountName,
      amount,
      classification: text(fact.classification) || null,
      aggregateScope: text(fact.aggregate_scope) || null,
      rowSemantics: text(fact.row_semantics) || null,
      additive: fact.is_additive === true,
      sourceEvidence: {
        sourceType: text(fact.source_type),
        sourceFileSha256,
        importedAt: text(fact.imported_at),
        factVersion,
      },
    };
  });

  return {
    contractVersion: "CORPORATE_ACCOUNTING_ACTUAL_READ_V1",
    fiscalMonth: fiscalMonth.slice(0, 7),
    company: { code: company.code, name: company.name },
    scope: { serverResolved: true, rawIdsReturned: false },
    dataState: lines.length ? "confirmed" : "preparing",
    lineCount: lines.length,
    missingDataPolicy: "preparing-not-zero",
    lines,
  };
}
