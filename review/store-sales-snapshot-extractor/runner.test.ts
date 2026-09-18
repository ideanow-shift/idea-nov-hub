import { CURRENT_STORE_BASELINE } from "../../supabase/functions/store-sales-staging-api/contract.ts";
import { runSnapshotExtraction, validateArtifactAndManifest } from "./runner.ts";
import { FIXED_QUERY_IDS, type FixedQueryId, type QueryRow, type ReadOnlySession, type SnapshotRunPolicy } from "./types.ts";

class FakeReadOnlySession implements ReadOnlySession {
  rollbackCount = 0; closeCount = 0; queryCount = 0;
  constructor(readonly rows: Partial<Record<FixedQueryId, QueryRow[]>>, readonly throwOn?: FixedQueryId) {}
  async beginReadOnly() {} async setStatementTimeout(_: number) {} async setLockTimeout(_: number) {}
  async runFixedQuery(id: FixedQueryId) { this.queryCount++; if (id === this.throwOn) throw new Error("fixture"); return this.rows[id] ?? []; }
  async rollback() { this.rollbackCount++; } async close() { this.closeCount++; }
}

const available = Object.fromEntries(FIXED_QUERY_IDS.map((id) => [id, "unavailable"])) as Record<FixedQueryId, "available" | "unavailable">;
available.Q01_STORE_MASTER = "available"; available.Q02_ACCOUNTING_CONFIRMED = "available"; available.Q08_LEGACY_CROSSWALK = "available";
const policy: SnapshotRunPolicy = { version: "v1-20260801-001", generatedAt: "2026-08-01T04:00:00.000Z", expiresAt: "2026-08-02T10:00:00.000Z", sourceConfirmedThroughPeriod: "2026-07", approvalStatus: "approved_for_extraction", sourceAvailability: available, maxQueryCount: 8, statementTimeoutMilliseconds: 5000, lockTimeoutMilliseconds: 1000 };
const stores = CURRENT_STORE_BASELINE.map(([store_code, store_class], index) => ({ canonical_store_id: `store-${index + 1}`, store_code, display_name: `Store ${index + 1}`, store_class, active: true, operator_code: store_class === "FC" ? `operator-${index}` : null, updated_at: "2026-08-01T00:00:00.000Z" }));
const baseRows = { Q01_STORE_MASTER: stores, Q02_ACCOUNTING_CONFIRMED: [{ canonical_store_id: "store-1", period: "2026-07", confirmed_through_period: "2026-07", total_revenue: 100, operating_profit: 10, operating_margin: 0.1, tax_basis: "exclusive", confirmed: true, availability: "available", updated_at: "2026-08-01T00:00:00.000Z" }], Q08_LEGACY_CROSSWALK: [{ legacy_reference: "legacy-tokorozawa", canonical_store_id: "store-1", crosswalk_version: "approved-v1", updated_at: "2026-08-01T00:00:00.000Z" }] } as Partial<Record<FixedQueryId, QueryRow[]>>;

Deno.test("fixture produces a sanitized immutable manifest and always rolls back", async () => {
  const fake = new FakeReadOnlySession(baseRows); const result = await runSnapshotExtraction(fake, policy);
  if (!result.ok) throw new Error(result.code);
  if (!(await validateArtifactAndManifest(result.artifact, result.manifest, new Date("2026-08-01T05:00:00Z")))) throw new Error("invalid manifest");
  if (fake.rollbackCount !== 1 || fake.closeCount !== 1 || fake.queryCount !== 3) throw new Error("read-only cleanup failure");
});
Deno.test("baseline mismatch, forbidden personal data, and query limit reject artifacts", async () => {
  const mismatch = new FakeReadOnlySession({ ...baseRows, Q01_STORE_MASTER: stores.slice(0, 19) });
  if ((await runSnapshotExtraction(mismatch, policy)).ok) throw new Error("baseline accepted");
  const personal = new FakeReadOnlySession({ ...baseRows, Q03_CUSTOMER_KPI: [{ email: "fixture@example.invalid" }] });
  const personalPolicy = { ...policy, sourceAvailability: { ...available, Q03_CUSTOMER_KPI: "available" as const } };
  if ((await runSnapshotExtraction(personal, personalPolicy)).ok) throw new Error("personal field accepted");
  const limited = new FakeReadOnlySession(baseRows);
  if ((await runSnapshotExtraction(limited, { ...policy, maxQueryCount: 2 })).ok) throw new Error("limit accepted");
  if (mismatch.rollbackCount !== 1 || personal.rollbackCount !== 1 || limited.rollbackCount !== 1) throw new Error("rollback missing");
});
Deno.test("expired and altered artifacts fail validation", async () => {
  const result = await runSnapshotExtraction(new FakeReadOnlySession(baseRows), policy); if (!result.ok) throw new Error(result.code);
  if (await validateArtifactAndManifest(result.artifact, result.manifest, new Date("2026-08-03T00:00:00Z"))) throw new Error("expired accepted");
  if (await validateArtifactAndManifest({ ...result.artifact, snapshotVersion: "altered" }, result.manifest, new Date("2026-08-01T05:00:00Z"))) throw new Error("altered accepted");
});
Deno.test("missing required columns and FC profit values reject the complete artifact", async () => {
  const missingColumn = new FakeReadOnlySession({ ...baseRows, Q01_STORE_MASTER: stores.map(({ updated_at, ...store }) => store) });
  if ((await runSnapshotExtraction(missingColumn, policy)).ok) throw new Error("missing column accepted");
  const fcProfit = new FakeReadOnlySession({ ...baseRows, Q02_ACCOUNTING_CONFIRMED: [{ canonical_store_id: "store-14", period: "2026-07", confirmed_through_period: "2026-07", total_revenue: 100, operating_profit: 10, operating_margin: 0.1, tax_basis: "exclusive", confirmed: true, availability: "available", updated_at: "2026-08-01T00:00:00.000Z" }] });
  if ((await runSnapshotExtraction(fcProfit, policy)).ok) throw new Error("FC profit accepted");
});
