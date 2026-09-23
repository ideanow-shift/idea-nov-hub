import { createHash } from "node:crypto";

export const DATABASE_WRITE_CAPABILITY = false;

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").toUpperCase();
}

export function prepareCompanyRepeatCandidate(fact, companyId) {
  assert(fact?.scope_type === "COMPANY_TOTAL", "COMPANY_REPEAT_SCOPE_REQUIRED");
  assert(typeof companyId === "string" && companyId.length > 0, "RESOLVED_COMPANY_ID_REQUIRED");
  const candidate = Object.freeze({
    company_id: companyId,
    source_company_no: fact.company_no,
    visit_month: fact.visit_month,
    calculation_month: fact.calculation_month,
    horizon_months: fact.horizon_months,
    customer_segment: fact.customer_segment,
    definition_version: fact.definition_version,
    denominator_visit_count: fact.denominator_visit_count,
    numerator_cumulative_repeat_count: fact.numerator_cumulative_repeat_count,
    pos_display_rate: fact.pos_display_rate,
    exact_rate: fact.exact_rate,
  });
  return Object.freeze({
    writeCapability: DATABASE_WRITE_CAPABILITY,
    candidate,
    fingerprintSha256: fingerprint(candidate),
    sourceMetricCodeCandidateDisposition: "VALIDATED_THEN_DROPPED_NOT_CANONICALIZED",
  });
}

export function partitionRetailCandidates(facts) {
  assert(Array.isArray(facts), "RETAIL_FACT_ARRAY_REQUIRED");
  const result = {
    salonReadyForExactMapping: [],
    salonExcludedOutsideOperationPeriod: [],
    companyScopeDesignRequired: [],
    nonSalonStagingOnly: [],
  };
  for (const fact of facts) {
    if (fact.scope_type === "SALON" && fact.promotion_status === "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH") {
      result.salonReadyForExactMapping.push(fact);
    } else if (fact.scope_type === "SALON" && fact.promotion_status === "EXCLUDED_OUTSIDE_CANONICAL_OPERATION_PERIOD") {
      result.salonExcludedOutsideOperationPeriod.push(fact);
    } else if (fact.scope_type === "COMPANY_TOTAL" && fact.promotion_status === "SEPARATE_COMPANY_SCOPE_DESIGN_REQUIRED") {
      result.companyScopeDesignRequired.push(fact);
    } else if (["EC", "HQ"].includes(fact.scope_type) && fact.promotion_status === "STAGING_ONLY_NON_SALON_SCOPE") {
      result.nonSalonStagingOnly.push(fact);
    } else {
      throw new Error(`RETAIL_PROMOTION_BOUNDARY_INVALID:${fact.raw_record_id ?? "unknown"}`);
    }
  }
  return Object.freeze({
    writeCapability: DATABASE_WRITE_CAPABILITY,
    salonReadyForExactMapping: Object.freeze(result.salonReadyForExactMapping),
    salonExcludedOutsideOperationPeriod: Object.freeze(result.salonExcludedOutsideOperationPeriod),
    companyScopeDesignRequired: Object.freeze(result.companyScopeDesignRequired),
    nonSalonStagingOnly: Object.freeze(result.nonSalonStagingOnly),
  });
}
