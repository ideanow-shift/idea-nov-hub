export const SALON_VISIT_2027_BACKFILL_PREFLIGHT_CONTRACT_VERSION = "1.0.0" as const;

export const SALON_VISIT_2027_BACKFILL = Object.freeze({
  projectRef: "zgkoofphhivesclehrom",
  reviewPackageSha256: "10c87773b376dddaf044dc1c3e2dd88e68b759e2a237df0e406a8a563a192540",
  canonicalSourceSha256: "ed954ba2a5553ab645d5050cd8ed036aad6e749435d09a9fcfe256255426c023",
  sourceEventCount: 4,
  storeVisitFactCount: 15,
  uniqueCandidateCount: 4,
  distinctStoreCount: 8,
  graduationYear: 2027,
  period: Object.freeze({ start: "2026-04-01", end: "2027-03-31" }),
  originalActorStatus: "UNAVAILABLE",
  canonicalBusinessUnitId: "30410b1b-16b8-48ef-8f7e-204a26862716",
  canonicalStores: Object.freeze([
    Object.freeze({ id: "1bcba30a-d063-4cdb-be74-425e250aeb25", code: "kamishakujii", corporationId: "e4059116-bdb3-4e13-9763-bbc77bdfe062" }),
    Object.freeze({ id: "36c222de-0554-4265-b177-3b68285cc4a4", code: "ikebukuro", corporationId: "e4059116-bdb3-4e13-9763-bbc77bdfe062" }),
    Object.freeze({ id: "5f66193f-d360-4967-b9c7-a100c8ee5e94", code: "tachikawa", corporationId: "e4059116-bdb3-4e13-9763-bbc77bdfe062" }),
    Object.freeze({ id: "71551fcf-853f-4cad-ac94-82b93e75de82", code: "kokubunnji", corporationId: "127b2041-a61c-498e-9040-a9d0a8146182" }),
    Object.freeze({ id: "887da14c-2c0d-46b3-8953-962c7c8dd590", code: "takadanobaba", corporationId: "e4059116-bdb3-4e13-9763-bbc77bdfe062" }),
    Object.freeze({ id: "ac20934d-ef15-4363-8c2f-759193c7fcc7", code: "kyarahalf", corporationId: "e4059116-bdb3-4e13-9763-bbc77bdfe062" }),
    Object.freeze({ id: "b898c63f-1cc1-42c5-be4f-916f24f49cb6", code: "nogata", corporationId: "e4059116-bdb3-4e13-9763-bbc77bdfe062" }),
    Object.freeze({ id: "e7ecb022-6b19-4952-bf4b-fbf5f4c53895", code: "hanakoganei", corporationId: "2dcb7eb1-3aa9-4f75-a439-471da534b2fb" }),
  ]),
  sourceEventGrain: "CANDIDATE_VISIT_DATE",
  factGrain: "CANDIDATE_VISIT_DATE_STORE",
  planningActualGrain: "UNIQUE_CANDIDATE",
  excludedScopes: Object.freeze([
    "CONTACT", "APPLICATION", "OFFERED", "OFFER_ACCEPTED", "RECRUITING_SPEND", "SELECTION", "FAIR", "PLANNING",
  ]),
});

type Row = Record<string, unknown>;

export function validateSalonVisitCanonicalStores(rows: unknown) {
  if (!Array.isArray(rows)) return false;
  const expected: Map<string, { id: string; code: string; corporationId: string }> =
    new Map(SALON_VISIT_2027_BACKFILL.canonicalStores.map((store) => [store.id, store]));
  const matched = rows.filter((value) => value && typeof value === "object" && expected.has(String((value as Row).id || "")));
  if (matched.length !== expected.size || new Set(matched.map((value) => String((value as Row).id))).size !== expected.size) return false;
  return matched.every((value) => {
    const row = value as Row;
    const formal = expected.get(String(row.id));
    return formal && row.is_active === true && String(row.store_id || "") === formal.code &&
      String(row.corporation_id || "") === formal.corporationId &&
      String(row.business_unit_id || "") === SALON_VISIT_2027_BACKFILL.canonicalBusinessUnitId;
  });
}

export function salonVisit2027BackfillEnvelope(row: Row | null, writesEnabled: boolean, canonicalStoresExact = false) {
  const state = String(row?.state || "UNAVAILABLE");
  const exact = row?.exact_preflight_passed === true;
  const validState = ["PASS", "BLOCKED", "COMPLETED", "VOIDED", "UNAVAILABLE"].includes(state);
  const valid = validState && typeof row?.review_package_sha256 === "string" &&
    typeof row?.canonical_source_sha256 === "string" &&
    String(row.review_package_sha256).toLowerCase() === SALON_VISIT_2027_BACKFILL.reviewPackageSha256 &&
    (state === "UNAVAILABLE" || String(row.canonical_source_sha256).toLowerCase() === SALON_VISIT_2027_BACKFILL.canonicalSourceSha256) &&
    row?.original_actor_status === "UNAVAILABLE";
  const safeState = valid ? (state === "PASS" && !canonicalStoresExact ? "BLOCKED" : state) : "UNAVAILABLE";
  return Object.freeze({
    ok: true,
    data: Object.freeze({
      recruiting_salon_visit_backfill_preflight_contract_version:
        SALON_VISIT_2027_BACKFILL_PREFLIGHT_CONTRACT_VERSION,
      state: safeState,
      exactPreflightPassed: valid && safeState === "PASS" && exact && canonicalStoresExact,
      canExecute: valid && safeState === "PASS" && exact && canonicalStoresExact && writesEnabled === true,
      canonicalStoreState: canonicalStoresExact ? "READY" : "UNAVAILABLE",
      reviewPackageSha256: SALON_VISIT_2027_BACKFILL.reviewPackageSha256.toUpperCase(),
      canonicalSourceSha256: SALON_VISIT_2027_BACKFILL.canonicalSourceSha256,
      sourceEventCount: integerOrNull(row?.source_event_count),
      storeVisitFactCount: integerOrNull(row?.store_visit_fact_count),
      uniqueCandidateCount: integerOrNull(row?.unique_candidate_count),
      distinctStoreCount: integerOrNull(row?.distinct_store_count),
      unexpectedSourceEventCount: integerOrNull(row?.unexpected_source_event_count),
      existingFactCount: integerOrNull(row?.existing_fact_count),
      originalActorStatus: SALON_VISIT_2027_BACKFILL.originalActorStatus,
      sourceEventGrain: SALON_VISIT_2027_BACKFILL.sourceEventGrain,
      factGrain: SALON_VISIT_2027_BACKFILL.factGrain,
      planningActualGrain: SALON_VISIT_2027_BACKFILL.planningActualGrain,
      preview: Object.freeze({
        graduationYear: SALON_VISIT_2027_BACKFILL.graduationYear,
        period: SALON_VISIT_2027_BACKFILL.period,
        sourceEventCount: SALON_VISIT_2027_BACKFILL.sourceEventCount,
        storeVisitFactCount: SALON_VISIT_2027_BACKFILL.storeVisitFactCount,
        planningUniqueCandidateCount: SALON_VISIT_2027_BACKFILL.uniqueCandidateCount,
        distinctStoreCount: SALON_VISIT_2027_BACKFILL.distinctStoreCount,
        excludedScopes: SALON_VISIT_2027_BACKFILL.excludedScopes,
      }),
    }),
  });
}

function integerOrNull(value: unknown) {
  return Number.isInteger(Number(value)) ? Number(value) : null;
}
