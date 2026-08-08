import assert from "node:assert/strict";
import test from "node:test";
import { groupCandidateFairPairs } from "../review/nov-talent-fair-attribution-population-v2/grouping-contract.mjs";

test("grouping derives logical candidates separately from physical rows", () => {
  const result = groupCandidateFairPairs([
    { candidate_id: "candidate-1", fair_id: "fair-a" },
    { candidate_id: "candidate-2", fair_id: "fair-a" },
    { candidate_id: "candidate-2", fair_id: "fair-b" },
  ]);
  assert.deepEqual(result, { logical_candidate_count: 2, single_candidate_count: 1, multiple_candidate_count: 1, physical_pending_row_count: 3, max_fair_candidates_per_candidate: 2 });
});

test("grouping rejects a duplicate Candidate-Fair pair", () => {
  assert.throws(() => groupCandidateFairPairs([{ candidate_id: "candidate-1", fair_id: "fair-a" }, { candidate_id: "candidate-1", fair_id: "fair-a" }]), /duplicate_candidate_fair_pair/);
});
