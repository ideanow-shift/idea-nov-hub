import { DbfRuntimeError } from "./domain.ts";

type Json = Record<string, unknown>;

export const PRODUCTION_PROJECT_REF = "nkmxevmioczcmnldreyo";
export const PRODUCTION_PILOT_GATE = "OWNER_APPROVED_STORE_MONTHLY_PILOT_V1";
export const PRODUCTION_PILOT_MANIFEST_REF =
  "db6c78fdf791a7cbf35921eefb8367bca73eff4b07f00110b5741fb874487019";

const ACTUAL_METRICS = Object.freeze([
  "NEW_CUSTOMERS",
  "NEW_REPEAT_RATE",
  "RETAIL_PURCHASE_RATE",
  "RETAIL_SALES",
  "TECHNICAL_PRODUCTIVITY",
  "TECHNICAL_SALES",
  "TECHNICAL_UNIT_PRICE",
  "TOTAL_CUSTOMERS",
  "TOTAL_PRODUCTIVITY",
  "TOTAL_SALES",
  "TOTAL_UNIT_PRICE",
]);
const BUDGET_METRICS = Object.freeze(["RETAIL_SALES", "TECHNICAL_SALES", "TOTAL_SALES"]);
const PILOT_STORE_KEYS = Object.freeze(["ikebukuro", "kamishakujii"]);
const PILOT_STORE_NAMES = Object.freeze({
  ikebukuro: "BASSA池袋店",
  kamishakujii: "BASSA上石神井店",
} as const);
const PILOT_STORE_IDS = Object.freeze({
  ikebukuro: "36c222de-0554-4265-b177-3b68285cc4a4",
  kamishakujii: "1bcba30a-d063-4cdb-be74-425e250aeb25",
} as const);
const PILOT_COMPANY_KEY = "0001";
const PILOT_COMPANY_ID = "e4059116-bdb3-4e13-9763-bbc77bdfe062";
const PILOT_SOURCE_SYSTEM = "store-monthly-pilot-20260909";

export type ProductionPilotBatch = {
  fileName: string;
  fileSha256: string;
  byteSize: number;
  factKind: "store_operating_result" | "budget";
  fiscalMonth: string;
  sourceType: string;
  rowCount: number;
  rawRowsDigest: string;
  validatedRowsDigest: string;
  metricCodes: readonly string[];
};

export const PRODUCTION_PILOT_BATCHES: readonly ProductionPilotBatch[] = Object.freeze([
  Object.freeze({
    fileName: "2025-06-pilot-store-actual.csv",
    fileSha256: "72bff469bf2d027e054176661445661fbb860a740cf30d1a937f38fb7f1946f9",
    byteSize: 1430,
    factKind: "store_operating_result",
    fiscalMonth: "2025-06",
    sourceType: "store_monthly_previous_year_actual",
    rowCount: 22,
    rawRowsDigest: "28a30c5ce0259cb70e42ad216eeec5c95562cba75c8c2e5b5d23171588d85bff",
    validatedRowsDigest: "85168a82142e150a545be7ded1473ae3a8c73dce449c283d9fc037a8f7833f0d",
    metricCodes: ACTUAL_METRICS,
  }),
  Object.freeze({
    fileName: "2026-06-pilot-store-actual.csv",
    fileSha256: "b30972436958601e69580e07a3a3ff969c7781c5997d87dde3cef47b8a9655f9",
    byteSize: 1422,
    factKind: "store_operating_result",
    fiscalMonth: "2026-06",
    sourceType: "store_monthly_actual",
    rowCount: 22,
    rawRowsDigest: "278df4fe2709879ab2cae8d5589b0c39d894d718e60f63b3d89118aab0734667",
    validatedRowsDigest: "6d7e4aae6e2dbd3c4a2f159bdf8618fea4301496f2c912e38318702d6b36ae8c",
    metricCodes: ACTUAL_METRICS,
  }),
  Object.freeze({
    fileName: "2026-06-pilot-store-budget.csv",
    fileSha256: "bef80ca154226012ad44c59ce500cf91593425ed0289e5b1ef8dd16507acbac1",
    byteSize: 474,
    factKind: "budget",
    fiscalMonth: "2026-06",
    sourceType: "store_monthly_budget",
    rowCount: 6,
    rawRowsDigest: "2eeadc686fbae814d2a44c6f85813a88326cfd6d761f92292c8b6233834c69c5",
    validatedRowsDigest: "b2e1e7440d737c68b8c32283cb78023aecc0d5b924396946a0e882e3a6828d9e",
    metricCodes: BUDGET_METRICS,
  }),
]);

function object(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DbfRuntimeError("PRODUCTION_PILOT_CONTRACT_REJECTED");
  }
  return value as Json;
}

function exactKeys(value: Json, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new DbfRuntimeError("PRODUCTION_PILOT_CONTRACT_REJECTED");
  }
}

async function sha256Json(value: unknown) {
  const bytes = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  ));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function batchForStart(payload: Json) {
  const file = object(payload.file);
  const batch = PRODUCTION_PILOT_BATCHES.find((candidate) =>
    candidate.fileName === file.originalFileName &&
    candidate.fileSha256 === file.sha256 &&
    candidate.byteSize === file.byteSize &&
    candidate.factKind === payload.factKind &&
    `${candidate.fiscalMonth}-01` === payload.fiscalMonth &&
    candidate.sourceType === payload.sourceType && file.mediaType === "text/csv"
  );
  if (!batch || payload.sourceSystem !== PILOT_SOURCE_SYSTEM || payload.correctionOfBatchId !== null ||
    payload.correctionReason !== null || !Array.isArray(payload.rawRows) || payload.rawRows.length !== batch.rowCount) {
    throw new DbfRuntimeError("PRODUCTION_PILOT_SOURCE_REJECTED", 403);
  }
  return batch;
}

function canonicalRawPayload(batch: ProductionPilotBatch, candidate: unknown) {
  const row = object(candidate);
  if (batch.factKind === "store_operating_result") {
    exactKeys(row, [
      "fiscal_month", "company_key", "store_key", "metric_code", "value",
      "definition_version", "confirmation_status",
    ]);
    return {
      fiscal_month: String(row.fiscal_month),
      company_key: String(row.company_key),
      store_key: String(row.store_key),
      metric_code: String(row.metric_code),
      value: String(row.value),
      definition_version: String(row.definition_version),
      confirmation_status: String(row.confirmation_status),
    };
  }
  exactKeys(row, [
    "fiscal_month", "company_key", "store_key", "scenario_code", "account_code",
    "metric_code", "amount", "confirmation_status",
  ]);
  return {
    fiscal_month: String(row.fiscal_month),
    company_key: String(row.company_key),
    store_key: String(row.store_key),
    scenario_code: String(row.scenario_code),
    account_code: String(row.account_code),
    metric_code: String(row.metric_code),
    amount: String(row.amount),
    confirmation_status: String(row.confirmation_status),
  };
}

function assertRawSemanticScope(batch: ProductionPilotBatch, rawRows: Array<{ sourceRowNumber: number; payload: Json }>) {
  const grains = new Set<string>();
  for (const { payload } of rawRows) {
    if (payload.fiscal_month !== batch.fiscalMonth || payload.company_key !== PILOT_COMPANY_KEY ||
      !PILOT_STORE_KEYS.includes(String(payload.store_key)) ||
      !batch.metricCodes.includes(String(payload.metric_code)) || payload.confirmation_status !== "confirmed") {
      throw new DbfRuntimeError("PRODUCTION_PILOT_SCOPE_REJECTED", 403);
    }
    if (batch.factKind === "store_operating_result" && payload.definition_version !== "v1") {
      throw new DbfRuntimeError("PRODUCTION_PILOT_SCOPE_REJECTED", 403);
    }
    if (batch.factKind === "budget" && (payload.scenario_code !== "BASE" || payload.account_code !== "")) {
      throw new DbfRuntimeError("PRODUCTION_PILOT_SCOPE_REJECTED", 403);
    }
    const numeric = Number(batch.factKind === "budget" ? payload.amount : payload.value);
    if (!Number.isFinite(numeric)) throw new DbfRuntimeError("PRODUCTION_PILOT_SOURCE_REJECTED", 403);
    const grain = `${payload.store_key}:${payload.metric_code}`;
    if (grains.has(grain)) throw new DbfRuntimeError("PRODUCTION_PILOT_DUPLICATE_REJECTED", 409);
    grains.add(grain);
  }
  if (grains.size !== batch.rowCount) throw new DbfRuntimeError("PRODUCTION_PILOT_SCOPE_REJECTED", 403);
}

export async function assertProductionPilotStart(payload: Json) {
  const batch = batchForStart(payload);
  const rawRows = (payload.rawRows as unknown[]).map((candidate, index) => {
    const row = object(candidate);
    const sourceRowNumber = Number(row.sourceRowNumber);
    if (sourceRowNumber !== index + 1) throw new DbfRuntimeError("PRODUCTION_PILOT_SOURCE_REJECTED", 403);
    return { sourceRowNumber, payload: canonicalRawPayload(batch, row.payload) };
  });
  assertRawSemanticScope(batch, rawRows);
  if (await sha256Json(rawRows) !== batch.rawRowsDigest) {
    throw new DbfRuntimeError("PRODUCTION_PILOT_SOURCE_DIGEST_REJECTED", 409);
  }
  return batch;
}

export function assertProductionPilotMappingAction(action: string, payload: Json) {
  if (payload.sourceSystem !== PILOT_SOURCE_SYSTEM) throw new DbfRuntimeError("PRODUCTION_PILOT_MAPPING_REJECTED", 403);
  if (action === "dbfImportResolveMappingsV1") {
    if (!Array.isArray(payload.requests)) throw new DbfRuntimeError("PRODUCTION_PILOT_MAPPING_REJECTED", 403);
    const actual = (payload.requests as Array<Json>).map((row) => `${row.entityType}:${row.sourceKey}`).sort();
    const expected = ["company:0001", "store:ikebukuro", "store:kamishakujii"].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new DbfRuntimeError("PRODUCTION_PILOT_MAPPING_REJECTED", 403);
    return;
  }
  if (action === "dbfImportQuarantineMappingsV1") {
    if (!Array.isArray(payload.mappings)) throw new DbfRuntimeError("PRODUCTION_PILOT_MAPPING_REJECTED", 403);
    for (const row of payload.mappings as Array<Json>) {
      const key = `${row.entityType}:${row.sourceKey}`;
      if (!["company:0001", "store:ikebukuro", "store:kamishakujii"].includes(key)) {
        throw new DbfRuntimeError("PRODUCTION_PILOT_MAPPING_REJECTED", 403);
      }
    }
    return;
  }
  const key = `${payload.entityType}:${payload.sourceKey}`;
  if (!["company:0001", "store:ikebukuro", "store:kamishakujii"].includes(key)) {
    throw new DbfRuntimeError("PRODUCTION_PILOT_MAPPING_REJECTED", 403);
  }
}

type PilotCanonicalContext = {
  companyId: string;
  storesById: Map<string, string>;
  storeIds: string[];
};

export function resolveProductionPilotCanonicalContext(masterValue: unknown): PilotCanonicalContext {
  const master = object(masterValue);
  const companies = Array.isArray(master.companies) ? master.companies.map(object) : [];
  const stores = Array.isArray(master.stores) ? master.stores.map(object) : [];
  const companyMatches = companies.filter((row) => row.code === PILOT_COMPANY_KEY);
  if (companyMatches.length !== 1) throw new DbfRuntimeError("PRODUCTION_PILOT_CANONICAL_REJECTED", 409);
  const companyId = String(companyMatches[0].id || "").toLowerCase();
  if (companyId !== PILOT_COMPANY_ID) throw new DbfRuntimeError("PRODUCTION_PILOT_CANONICAL_REJECTED", 409);
  const selected = stores.filter((row) => PILOT_STORE_KEYS.includes(String(row.code)));
  if (selected.length !== PILOT_STORE_KEYS.length || selected.some((row) =>
    String(row.companyId).toLowerCase() !== companyId ||
    PILOT_STORE_NAMES[String(row.code) as keyof typeof PILOT_STORE_NAMES] !== String(row.name) ||
    PILOT_STORE_IDS[String(row.code) as keyof typeof PILOT_STORE_IDS] !== String(row.id).toLowerCase()
  )) {
    throw new DbfRuntimeError("PRODUCTION_PILOT_CANONICAL_REJECTED", 409);
  }
  const storesById = new Map(selected.map((row) => [String(row.id).toLowerCase(), String(row.code)]));
  if (storesById.size !== PILOT_STORE_KEYS.length) throw new DbfRuntimeError("PRODUCTION_PILOT_CANONICAL_REJECTED", 409);
  return { companyId, storesById, storeIds: [...storesById.keys()].sort() };
}

function batchForValidated(payload: Json) {
  const matches = PRODUCTION_PILOT_BATCHES.filter((candidate) =>
    candidate.factKind === payload.factKind && `${candidate.fiscalMonth}-01` === payload.fiscalMonth
  );
  if (matches.length !== 1 || !Array.isArray(payload.rows) || payload.rows.length !== matches[0].rowCount ||
    !Array.isArray(payload.warnings) || payload.warnings.length !== 0) {
    throw new DbfRuntimeError("PRODUCTION_PILOT_VALIDATION_REJECTED", 403);
  }
  return matches[0];
}

export async function buildProductionPilotContract(payload: Json, masterValue: unknown) {
  const batch = batchForValidated(payload);
  const canonical = resolveProductionPilotCanonicalContext(masterValue);
  const rows = (payload.rows as Array<Json>).map((row) => {
    const storeId = String(row.storeId || "").toLowerCase();
    const storeKey = canonical.storesById.get(storeId);
    const normalizedPayload = object(row.normalizedPayload);
    if (!storeKey || String(row.companyId || "").toLowerCase() !== canonical.companyId ||
      normalizedPayload.confirmationStatus !== "confirmed") {
      throw new DbfRuntimeError("PRODUCTION_PILOT_SCOPE_REJECTED", 403);
    }
    const sourceRowNumber = Number(row.sourceRowNumber);
    if (batch.factKind === "store_operating_result") {
      const metricCode = String(row.metricCode || "");
      const value = Number(row.amount ?? row.quantity ?? row.rate);
      return {
        sourceRowNumber,
        fiscalMonth: batch.fiscalMonth,
        companyKey: PILOT_COMPANY_KEY,
        storeKey,
        metricCode,
        value,
        definitionVersion: String(normalizedPayload.definitionVersion || ""),
        confirmationStatus: String(normalizedPayload.confirmationStatus || ""),
      };
    }
    return {
      sourceRowNumber,
      fiscalMonth: batch.fiscalMonth,
      companyKey: PILOT_COMPANY_KEY,
      storeKey,
      scenarioCode: String(normalizedPayload.scenarioCode || ""),
      accountCode: row.accountCode ?? null,
      metricCode: row.metricCode ?? null,
      amount: Number(row.amount),
      confirmationStatus: String(normalizedPayload.confirmationStatus || ""),
    };
  }).sort((left, right) => Number(left.sourceRowNumber) - Number(right.sourceRowNumber));
  if (rows.some((row, index) => Number(row.sourceRowNumber) !== index + 1) ||
    await sha256Json(rows) !== batch.validatedRowsDigest) {
    throw new DbfRuntimeError("PRODUCTION_PILOT_VALIDATED_DIGEST_REJECTED", 409);
  }
  return productionPilotRpcContract(batch, canonical);
}

export function batchFromPilotPreflight(value: unknown) {
  const result = object(value);
  const batch = PRODUCTION_PILOT_BATCHES.find((candidate) =>
    result.manifestRef === PRODUCTION_PILOT_MANIFEST_REF &&
    result.fileSha256 === candidate.fileSha256 && result.factKind === candidate.factKind &&
    result.fiscalMonth === candidate.fiscalMonth && result.sourceType === candidate.sourceType &&
    Number(result.rowCount) === candidate.rowCount
  );
  if (!batch) throw new DbfRuntimeError("PRODUCTION_PILOT_BATCH_REJECTED", 409);
  return batch;
}

export function productionPilotRpcContract(batch: ProductionPilotBatch, canonical: PilotCanonicalContext) {
  return {
    manifestRef: PRODUCTION_PILOT_MANIFEST_REF,
    sourceSystem: PILOT_SOURCE_SYSTEM,
    fileSha256: batch.fileSha256,
    factKind: batch.factKind,
    fiscalMonth: batch.fiscalMonth,
    sourceType: batch.sourceType,
    rowCount: batch.rowCount,
    rawRowsDigest: batch.rawRowsDigest,
    validatedRowsDigest: batch.validatedRowsDigest,
    storeIds: canonical.storeIds,
    metricCodes: [...batch.metricCodes],
  };
}
