import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { resolveStore } from "./generate_staging_sql.mjs";
import { HANDOFF_20260921_PROFILE, validateRetailPackage } from "./validate_handoff_packages.mjs";

export const DATABASE_WRITE_CAPABILITY = false;

export const PRODUCTION_RETAIL_PROFILE = Object.freeze({
  projectRef: "nkmxevmioczcmnldreyo",
  actorEmployeeId: "369d9cd5-f6ba-4e53-9428-f631f0893469",
  retailPackageSha256: "EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942",
  retailPackageByteSize: 3252873,
  packageRootSha256: "94CA104E062E3BCB2CB47910AA47F95F578C1BF9463196A2A4D9304E5A4ABBBA",
  expectedStoreInsertCount: 1492,
  existingRetailPurchaseRateRows: 4,
});

const COMPANY_IDS = Object.freeze({
  "0001": "e4059116-bdb3-4e13-9763-bbc77bdfe062",
  "0002": "f0d56e0d-62e1-4eba-a37a-17e396ab0b61",
  "0003": "becb6f4b-2222-406d-8315-1eed48717327",
  "0004": "127b2041-a61c-498e-9040-a9d0a8146182",
  "0005": "2dcb7eb1-3aa9-4f75-a439-471da534b2fb",
  "0006": "34afa056-2d7c-413a-b6ea-80e2620e003c",
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

export function prepareRetailProductionCandidate(fact) {
  assert(fact?.scope_type === "SALON", "PRODUCTION_RETAIL_SALON_SCOPE_REQUIRED");
  assert(fact.promotion_status === "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH", "PRODUCTION_RETAIL_PROMOTION_STATUS_INVALID");
  assert(Number.isInteger(fact.quantity) && fact.quantity >= 0, "PRODUCTION_RETAIL_QUANTITY_INVALID");
  const companyId = COMPANY_IDS[fact.company_no_at_month];
  assert(companyId, "PRODUCTION_RETAIL_COMPANY_MAPPING_MISSING");
  const [storeId, storeMappingSourceKey] = resolveStore(fact.unit_key, fact.fiscal_month);
  const candidate = Object.freeze({
    fiscal_month: `${fact.fiscal_month}-01`,
    company_id: companyId,
    store_id: storeId,
    store_mapping_source_key: storeMappingSourceKey,
    source_unit_key: fact.unit_key,
    metric_code: "RETAIL_PURCHASE_CUSTOMER_VISITS",
    quantity: fact.quantity,
    definition_version: "POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1",
    source_type: "pos_retail_purchase_customer_count_v1",
    source_sha256: String(fact.source_sha256).toUpperCase(),
    raw_record_id: fact.raw_record_id,
    total_customer_visits_for_validation: fact.total_customer_visits_for_validation,
    retail_purchase_rate_exact_candidate: fact.retail_purchase_rate_exact_candidate,
  });
  return Object.freeze({ candidate, fingerprintSha256: fingerprint(candidate) });
}

export function buildProductionRetailLoadPlan(pkg, {
  validationProfile = HANDOFF_20260921_PROFILE,
  expectedInsertCount = PRODUCTION_RETAIL_PROFILE.expectedStoreInsertCount,
  existingRateRows = PRODUCTION_RETAIL_PROFILE.existingRetailPurchaseRateRows,
} = {}) {
  const validation = validateRetailPackage(pkg, validationProfile);
  const promotable = pkg.facts.filter((fact) => fact.scope_type === "SALON"
    && fact.promotion_status === "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH");
  const prepared = promotable.map(prepareRetailProductionCandidate);
  assert(prepared.length === expectedInsertCount, "PRODUCTION_RETAIL_INSERT_COUNT_MISMATCH");
  const grains = new Set();
  const fingerprints = new Set();
  for (const row of prepared) {
    const grain = [row.candidate.fiscal_month, row.candidate.company_id, row.candidate.store_id, row.candidate.metric_code].join("|");
    assert(!grains.has(grain), "PRODUCTION_RETAIL_DUPLICATE_GRAIN");
    assert(!fingerprints.has(row.fingerprintSha256), "PRODUCTION_RETAIL_DUPLICATE_FINGERPRINT");
    grains.add(grain);
    fingerprints.add(row.fingerprintSha256);
  }
  return Object.freeze({
    status: "READY_FOR_OWNER_SEPARATE_PRODUCTION_WRITE_APPROVAL",
    databaseWriteCapability: DATABASE_WRITE_CAPABILITY,
    productionProjectRef: PRODUCTION_RETAIL_PROFILE.projectRef,
    packageSha256: PRODUCTION_RETAIL_PROFILE.retailPackageSha256,
    packageRootSha256: PRODUCTION_RETAIL_PROFILE.packageRootSha256,
    validation,
    mapping: Object.freeze({ matched: prepared.length, unmatched: 0, ambiguous: 0 }),
    productionPlan: Object.freeze({
      storeRetailPurchaseCustomerVisits: Object.freeze({ insert: prepared.length, supersede: 0, unchanged: 0 }),
      existingRetailPurchaseRateV1: Object.freeze({ insert: 0, supersede: 0, unchanged: existingRateRows }),
      companyScope: Object.freeze({ insert: 0, status: "OUT_OF_SCOPE_FOR_STORE_OPERATIONS" }),
      nonSalonScope: Object.freeze({ insert: 0, status: "STAGING_ONLY" }),
      outsideOperationPeriod: Object.freeze({ insert: 0, status: "QUARANTINED" }),
    }),
    displayPolicy: Object.freeze({
      existingRate: "RETAIN_NO_OVERWRITE",
      missingExistingRate: "DISPLAY_DERIVED_ONLY_FROM_RETAIL_PURCHASE_CUSTOMER_VISITS_DIV_TOTAL_CUSTOMERS",
      difference: "DISPLAY_ONLY_WHEN_EXISTING_AND_DERIVED_ARE_BOTH_AVAILABLE",
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
  assert(args.retail, "RETAIL_PATH_REQUIRED");
  const bytes = readFileSync(args.retail);
  assert(bytes.length === PRODUCTION_RETAIL_PROFILE.retailPackageByteSize, "RETAIL_PACKAGE_BYTE_SIZE_MISMATCH");
  assert(sha256(bytes) === PRODUCTION_RETAIL_PROFILE.retailPackageSha256, "RETAIL_PACKAGE_SHA256_MISMATCH");
  const plan = buildProductionRetailLoadPlan(JSON.parse(bytes.toString("utf8")));
  const summary = { ...plan, candidates: undefined, candidateCount: plan.candidates.length };
  if (args.out) {
    mkdirSync(args.out, { recursive: true });
    writeFileSync(join(args.out, "production-retail-load-plan.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    writeFileSync(join(args.out, "production-retail-load-candidates.json"), `${JSON.stringify(plan.candidates, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
