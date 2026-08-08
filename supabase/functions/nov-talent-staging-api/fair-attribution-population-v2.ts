const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;

export const FAIR_ATTRIBUTION_POPULATION_V2 = Object.freeze({
  environment: "idea-nov-staging",
  projectRef: "zgkoofphhivesclehrom",
  manifestVersion: "fair-attribution-queue-population-manifest-v2",
  manifestFileSha256: "ecbadebb2a4b6bb6e0d4484193bd4088bc9f36ebf9fdbe8b56f8634be604d34b",
  manifestCanonicalPayloadSha256: "db225936b21cd026496dba583aaae8b7ef215cc00fb54bc686698044506e0c53",
  candidateFairPairPayloadSha256: "074db42b222ec1230dbefdccd099f708b272bca385760a3bc3b7679a053dbc09",
  sourceContractVersion: "fair-attribution-source-hash-contract-v1",
  sourceRangeSha256: "394728af93cee9beaa56e38df23a716e8ccbedfc0ec37bb490263370e2d843d9",
  candidateSnapshotContractVersion: "fair-attribution-candidate-snapshot-v1",
  candidateSnapshotSha256: "01783932dc8cae65ef840dfa1e43becc41ebbb0e536b972d43017cadc141d1a3",
  fairSnapshotContractVersion: "fair-attribution-fair-snapshot-v1",
  fairSnapshotSha256: "766ba161ce59d326599c641e9d8531b19482bfd25dfa1ff2714bde240a8beca3",
  groupingContractVersion: "fair-attribution-grouping-contract-v1",
  logicalCandidateCount: 161,
  singleCandidateCount: 121,
  multipleCandidateCount: 40,
  physicalPendingRowCount: 201,
  excludedNonFairCount: 367,
  candidateTotal: 636,
  graduation2027Count: 528,
  graduation2028Count: 108,
  fairTotal: 82,
  fairActive: 46,
  fairInactive: 36,
});

type JsonRecord = Record<string, unknown>;
export type PopulationRequest = {
  manifest: JsonRecord;
  manifestJson: string;
  sourceRangeValues: unknown[];
};

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: JsonRecord, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const fixed = [...expected].sort();
  return actual.length === fixed.length && actual.every((key, index) => key === fixed[index]);
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(sorted(value));
}

export async function sha256Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function cleanPopulationRequest(value: unknown): PopulationRequest | null {
  if (!isRecord(value) || !exactKeys(value, ["manifestJson", "sourceRangeValues"])) return null;
  if (typeof value.manifestJson !== "string" || value.manifestJson.length < 2 || value.manifestJson.length > 1_000_000
    || !Array.isArray(value.sourceRangeValues)) return null;
  let manifest: unknown;
  try { manifest = JSON.parse(value.manifestJson); } catch { return null; }
  if (!isRecord(manifest)) return null;
  return { manifest, manifestJson: value.manifestJson, sourceRangeValues: value.sourceRangeValues };
}

function integer(value: unknown, expected: number) {
  return Number.isInteger(value) && value === expected;
}

function hash(value: unknown, expected: string) {
  return typeof value === "string" && SHA256.test(value) && value === expected;
}

function sourcePayload(values: unknown[]) {
  if (values.length !== 528) throw new Error("SOURCE_RANGE_CARDINALITY_INVALID");
  return {
    contract_version: FAIR_ATTRIBUTION_POPULATION_V2.sourceContractVersion,
    spreadsheet_values: values.map((value, index) => ({ row: index + 3, value: value === undefined ? null : value })),
  };
}

export async function validatePopulationRequest(request: PopulationRequest) {
  const c = FAIR_ATTRIBUTION_POPULATION_V2;
  if (await sha256Utf8(request.manifestJson) !== c.manifestFileSha256) throw new Error("MANIFEST_FILE_HASH_MISMATCH");
  const manifest = request.manifest;
  if (!exactKeys(manifest, [
    "manifest_version", "created_at", "source_contract_version", "source", "candidate_snapshot",
    "fair_snapshot", "legacy_evidence", "grouping_contract_version", "population_counts", "validation",
    "cases", "manifest_canonical_payload_sha256",
  ])) throw new Error("MANIFEST_ROOT_CONTRACT_INVALID");

  const embeddedHash = manifest.manifest_canonical_payload_sha256;
  if (!hash(embeddedHash, c.manifestCanonicalPayloadSha256)) throw new Error("MANIFEST_CANONICAL_HASH_MISMATCH");
  const canonicalPayload = { ...manifest };
  delete canonicalPayload.manifest_canonical_payload_sha256;
  if (await sha256Utf8(canonicalJson(canonicalPayload)) !== c.manifestCanonicalPayloadSha256) {
    throw new Error("MANIFEST_CANONICAL_PAYLOAD_INVALID");
  }
  if (manifest.manifest_version !== c.manifestVersion || manifest.source_contract_version !== c.sourceContractVersion
    || manifest.grouping_contract_version !== c.groupingContractVersion) throw new Error("MANIFEST_VERSION_INVALID");

  const source = manifest.source;
  if (!isRecord(source) || !exactKeys(source, ["spreadsheet_id", "sheet_id", "range", "value_render_option", "source_range_sha256"])
    || source.spreadsheet_id !== "1nwlOIdQMmPq4ogXOTf-oinAQKnwSTlb3X7Dw8kWowCM" || source.sheet_id !== 1142586954
    || source.range !== "G3:G530" || source.value_render_option !== "UNFORMATTED_VALUE"
    || !hash(source.source_range_sha256, c.sourceRangeSha256)) throw new Error("SOURCE_CONTRACT_INVALID");
  if (await sha256Utf8(canonicalJson(sourcePayload(request.sourceRangeValues))) !== c.sourceRangeSha256) {
    throw new Error("SOURCE_RANGE_HASH_MISMATCH");
  }

  const candidate = manifest.candidate_snapshot;
  if (!isRecord(candidate) || !exactKeys(candidate, ["contract_version", "total_count", "graduation_2027_count", "graduation_2028_count", "snapshot_sha256"])
    || candidate.contract_version !== c.candidateSnapshotContractVersion || !integer(candidate.total_count, c.candidateTotal)
    || !integer(candidate.graduation_2027_count, c.graduation2027Count) || !integer(candidate.graduation_2028_count, c.graduation2028Count)
    || !hash(candidate.snapshot_sha256, c.candidateSnapshotSha256)) throw new Error("CANDIDATE_SNAPSHOT_CONTRACT_INVALID");

  const fair = manifest.fair_snapshot;
  if (!isRecord(fair) || !exactKeys(fair, ["contract_version", "total_count", "active_count", "inactive_count", "snapshot_sha256"])
    || fair.contract_version !== c.fairSnapshotContractVersion || !integer(fair.total_count, c.fairTotal)
    || !integer(fair.active_count, c.fairActive) || !integer(fair.inactive_count, c.fairInactive)
    || !hash(fair.snapshot_sha256, c.fairSnapshotSha256)) throw new Error("FAIR_SNAPSHOT_CONTRACT_INVALID");

  const counts = manifest.population_counts;
  if (!isRecord(counts) || !exactKeys(counts, ["logical_candidate_count", "single_candidate_count", "multiple_candidate_count", "physical_pending_row_count", "max_fair_candidates_per_candidate", "excluded_non_fair_count"])
    || !integer(counts.logical_candidate_count, c.logicalCandidateCount) || !integer(counts.single_candidate_count, c.singleCandidateCount)
    || !integer(counts.multiple_candidate_count, c.multipleCandidateCount) || !integer(counts.physical_pending_row_count, c.physicalPendingRowCount)
    || !integer(counts.max_fair_candidates_per_candidate, 2) || !integer(counts.excluded_non_fair_count, c.excludedNonFairCount)) {
    throw new Error("POPULATION_COUNTS_INVALID");
  }
  const validation = manifest.validation;
  if (!isRecord(validation) || !exactKeys(validation, ["candidate_unresolved_count", "inactive_fair_count", "orphan_fair_count", "duplicate_candidate_fair_pair_count", "source_evidence_missing_count", "invalid_attribution_count", "result"])
    || validation.result !== "PASS" || !["candidate_unresolved_count", "inactive_fair_count", "orphan_fair_count", "duplicate_candidate_fair_pair_count", "source_evidence_missing_count", "invalid_attribution_count"].every((key) => integer(validation[key], 0))) {
    throw new Error("MANIFEST_VALIDATION_NOT_PASS");
  }

  if (!Array.isArray(manifest.cases) || manifest.cases.length !== c.logicalCandidateCount) throw new Error("LOGICAL_CASE_COUNT_INVALID");
  const candidateIds = new Set<string>();
  const pairs = new Set<string>();
  const canonicalPairRows: string[] = [];
  let single = 0;
  let multiple = 0;
  for (const item of manifest.cases) {
    if (!isRecord(item) || !exactKeys(item, ["candidate_id", "source_rows", "fair_candidate_ids", "fair_candidate_count", "attribution_type", "attribution_status", "review_required", "source_evidence"])) {
      throw new Error("CASE_CONTRACT_INVALID");
    }
    if (typeof item.candidate_id !== "string" || !UUID.test(item.candidate_id) || candidateIds.has(item.candidate_id)) throw new Error("CANDIDATE_ID_INVALID");
    candidateIds.add(item.candidate_id);
    if (!Array.isArray(item.source_rows) || item.source_rows.length !== 1 || !Number.isInteger(item.source_rows[0])
      || Number(item.source_rows[0]) < 3 || Number(item.source_rows[0]) > 530) throw new Error("SOURCE_ROW_INVALID");
    if (!Array.isArray(item.fair_candidate_ids) || item.fair_candidate_ids.length < 1 || item.fair_candidate_ids.length > 2
      || item.fair_candidate_count !== item.fair_candidate_ids.length) throw new Error("FAIR_CANDIDATE_COUNT_INVALID");
    if (item.attribution_type !== "ORIGIN" || item.attribution_status !== "PENDING" || item.review_required !== true) throw new Error("PENDING_ONLY_CONTRACT_INVALID");
    if (typeof item.source_evidence !== "string" || !/^[A-Za-z0-9:_-]{1,64}$/u.test(item.source_evidence)) throw new Error("SOURCE_EVIDENCE_INVALID");
    if (item.fair_candidate_ids.length === 1) single += 1; else multiple += 1;
    for (const fairId of item.fair_candidate_ids) {
      if (typeof fairId !== "string" || !UUID.test(fairId)) throw new Error("FAIR_ID_INVALID");
      const key = `${item.candidate_id}:${fairId}`;
      if (pairs.has(key)) throw new Error("DUPLICATE_CANDIDATE_FAIR_PAIR");
      pairs.add(key);
      canonicalPairRows.push(`${item.candidate_id}|${fairId}|${item.source_rows[0]}|${item.source_evidence}`);
    }
  }
  if (single !== c.singleCandidateCount || multiple !== c.multipleCandidateCount || pairs.size !== c.physicalPendingRowCount) {
    throw new Error("GROUPING_CONTRACT_INVALID");
  }
  canonicalPairRows.sort();
  if (await sha256Utf8(canonicalPairRows.join("\n")) !== c.candidateFairPairPayloadSha256) {
    throw new Error("CANDIDATE_FAIR_PAIR_PAYLOAD_MISMATCH");
  }
  return { logicalCandidateCount: candidateIds.size, physicalPendingRowCount: pairs.size };
}
