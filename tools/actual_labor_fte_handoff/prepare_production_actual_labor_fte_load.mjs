import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const DATABASE_WRITE_CAPABILITY = false;

export const PRODUCTION_ACTUAL_LABOR_FTE_PROFILE = Object.freeze({
  projectRef: "nkmxevmioczcmnldreyo",
  actorEmployeeId: "369d9cd5-f6ba-4e53-9428-f631f0893469",
  handoffPackageSha256: "3D456AF80CFC2D60873A34E82F4A370CDE491884C604C3EB4ADBDC4777AF4157",
  handoffPackageByteSize: 689484,
  sourceWorkbookSha256: "7E04D2107876FCA9902D07F9CB548403B51529591CB431239399912A77BC3E16",
  correctedWorkbookSha256: "679ACF51066B12398E2DB5016A7A91EC1552B9C0F80A1FA7CE2518E5445F4303",
  packageRootSha256: "F1E69E596C10E381B7AD333C3E1E7B06598976B12965ED6EF685E821A56A3787",
  expectedCandidates: 671,
  expectedMonths: 36,
  expectedStores: 20,
  expectedCompanies: 6,
  expectedJuly2026Stores: 20,
  expectedJuly2026Minutes: 1700849,
  expectedJuly2026Hours: 28347.483333333334,
  expectedJuly2026FteSource: 163.1415937692,
});

export const KYARA_HALF_OWNER_DECISION = Object.freeze({
  decisionId: "OWNER_CONFIRMED_KYARA_HALF_IDEA_NOV_20260924",
  authority: "IDEA_NOV_GROUP_OWNER",
  confirmedDate: "2026-09-24",
  evidence: "OWNER_CLARIFICATION_RECORDED_FOR_PR_232",
  unitKey: "SALON:KYARAHALF",
  canonicalName: "KYARA HALF",
  storeType: "直営",
  storeCode: "0019",
  storeId: "ac20934d-ef15-4363-8c2f-759193c7fcc7",
  companyNo: "0001",
  companyId: "e4059116-bdb3-4e13-9763-bbc77bdfe062",
  periodFrom: "2023-09-01",
  periodThrough: "2026-08-01",
  expectedCanonicalRows: 36,
  legacyStagingOnlyMonthsPromotedToCanonical: Object.freeze([
    "2023-09-01",
    "2023-10-01",
    "2023-11-01",
    "2023-12-01",
    "2024-01-01",
  ]),
});

const COMPANY_IDS = Object.freeze({
  "0001": "e4059116-bdb3-4e13-9763-bbc77bdfe062",
  "0002": "f0d56e0d-62e1-4eba-a37a-17e396ab0b61",
  "0003": "becb6f4b-2222-406d-8315-1eed48717327",
  "0004": "127b2041-a61c-498e-9040-a9d0a8146182",
  "0005": "2dcb7eb1-3aa9-4f75-a439-471da534b2fb",
  "0006": "34afa056-2d7c-413a-b6ea-80e2620e003c",
});

const STORES = Object.freeze({
  "SALON:KYARAHALF": Object.freeze({
    storeId: KYARA_HALF_OWNER_DECISION.storeId,
    companyNo: KYARA_HALF_OWNER_DECISION.companyNo,
    storeCode: KYARA_HALF_OWNER_DECISION.storeCode,
    canonicalName: KYARA_HALF_OWNER_DECISION.canonicalName,
    storeType: KYARA_HALF_OWNER_DECISION.storeType,
    ownerDecisionId: KYARA_HALF_OWNER_DECISION.decisionId,
  }),
  "SALON:アネックス": Object.freeze({ storeId: "2980442d-95d9-4cee-8326-c43d077e9977", companyNo: "0001", storeCode: "0016", canonicalName: "アネックス" }),
  "SALON:上石神井": Object.freeze({ storeId: "1bcba30a-fc56-44a6-b96f-061d5f41a605", companyNo: "0001", storeCode: "0006", canonicalName: "上石神井" }),
  "SALON:下井草": Object.freeze({ storeId: "fec1e181-a59b-41b0-921d-6f999df9a3a6", companyNo: "0001", storeCode: "0009", canonicalName: "下井草" }),
  "SALON:久米川": Object.freeze({ storeId: "3ba5e54d-5f39-4bcd-b917-7daaea34a8e9", companyNo: "0003", storeCode: "0001", canonicalName: "久米川" }),
  "SALON:保谷": Object.freeze({ storeId: "73ee82b5-0e17-4035-afb4-85daf84656c5", companyNo: "0001", storeCode: "0007", canonicalName: "保谷" }),
  "SALON:国分寺": Object.freeze({ storeId: "71551fcf-d29d-4f26-8cd2-ad31016dce61", companyNo: "0004", storeCode: "0004", canonicalName: "国分寺" }),
  "SALON:所沢": Object.freeze({ storeId: "1285ac70-bd67-46ae-8ad8-77ab83ce3962", companyNo: "0001", storeCode: "0003", canonicalName: "所沢" }),
  "SALON:新所沢": Object.freeze({ storeId: "acc91785-d94e-46ec-84f2-28be7c9f1f4a", companyNo: "0002", storeCode: "0002", canonicalName: "新所沢" }),
  "SALON:東久留米": Object.freeze({ storeId: "02d29285-863f-483a-94b2-73633c17500e", companyNo: "0006", storeCode: "0010", canonicalName: "東久留米" }),
  "SALON:東大和": Object.freeze({ storeId: "e7bab6a5-28f1-4d69-9749-105a960a2af4", companyNo: "0001", storeCode: "0008", canonicalName: "東大和" }),
  "SALON:江古田": Object.freeze({ storeId: "4e5526cc-dd5f-470d-8086-7c3809d00e10", companyNo: "0001", storeCode: "0012", canonicalName: "江古田" }),
  "SALON:池袋": Object.freeze({ storeId: "36c222de-7f6e-42f2-8b99-c40ca9cbfc0d", companyNo: "0001", storeCode: "0017", canonicalName: "池袋" }),
  "SALON:石神井公園": Object.freeze({ storeId: "ad931406-f1cc-4bc2-b8e0-d3b1a8df07df", companyNo: "0001", storeCode: "0011", canonicalName: "石神井公園" }),
  "SALON:花小金井": Object.freeze({ storeId: "e7ecb022-d929-4324-9880-f8f1bbb93a26", companyNo: "0005", storeCode: "0014", canonicalName: "花小金井" }),
  "SALON:野方": Object.freeze({ storeId: "b898c63f-ea47-4b9b-91b4-11c8d92c19f7", companyNo: "0001", storeCode: "0018", canonicalName: "野方" }),
  "SALON:高田馬場": Object.freeze({ storeId: "887da14c-b145-4c87-9c4a-f36ea4b1b54b", companyNo: "0001", storeCode: "0005", canonicalName: "高田馬場" }),
  "SALON:鷺ノ宮": Object.freeze({ storeId: "b5a206dc-f46a-4fe6-bab7-e6f4bb492872", companyNo: "0002", storeCode: "0015", canonicalName: "鷺ノ宮" }),
  "SALON:立川": Object.freeze({ storeId: "5f66193f-bf37-4452-af2d-ae8c132de85f", companyNo: "0001", storeCode: "0020", canonicalName: "立川" }),
  "SALON:RoanebyBASSA": Object.freeze({ storeId: "62070a3c-c60f-4c8d-aaba-5f0fd24df795", companyNo: "0002", storeCode: "0021", canonicalName: "Roane" }),
});

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function fingerprint(value) {
  return sha256(Buffer.from(JSON.stringify(value), "utf8"));
}

function approximatelyEqual(left, right, epsilon = 1e-9) {
  return Math.abs(left - right) <= epsilon;
}

function monthToDate(month) {
  assert(/^\d{4}-(0[1-9]|1[0-2])$/u.test(month), "ACTUAL_LABOR_FTE_FISCAL_MONTH_INVALID");
  return `${month}-01`;
}

export function prepareActualLaborFteCandidate(fact) {
  assert(fact?.scope === "STORE", "ACTUAL_LABOR_FTE_STORE_SCOPE_REQUIRED");
  const mapping = STORES[fact.unit_key];
  assert(mapping, "ACTUAL_LABOR_FTE_STORE_MAPPING_MISSING");
  assert(fact.metric_code === "ACTUAL_LABOR_FTE", "ACTUAL_LABOR_FTE_METRIC_CODE_INVALID");
  assert(fact.definition_version === "ACTUAL_LABOR_FTE_173_76_V1", "ACTUAL_LABOR_FTE_DEFINITION_VERSION_INVALID");
  assert(Number.isFinite(fact.value_quantity) && fact.value_quantity > 0, "ACTUAL_LABOR_FTE_QUANTITY_INVALID");
  assert(Number.isFinite(fact.allocated_actual_work_minutes) && fact.allocated_actual_work_minutes > 0, "ACTUAL_LABOR_FTE_MINUTES_INVALID");
  assert(Number.isFinite(fact.allocated_actual_work_hours) && fact.allocated_actual_work_hours > 0, "ACTUAL_LABOR_FTE_HOURS_INVALID");
  assert(approximatelyEqual(fact.allocated_actual_work_hours, fact.allocated_actual_work_minutes / 60), "ACTUAL_LABOR_FTE_HOURS_MINUTES_MISMATCH");
  assert(fact.reference_hours === 173.76 && fact.reference_hours_type === "MONTHLY_FIXED", "ACTUAL_LABOR_FTE_REFERENCE_HOURS_INVALID");
  assert(approximatelyEqual(fact.value_quantity, fact.allocated_actual_work_hours / fact.reference_hours), "ACTUAL_LABOR_FTE_FORMULA_MISMATCH");
  assert(fact.actual_punch_store === false && fact.shift_backfill === false, "ACTUAL_LABOR_FTE_PROHIBITED_INTERPRETATION");
  assert(fact.allocation_method === "EMPLOYEE_MONTH_ACTUAL_HOURS_BY_SAME_MONTH_CANONICAL_STORE_FTE_RATIO", "ACTUAL_LABOR_FTE_ALLOCATION_METHOD_INVALID");
  assert(fact.null_semantics === "NO_CANONICAL_FACT_ROW_MEANS_MISSING_NULL", "ACTUAL_LABOR_FTE_NULL_SEMANTICS_INVALID");
  assert(fact.source_workbook_sha256 === PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.sourceWorkbookSha256, "ACTUAL_LABOR_FTE_SOURCE_WORKBOOK_SHA_INVALID");
  const companyId = COMPANY_IDS[mapping.companyNo];
  assert(companyId, "ACTUAL_LABOR_FTE_COMPANY_MAPPING_MISSING");
  const candidate = Object.freeze({
    source_scope: fact.scope,
    fiscal_month: monthToDate(fact.fiscal_month),
    source_unit_key: fact.unit_key,
    source_store_name: fact.store_name,
    source_company_no: mapping.companyNo,
    source_store_code: mapping.storeCode,
    canonical_store_name: mapping.canonicalName,
    company_id: companyId,
    store_id: mapping.storeId,
    company_mapping_entity_key: `company:${mapping.companyNo}`,
    store_mapping_entity_key: `store:${fact.unit_key}`,
    metric_code: fact.metric_code,
    quantity: Number(fact.value_quantity.toFixed(4)),
    source_value_quantity: fact.value_quantity,
    allocated_actual_work_minutes: fact.allocated_actual_work_minutes,
    allocated_actual_work_hours: fact.allocated_actual_work_hours,
    reference_hours: fact.reference_hours,
    reference_hours_type: fact.reference_hours_type,
    allocation_method: fact.allocation_method,
    actual_punch_store: fact.actual_punch_store,
    shift_backfill: fact.shift_backfill,
    null_semantics: fact.null_semantics,
    definition_version: fact.definition_version,
    source_type: "actual_labor_fte_handoff_v1",
    source_workbook_sha256: fact.source_workbook_sha256,
    ...(mapping.ownerDecisionId ? {
      canonical_store_type: mapping.storeType,
      corporate_affiliation_basis: mapping.ownerDecisionId,
    } : {}),
    raw_record_id: `ALFTE:${fingerprint({
      fiscal_month: fact.fiscal_month,
      unit_key: fact.unit_key,
      metric_code: fact.metric_code,
      definition_version: fact.definition_version,
      source_workbook_sha256: fact.source_workbook_sha256,
    }).toLowerCase()}`,
  });
  return Object.freeze({ candidate, fingerprintSha256: fingerprint(candidate) });
}

export function validateKyaraHalfOwnerDecision(candidates, decision = KYARA_HALF_OWNER_DECISION) {
  const facts = candidates
    .map((row) => row?.candidate ?? row)
    .filter((fact) => fact?.source_unit_key === decision.unitKey)
    .sort((left, right) => left.fiscal_month.localeCompare(right.fiscal_month));
  assert(facts.length === decision.expectedCanonicalRows, "KYARA_HALF_OWNER_CANONICAL_ROW_COUNT_MISMATCH");
  assert(facts[0]?.fiscal_month === decision.periodFrom
    && facts.at(-1)?.fiscal_month === decision.periodThrough, "KYARA_HALF_OWNER_PERIOD_MISMATCH");
  assert(facts.every((fact) => fact.source_company_no === decision.companyNo
    && fact.company_id === decision.companyId
    && fact.store_id === decision.storeId
    && fact.source_store_code === decision.storeCode
    && fact.canonical_store_type === decision.storeType
    && fact.corporate_affiliation_basis === decision.decisionId), "KYARA_HALF_OWNER_AFFILIATION_MISMATCH");
  for (const month of decision.legacyStagingOnlyMonthsPromotedToCanonical) {
    assert(facts.filter((fact) => fact.fiscal_month === month).length === 1, "KYARA_HALF_OWNER_PROMOTED_MONTH_MISSING");
  }
  return Object.freeze({
    ...decision,
    canonicalRows: facts.length,
    promotedLegacyStagingOnlyRows: decision.legacyStagingOnlyMonthsPromotedToCanonical.length,
  });
}

export function buildProductionActualLaborFteLoadPlan(pkg, profile = PRODUCTION_ACTUAL_LABOR_FTE_PROFILE) {
  assert(pkg?.package_type === "STORE_OPERATIONS_ACTUAL_LABOR_FTE_CANONICAL_HANDOFF", "ACTUAL_LABOR_FTE_PACKAGE_TYPE_INVALID");
  assert(pkg.package_version === "2026-09-24.2", "ACTUAL_LABOR_FTE_PACKAGE_VERSION_INVALID");
  assert(pkg.production_write_authorized === false, "ACTUAL_LABOR_FTE_SOURCE_MUST_BE_WRITE_INCAPABLE");
  assert(pkg.source_workbook_sha256 === profile.sourceWorkbookSha256, "ACTUAL_LABOR_FTE_PACKAGE_WORKBOOK_SHA_INVALID");
  assert(pkg.period?.from === "2023-09" && pkg.period?.through === "2026-08" && pkg.period?.source_month_count === profile.expectedMonths, "ACTUAL_LABOR_FTE_PERIOD_INVALID");
  assert(pkg.metric?.metric_code === "ACTUAL_LABOR_FTE"
    && pkg.metric?.definition_version === "ACTUAL_LABOR_FTE_173_76_V1"
    && pkg.metric?.value_kind === "quantity", "ACTUAL_LABOR_FTE_METRIC_CONTRACT_INVALID");
  assert(pkg.source_contract?.reference_hours === 173.76
    && pkg.source_contract?.source === "TIMECARD_ACTUALS_ONLY"
    && pkg.source_contract?.shift_backfill === false
    && pkg.source_contract?.missing_is_null === true
    && pkg.source_contract?.zero_is_formal_zero === true
    && pkg.source_contract?.actual_punch_store_interpretation === false, "ACTUAL_LABOR_FTE_SOURCE_CONTRACT_INVALID");
  assert(pkg.fte_allocation_contract?.timecard_affiliation_used_for_store_determination === false
    && pkg.fte_allocation_contract?.actual_punch_store_interpretation === false
    && pkg.fte_allocation_contract?.fte_source_value_mismatches === 0, "ACTUAL_LABOR_FTE_ALLOCATION_CONTRACT_INVALID");
  assert(Array.isArray(pkg.canonical_store_month_facts)
    && pkg.canonical_store_month_facts.length === profile.expectedCandidates, "ACTUAL_LABOR_FTE_CANDIDATE_COUNT_MISMATCH");
  assert(Array.isArray(pkg.unallocated_employee_month_audit)
    && pkg.unallocated_employee_month_audit.length === 445, "ACTUAL_LABOR_FTE_UNALLOCATED_AUDIT_COUNT_MISMATCH");
  assert(pkg.expected_counts?.canonical_store_month_facts === profile.expectedCandidates
    && pkg.expected_counts?.unique_store_month_keys === profile.expectedCandidates
    && pkg.expected_counts?.july_2026_store_facts === profile.expectedJuly2026Stores
    && pkg.expected_counts?.unallocated_nonzero_employee_months === 445
    && pkg.expected_counts?.excluded_legacy_timecard_store_override_rows === 56, "ACTUAL_LABOR_FTE_EXPECTED_COUNTS_INVALID");

  const prepared = pkg.canonical_store_month_facts.map(prepareActualLaborFteCandidate);
  const kyaraHalfOwnerDecision = validateKyaraHalfOwnerDecision(prepared);
  const grains = new Set();
  const fingerprints = new Set();
  const months = new Set();
  const stores = new Set();
  const companies = new Set();
  for (const row of prepared) {
    const fact = row.candidate;
    const grain = [fact.fiscal_month, fact.company_id, fact.store_id, fact.metric_code].join("|");
    assert(!grains.has(grain), "ACTUAL_LABOR_FTE_DUPLICATE_GRAIN");
    assert(!fingerprints.has(row.fingerprintSha256), "ACTUAL_LABOR_FTE_DUPLICATE_FINGERPRINT");
    grains.add(grain);
    fingerprints.add(row.fingerprintSha256);
    months.add(fact.fiscal_month);
    stores.add(fact.store_id);
    companies.add(fact.company_id);
  }
  assert(grains.size === profile.expectedCandidates, "ACTUAL_LABOR_FTE_UNIQUE_GRAIN_COUNT_MISMATCH");
  assert(months.size === profile.expectedMonths, "ACTUAL_LABOR_FTE_MONTH_COUNT_MISMATCH");
  assert(stores.size === profile.expectedStores, "ACTUAL_LABOR_FTE_STORE_COUNT_MISMATCH");
  assert(companies.size === profile.expectedCompanies, "ACTUAL_LABOR_FTE_COMPANY_COUNT_MISMATCH");
  const july = prepared.filter(({ candidate }) => candidate.fiscal_month === "2026-07-01").map(({ candidate }) => candidate);
  assert(july.length === profile.expectedJuly2026Stores, "ACTUAL_LABOR_FTE_JULY_STORE_COUNT_MISMATCH");
  assert(approximatelyEqual(july.reduce((sum, row) => sum + row.allocated_actual_work_minutes, 0), profile.expectedJuly2026Minutes, 1e-6), "ACTUAL_LABOR_FTE_JULY_MINUTES_MISMATCH");
  assert(approximatelyEqual(july.reduce((sum, row) => sum + row.allocated_actual_work_hours, 0), profile.expectedJuly2026Hours, 1e-6), "ACTUAL_LABOR_FTE_JULY_HOURS_MISMATCH");
  assert(approximatelyEqual(july.reduce((sum, row) => sum + row.source_value_quantity, 0), profile.expectedJuly2026FteSource, 1e-9), "ACTUAL_LABOR_FTE_JULY_SOURCE_FTE_MISMATCH");

  return Object.freeze({
    status: "READY_FOR_OWNER_SEPARATE_PRODUCTION_WRITE_APPROVAL",
    databaseWriteCapability: DATABASE_WRITE_CAPABILITY,
    productionProjectRef: profile.projectRef,
    packageSha256: profile.handoffPackageSha256,
    packageRootSha256: profile.packageRootSha256,
    sourceWorkbookSha256: profile.sourceWorkbookSha256,
    ownerDecisions: Object.freeze({ kyaraHalfCorporateAffiliation: kyaraHalfOwnerDecision }),
    mapping: Object.freeze({ matched: prepared.length, unmatched: 0, ambiguous: 0, hq: 0 }),
    productionPlan: Object.freeze({
      actualLaborFte: Object.freeze({ insert: prepared.length, supersede: 0, unchanged: 0 }),
      employeeAuditRows: Object.freeze({ insert: 0, status: "EXCLUDED_FROM_EXECUTION_ARTIFACT" }),
      businessWritesExecuted: 0,
    }),
    candidates: Object.freeze(prepared),
  });
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) result[argv[index]?.replace(/^--/u, "")] = argv[index + 1];
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  assert(args.source, "ACTUAL_LABOR_FTE_SOURCE_PATH_REQUIRED");
  const bytes = readFileSync(args.source);
  assert(bytes.length === PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.handoffPackageByteSize, "ACTUAL_LABOR_FTE_PACKAGE_BYTE_SIZE_MISMATCH");
  assert(sha256(bytes) === PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.handoffPackageSha256, "ACTUAL_LABOR_FTE_PACKAGE_SHA256_MISMATCH");
  const plan = buildProductionActualLaborFteLoadPlan(JSON.parse(bytes.toString("utf8")));
  const summary = { ...plan, candidates: undefined, candidateCount: plan.candidates.length };
  if (args.out) {
    mkdirSync(args.out, { recursive: true });
    writeFileSync(join(args.out, "production-actual-labor-fte-load-plan.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
