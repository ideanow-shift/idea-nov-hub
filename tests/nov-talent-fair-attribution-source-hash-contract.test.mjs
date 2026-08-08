import assert from "node:assert/strict";
import test from "node:test";
import { sourceRangeHash, sourceRangePayload } from "../review/nov-talent-fair-attribution-population-v2/source-hash-contract.mjs";

test("source hash contract is deterministic and preserves semantic string bytes", () => {
  const values = [" A ", "Ａ", "line1\nline2", null];
  const first = sourceRangeHash(values, 3, 6);
  const second = sourceRangeHash([...values], 3, 6);

  assert.equal(first, second);
  assert.notEqual(first, sourceRangeHash(["A", "Ａ", "line1\nline2", null], 3, 6));
  assert.deepEqual(sourceRangePayload(values, 3, 6).spreadsheet_values[3], { row: 6, value: null });
});

test("source hash contract fails closed on a wrong physical range length", () => {
  assert.throws(() => sourceRangeHash(["only one"], 3, 530), /source_range_cardinality_invalid/);
});
