export function groupCandidateFairPairs(pairs) {
  const grouped = new Map();
  const seen = new Set();

  for (const pair of pairs) {
    const key = `${pair.candidate_id}:${pair.fair_id}`;
    if (seen.has(key)) throw new Error("duplicate_candidate_fair_pair");
    seen.add(key);
    const fairs = grouped.get(pair.candidate_id) ?? new Set();
    fairs.add(pair.fair_id);
    grouped.set(pair.candidate_id, fairs);
  }

  const counts = [...grouped.values()].map((fairs) => fairs.size);
  const logical_candidate_count = counts.length;
  const single_candidate_count = counts.filter((count) => count === 1).length;
  const multiple_candidate_count = counts.filter((count) => count >= 2).length;
  const physical_pending_row_count = counts.reduce((total, count) => total + count, 0);
  const max_fair_candidates_per_candidate = counts.length ? Math.max(...counts) : 0;

  if (single_candidate_count + multiple_candidate_count !== logical_candidate_count) {
    throw new Error("candidate_grouping_invariant_failed");
  }

  return { logical_candidate_count, single_candidate_count, multiple_candidate_count, physical_pending_row_count, max_fair_candidates_per_candidate };
}
