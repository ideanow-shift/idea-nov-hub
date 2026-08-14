import assert from "node:assert/strict";
import test from "node:test";
import { bindDbfCanonicalMappings, parseDbfNormalizedCsv } from "../portal/management-app/dbf-business-data-normalized-csv.js";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const STORE = "22222222-2222-4222-8222-222222222222";

test("strict PL CSV parses source keys without guessing canonical IDs", () => {
  const parsed = parseDbfNormalizedCsv([
    "fiscal_month,company_key,store_key,account_code,account_name,amount,source_row_category,aggregate_scope,confirmation_status",
    "2026-07,0001,0018,4000,技術売上,1234,detail,,confirmed",
  ].join("\n"), "pl", "2026-07");
  assert.deepEqual(parsed.mappingRequests, [
    { entityType: "company", sourceKey: "0001" },
    { entityType: "store", sourceKey: "0018" },
  ]);
  assert.equal(parsed.rows[0].companyId, undefined);
});

test("canonical mappings are bound only after active mapping receipts exist", () => {
  const parsed = parseDbfNormalizedCsv([
    "fiscal_month,company_key,store_key,metric_code,value,definition_version,confirmation_status",
    "2026-07,0001,0018,TOTAL_SALES,1000,v1,provisional",
  ].join("\n"), "store_operating_result", "2026-07");
  const pending = bindDbfCanonicalMappings(parsed, []);
  assert.equal(pending.unresolved.length, 2);
  const bound = bindDbfCanonicalMappings(parsed, [
    { entityType: "company", sourceKey: "0001", status: "active", mappingId: "33333333-3333-4333-8333-333333333333", canonicalId: COMPANY },
    { entityType: "store", sourceKey: "0018", status: "active", mappingId: "44444444-4444-4444-8444-444444444444", canonicalId: STORE },
  ]);
  assert.equal(bound.unresolved.length, 0);
  assert.equal(bound.rows[0].companyId, COMPANY);
  assert.equal(bound.rows[0].storeId, STORE);
});

test("B/S parser rejects store scope and malformed balance classifications", () => {
  assert.throws(() => parseDbfNormalizedCsv([
    "fiscal_month,company_key,account_code,account_name,amount,classification,confirmation_status",
    "2026-07,0001,1000,現金,100,unknown,confirmed",
  ].join("\n"), "bs", "2026-07"), /BS_SCOPE_OR_CLASSIFICATION_INVALID/u);
});
