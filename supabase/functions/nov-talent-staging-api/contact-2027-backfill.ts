export const CONTACT_2027_BACKFILL_PREFLIGHT_CONTRACT_VERSION = "1.0.0" as const;
export const CONTACT_2027_BACKFILL = Object.freeze({
  projectRef: "zgkoofphhivesclehrom",
  reviewPackageSha256: "139d6b1b222cd7a7d820375c08e1b4ace811fc285ed89e27dd924d2bfb8c9125",
  canonicalSourceSha256: "725cc4b8ae933081dc30fd7ce37179741661d795a20edaed542023b4d3621a77",
  sourceEventCount: 11,
  uniqueCandidateCount: 10,
  graduationYear: 2027,
  period: Object.freeze({ start: "2026-04-01", end: "2027-03-31" }),
  originalActorStatus: "UNAVAILABLE",
  excludedScopes: Object.freeze([
    "SALON_VISIT", "APPLICATION", "OFFERED", "OFFER_ACCEPTED", "RECRUITING_SPEND", "OTHER_B_OR_C",
  ]),
});

type Row = Record<string, unknown>;

export function contact2027BackfillEnvelope(row: Row | null, writesEnabled: boolean) {
  const state = String(row?.state || "UNAVAILABLE");
  const exact = row?.exact_preflight_passed === true;
  const validState = ["PASS", "BLOCKED", "COMPLETED", "VOIDED", "UNAVAILABLE"].includes(state);
  const valid = validState && typeof row?.review_package_sha256 === "string" &&
    typeof row?.canonical_source_sha256 === "string" &&
    String(row.review_package_sha256).toLowerCase() === CONTACT_2027_BACKFILL.reviewPackageSha256 &&
    (state === "UNAVAILABLE" || String(row.canonical_source_sha256).toLowerCase() === CONTACT_2027_BACKFILL.canonicalSourceSha256) &&
    row?.original_actor_status === "UNAVAILABLE";
  const safeState = valid ? state : "UNAVAILABLE";
  return Object.freeze({
    ok: true,
    data: Object.freeze({
      recruiting_contact_backfill_preflight_contract_version:
        CONTACT_2027_BACKFILL_PREFLIGHT_CONTRACT_VERSION,
      state: safeState,
      exactPreflightPassed: valid && safeState === "PASS" && exact,
      canExecute: valid && safeState === "PASS" && exact && writesEnabled === true,
      reviewPackageSha256: CONTACT_2027_BACKFILL.reviewPackageSha256.toUpperCase(),
      canonicalSourceSha256: CONTACT_2027_BACKFILL.canonicalSourceSha256,
      sourceEventCount: valid && Number.isInteger(Number(row?.source_event_count)) ? Number(row?.source_event_count) : null,
      uniqueCandidateCount: valid && Number.isInteger(Number(row?.unique_candidate_count)) ? Number(row?.unique_candidate_count) : null,
      existingFactCount: valid && Number.isInteger(Number(row?.existing_fact_count)) ? Number(row?.existing_fact_count) : null,
      originalActorStatus: CONTACT_2027_BACKFILL.originalActorStatus,
      planningActualGrain: "UNIQUE_CANDIDATE",
      preview: Object.freeze({
        graduationYear: CONTACT_2027_BACKFILL.graduationYear,
        period: CONTACT_2027_BACKFILL.period,
        factEventCount: CONTACT_2027_BACKFILL.sourceEventCount,
        planningUniqueCandidateCount: CONTACT_2027_BACKFILL.uniqueCandidateCount,
        excludedScopes: CONTACT_2027_BACKFILL.excludedScopes,
      }),
    }),
  });
}
