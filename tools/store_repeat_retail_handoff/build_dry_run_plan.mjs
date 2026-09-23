import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { validateHandoffFiles } from "./validate_handoff_packages.mjs";

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

export function buildDryRunPlan(validation, baseline) {
  assert(validation?.status === "PASS", "VALIDATION_PASS_REQUIRED");
  assert(baseline?.production?.store_repeat?.fingerprint_status === "EXACT_MATCH", "PRODUCTION_REPEAT_FINGERPRINT_REQUIRED");
  assert(baseline.production.store_repeat.row_count === validation.repeat.scopeCounts.STORE, "PRODUCTION_REPEAT_ROW_COUNT_MISMATCH");

  const retail = validation.retail.promotionCounts;
  return Object.freeze({
    status: "READY_FOR_REVIEW_ONLY_EXECUTION_APPROVAL",
    productionWriteCount: 0,
    stagingPlan: Object.freeze({
      repeatStoreCanonical: Object.freeze({ insert: 6600, reject: 0, unchanged: 440 }),
      repeatCompanyCanonical: Object.freeze({ insert: validation.repeat.scopeCounts.COMPANY_TOTAL, reject: 0, unchanged: 0 }),
      retailStoreCanonical: Object.freeze({ insert: retail.READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH, reject: retail.EXCLUDED_OUTSIDE_CANONICAL_OPERATION_PERIOD, unchanged: 0 }),
      retailCompanyCanonical: Object.freeze({ insert: retail.SEPARATE_COMPANY_SCOPE_DESIGN_REQUIRED, reject: 0, unchanged: 0 }),
      retailStagingOnlyNonSalon: Object.freeze({ insert: retail.STAGING_ONLY_NON_SALON_SCOPE, reject: 0, unchanged: 0 }),
    }),
    productionPlan: Object.freeze({
      repeatStoreCanonical: Object.freeze({ insert: 0, supersede: 0, unchanged: validation.repeat.scopeCounts.STORE }),
      repeatCompanyCanonical: Object.freeze({ insert: validation.repeat.scopeCounts.COMPANY_TOTAL, supersede: 0, unchanged: 0 }),
      retailStoreCanonical: Object.freeze({ insert: retail.READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH, supersede: 0, unchanged: 0 }),
      retailCompanyCanonical: Object.freeze({ insert: retail.SEPARATE_COMPANY_SCOPE_DESIGN_REQUIRED, supersede: 0, unchanged: 0 }),
      excludedOrStagingOnly: Object.freeze({ excludedOutsideOperationPeriod: retail.EXCLUDED_OUTSIDE_CANONICAL_OPERATION_PERIOD, stagingOnlyNonSalon: retail.STAGING_ONLY_NON_SALON_SCOPE }),
      retailPurchaseRateV1: Object.freeze({ insert: 0, supersede: 0, unchanged: baseline.production.retail.existing_rate_rows, status: "DEFINITION_REVIEW_REQUIRED" }),
    }),
    mapping: Object.freeze(baseline.mapping),
    unresolved: Object.freeze([
      "OWNER_APPROVAL_REQUIRED_FOR_STAGING_DDL_DML",
      "OWNER_APPROVAL_REQUIRED_FOR_PRODUCTION_DDL_DML",
      "RETAIL_PURCHASE_RATE_DEFINITION_VERSION_REVIEW_REQUIRED",
      "LOCAL_POSTGRESQL_RUNTIME_UNAVAILABLE",
      "PRODUCTION_REPEAT_SCHEMA_MIGRATIONS_MISSING_FROM_ORIGIN_MAIN",
    ]),
  });
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    result[argv[index]?.replace(/^--/u, "")] = argv[index + 1];
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  assert(args.repeat && args.retail && args.baseline, "REPEAT_RETAIL_BASELINE_PATHS_REQUIRED");
  const validation = validateHandoffFiles({ repeatPath: args.repeat, retailPath: args.retail });
  const baseline = JSON.parse(readFileSync(args.baseline, "utf8"));
  process.stdout.write(`${JSON.stringify(buildDryRunPlan(validation, baseline), null, 2)}\n`);
}
