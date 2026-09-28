export const SNAPSHOT_FORMAT = "store-sales-staging-snapshot-v1" as const;

export const FIXED_QUERY_IDS = [
  "Q01_STORE_MASTER", "Q02_ACCOUNTING_CONFIRMED", "Q03_CUSTOMER_KPI", "Q04_UNIT_PRICE",
  "Q05_PRODUCT_KPI", "Q06_EC_KPI", "Q07_AM_SCOPE", "Q08_LEGACY_CROSSWALK",
] as const;

export type FixedQueryId = typeof FIXED_QUERY_IDS[number];
export type SourceAvailability = "available" | "unavailable";
export type QueryRow = Record<string, unknown>;

export interface ReadOnlySession {
  beginReadOnly(): Promise<void>;
  setStatementTimeout(milliseconds: number): Promise<void>;
  setLockTimeout(milliseconds: number): Promise<void>;
  runFixedQuery(queryId: FixedQueryId): Promise<QueryRow[]>;
  rollback(): Promise<void>;
  close(): Promise<void>;
}

export interface SnapshotRunPolicy {
  version: string;
  generatedAt: string;
  expiresAt: string;
  sourceConfirmedThroughPeriod: string | null;
  approvalStatus: "approved_for_extraction";
  sourceAvailability: Readonly<Record<FixedQueryId, SourceAvailability>>;
  maxQueryCount: number;
  statementTimeoutMilliseconds: number;
  lockTimeoutMilliseconds: number;
}

export interface SnapshotArtifact {
  format: typeof SNAPSHOT_FORMAT;
  snapshotVersion: string;
  generatedAt: string;
  expiresAt: string;
  sourceConfirmedThroughPeriod: string | null;
  approvalStatus: "approved_for_extraction";
  queryIds: FixedQueryId[];
  rowCounts: Partial<Record<FixedQueryId, number>>;
  unavailableSources: FixedQueryId[];
  schemaVersion: "v1";
  stores: QueryRow[];
  accounting: QueryRow[];
  customerMetrics: QueryRow[];
  unitPriceMetrics: QueryRow[];
  productMetrics: QueryRow[];
  ecMetrics: QueryRow[];
  amScopeStatus: QueryRow[];
  legacyStoreReferences: QueryRow[];
}

export interface SnapshotManifest {
  snapshotVersion: string;
  generatedAt: string;
  expiresAt: string;
  sourceConfirmedThroughPeriod: string | null;
  queryIds: FixedQueryId[];
  rowCounts: Partial<Record<FixedQueryId, number>>;
  unavailableSources: FixedQueryId[];
  schemaVersion: "v1";
  artifactSha256: string;
  manifestSha256: string;
  approvalStatus: "approved_for_extraction";
}

export type ExtractionResult = { ok: true; artifact: SnapshotArtifact; manifest: SnapshotManifest }
  | { ok: false; code: "EXTRACTION_GATE_INVALID" | "QUERY_LIMIT_EXCEEDED" | "SANITIZATION_REJECTED" | "VALIDATION_REJECTED" | "READ_ONLY_QUERY_FAILED" };
