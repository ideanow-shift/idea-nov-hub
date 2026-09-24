import { CURRENT_STORE_BASELINE, type AccountingStoreProjection, type StoreMasterRow } from "./contract.ts";

export interface StoreSalesSnapshotManifest {
  format: "store-sales-staging-snapshot-v1";
  approvedAt: string;
  expiresAt: string;
  stores: StoreMasterRow[];
  accounting: AccountingStoreProjection[];
  legacyStoreReferences: Readonly<Record<string, string>>;
}

export type SnapshotValidation =
  | { ok: true; value: StoreSalesSnapshotManifest }
  | { ok: false; code: "SNAPSHOT_MISSING" | "SNAPSHOT_SHAPE_INVALID" | "SNAPSHOT_EXPIRED" | "STORE_MASTER_BASELINE_INVALID" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidStore(store: unknown): store is StoreMasterRow {
  if (!isRecord(store)) return false;
  return typeof store.canonicalStoreId === "string" && typeof store.storeCode === "string"
    && typeof store.displayName === "string" && (store.storeClass === "DIRECT" || store.storeClass === "FC")
    && typeof store.active === "boolean" && (typeof store.operatorCode === "string" || store.operatorCode === null);
}

function isValidAccounting(row: unknown): row is AccountingStoreProjection {
  if (!isRecord(row)) return false;
  return typeof row.canonicalStoreId === "string" && typeof row.period === "string"
    && typeof row.confirmedThroughPeriod === "string" && (typeof row.totalRevenue === "number" || row.totalRevenue === null)
    && (typeof row.operatingProfit === "number" || row.operatingProfit === null)
    && row.taxBasis === "exclusive" && typeof row.confirmed === "boolean";
}

function exactStoreBaseline(stores: StoreMasterRow[]): boolean {
  if (stores.length !== 20) return false;
  const actual = new Map(stores.map((store) => [store.storeCode, store.storeClass]));
  return actual.size === 20 && CURRENT_STORE_BASELINE.every(([code, storeClass]) => actual.get(code) === storeClass);
}

export function validateStoreSalesSnapshot(input: unknown, now = new Date()): SnapshotValidation {
  if (!isRecord(input)) return { ok: false, code: "SNAPSHOT_MISSING" };
  if (input.format !== "store-sales-staging-snapshot-v1" || typeof input.approvedAt !== "string" || typeof input.expiresAt !== "string"
    || !Array.isArray(input.stores) || !Array.isArray(input.accounting) || !isRecord(input.legacyStoreReferences)) {
    return { ok: false, code: "SNAPSHOT_SHAPE_INVALID" };
  }
  const expiresAt = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return { ok: false, code: "SNAPSHOT_EXPIRED" };
  if (!input.stores.every(isValidStore) || !input.accounting.every(isValidAccounting) || !exactStoreBaseline(input.stores)) {
    return { ok: false, code: "STORE_MASTER_BASELINE_INVALID" };
  }
  if (!Object.entries(input.legacyStoreReferences).every(([legacy, canonical]) => legacy.length > 0 && typeof canonical === "string" && canonical.length > 0)) {
    return { ok: false, code: "SNAPSHOT_SHAPE_INVALID" };
  }
  return { ok: true, value: input as unknown as StoreSalesSnapshotManifest };
}
