import { createHash } from "node:crypto";

export const SOURCE_HASH_CONTRACT_VERSION = "fair-attribution-source-hash-contract-v1";

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(sorted(value));
}

export function sha256Utf8(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function sourceRangePayload(values, startRow = 3, endRow = 530) {
  if (!Array.isArray(values) || values.length !== endRow - startRow + 1) {
    throw new Error("source_range_cardinality_invalid");
  }

  return {
    contract_version: SOURCE_HASH_CONTRACT_VERSION,
    spreadsheet_values: values.map((value, index) => ({
      row: startRow + index,
      value: value === undefined ? null : value,
    })),
  };
}

export function sourceRangeHash(values, startRow = 3, endRow = 530) {
  return sha256Utf8(canonicalJson(sourceRangePayload(values, startRow, endRow)));
}

export function canonicalPayloadHash(payload) {
  return sha256Utf8(canonicalJson(payload));
}
