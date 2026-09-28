import { CURRENT_STORE_BASELINE } from "../../supabase/functions/store-sales-staging-api/contract.ts";
import { FIXED_QUERY_IDS, SNAPSHOT_FORMAT, type ExtractionResult, type FixedQueryId, type QueryRow, type ReadOnlySession, type SnapshotArtifact, type SnapshotManifest, type SnapshotRunPolicy } from "./types.ts";

const encoder = new TextEncoder();
const forbiddenKey = /(?:password|secret|token|credential|email|phone|customer|employee|journal|connection|host|uuid)/i;
const fieldAllowlist: Readonly<Record<FixedQueryId, readonly string[]>> = {
  Q01_STORE_MASTER: ["canonical_store_id", "store_code", "display_name", "store_class", "active", "operator_code", "updated_at"],
  Q02_ACCOUNTING_CONFIRMED: ["canonical_store_id", "period", "confirmed_through_period", "total_revenue", "operating_profit", "operating_margin", "tax_basis", "confirmed", "updated_at", "availability"],
  Q03_CUSTOMER_KPI: ["canonical_store_id", "period", "customer_count", "transaction_count", "availability", "updated_at"],
  Q04_UNIT_PRICE: ["canonical_store_id", "period", "total_unit_price", "technical_unit_price", "availability", "updated_at"],
  Q05_PRODUCT_KPI: ["canonical_store_id", "period", "product_revenue", "product_count", "availability", "updated_at"],
  Q06_EC_KPI: ["canonical_store_id", "period", "ec_revenue", "ec_count", "availability", "updated_at"],
  Q07_AM_SCOPE: ["store_code", "assignment_state", "scope_reference", "updated_at"],
  Q08_LEGACY_CROSSWALK: ["legacy_reference", "canonical_store_id", "crosswalk_version", "updated_at"],
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(canonicalJson(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sanitizeRows(queryId: FixedQueryId, rows: QueryRow[]): QueryRow[] | null {
  const allowlist = fieldAllowlist[queryId];
  const sanitized: QueryRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const keys = Object.keys(row);
    if (keys.some((key) => forbiddenKey.test(key) || !allowlist.includes(key))) return null;
    if (!allowlist.every((key) => keys.includes(key))) return null;
    if (keys.some((key) => row[key] !== null && typeof row[key] === "object")) return null;
    sanitized.push(Object.fromEntries(keys.map((key) => [key, row[key]])));
  }
  return sanitized;
}

function validStores(stores: QueryRow[]): boolean {
  if (stores.length !== 20) return false;
  const actual = new Map(stores.map((store) => [String(store.store_code), String(store.store_class)]));
  return actual.size === 20 && CURRENT_STORE_BASELINE.every(([code, storeClass]) => actual.get(code) === storeClass);
}

function validRows(queryId: FixedQueryId, rows: QueryRow[]): boolean {
  if (queryId === "Q01_STORE_MASTER") return validStores(rows);
  if (queryId === "Q02_ACCOUNTING_CONFIRMED") {
    return rows.every((row) => row.tax_basis === "exclusive" && typeof row.confirmed === "boolean"
      && (!row.confirmed ? row.operating_profit === null && row.total_revenue === null && row.operating_margin === null : true)
      && (row.availability !== "unavailable" || row.operating_profit === null));
  }
  if (queryId === "Q07_AM_SCOPE") return rows.every((row) => row.assignment_state === "assigned" || row.assignment_state === "unassigned");
  if (queryId === "Q08_LEGACY_CROSSWALK") return rows.length > 0 && rows.every((row) => typeof row.legacy_reference === "string" && typeof row.canonical_store_id === "string" && typeof row.crosswalk_version === "string");
  return true;
}

function validAccountingForStores(accounting: QueryRow[], stores: QueryRow[]): boolean {
  const storeClassById = new Map(stores.map((store) => [String(store.canonical_store_id), store.store_class]));
  return accounting.every((row) => {
    const isFc = storeClassById.get(String(row.canonical_store_id)) === "FC";
    const noProfit = row.operating_profit === null && row.total_revenue === null && row.operating_margin === null;
    return (!row.confirmed ? noProfit : true) && (!isFc || row.availability === "unavailable" && noProfit);
  });
}

function emptyArtifact(policy: SnapshotRunPolicy): SnapshotArtifact {
  return { format: SNAPSHOT_FORMAT, snapshotVersion: policy.version, generatedAt: policy.generatedAt, expiresAt: policy.expiresAt,
    sourceConfirmedThroughPeriod: policy.sourceConfirmedThroughPeriod, approvalStatus: policy.approvalStatus, queryIds: [], rowCounts: {}, unavailableSources: [], schemaVersion: "v1",
    stores: [], accounting: [], customerMetrics: [], unitPriceMetrics: [], productMetrics: [], ecMetrics: [], amScopeStatus: [], legacyStoreReferences: [] };
}

function assignRows(artifact: SnapshotArtifact, queryId: FixedQueryId, rows: QueryRow[]): void {
  const destination: Record<FixedQueryId, keyof SnapshotArtifact> = { Q01_STORE_MASTER: "stores", Q02_ACCOUNTING_CONFIRMED: "accounting", Q03_CUSTOMER_KPI: "customerMetrics", Q04_UNIT_PRICE: "unitPriceMetrics", Q05_PRODUCT_KPI: "productMetrics", Q06_EC_KPI: "ecMetrics", Q07_AM_SCOPE: "amScopeStatus", Q08_LEGACY_CROSSWALK: "legacyStoreReferences" };
  (artifact[destination[queryId]] as QueryRow[]) = rows;
}

export async function validateArtifactAndManifest(artifact: SnapshotArtifact, manifest: SnapshotManifest, now = new Date()): Promise<boolean> {
  if (artifact.format !== SNAPSHOT_FORMAT || Date.parse(artifact.expiresAt) <= now.getTime() || !validStores(artifact.stores)) return false;
  const artifactSha256 = await sha256(artifact);
  const withoutManifestHash = { ...manifest, manifestSha256: "" };
  return artifactSha256 === manifest.artifactSha256 && manifest.manifestSha256 === await sha256(withoutManifestHash);
}

export async function runSnapshotExtraction(session: ReadOnlySession, policy: SnapshotRunPolicy): Promise<ExtractionResult> {
  if (policy.maxQueryCount < 1 || policy.maxQueryCount > FIXED_QUERY_IDS.length || Date.parse(policy.expiresAt) <= Date.parse(policy.generatedAt)) return { ok: false, code: "EXTRACTION_GATE_INVALID" };
  let rollbackRequired = false;
  try {
    await session.beginReadOnly(); rollbackRequired = true;
    await session.setStatementTimeout(policy.statementTimeoutMilliseconds);
    await session.setLockTimeout(policy.lockTimeoutMilliseconds);
    const artifact = emptyArtifact(policy);
    for (const queryId of FIXED_QUERY_IDS) {
      if (policy.sourceAvailability[queryId] === "unavailable") { artifact.unavailableSources.push(queryId); continue; }
      if (artifact.queryIds.length >= policy.maxQueryCount) return { ok: false, code: "QUERY_LIMIT_EXCEEDED" };
      let rows: QueryRow[];
      try { rows = await session.runFixedQuery(queryId); } catch { return { ok: false, code: "READ_ONLY_QUERY_FAILED" }; }
      const sanitized = sanitizeRows(queryId, rows);
      if (!sanitized) return { ok: false, code: "SANITIZATION_REJECTED" };
      if (!validRows(queryId, sanitized)) return { ok: false, code: "VALIDATION_REJECTED" };
      artifact.queryIds.push(queryId); artifact.rowCounts[queryId] = sanitized.length; assignRows(artifact, queryId, sanitized);
    }
    if (!validStores(artifact.stores) || !artifact.queryIds.includes("Q08_LEGACY_CROSSWALK") || !validAccountingForStores(artifact.accounting, artifact.stores)) return { ok: false, code: "VALIDATION_REJECTED" };
    const artifactSha256 = await sha256(artifact);
    const partial = { snapshotVersion: artifact.snapshotVersion, generatedAt: artifact.generatedAt, expiresAt: artifact.expiresAt, sourceConfirmedThroughPeriod: artifact.sourceConfirmedThroughPeriod, queryIds: artifact.queryIds, rowCounts: artifact.rowCounts, unavailableSources: artifact.unavailableSources, schemaVersion: artifact.schemaVersion, artifactSha256, manifestSha256: "", approvalStatus: artifact.approvalStatus };
    const manifest = { ...partial, manifestSha256: await sha256(partial) } as SnapshotManifest;
    return { ok: true, artifact, manifest };
  } finally {
    if (rollbackRequired) await session.rollback();
    await session.close();
  }
}
