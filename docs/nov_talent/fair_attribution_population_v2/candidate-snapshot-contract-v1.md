# Candidate Snapshot Hash Contract v1

The executor recomputes this snapshot inside the same database transaction immediately before population. Candidate dataset, dataset records, and operational Candidate tables are held with `SHARE` locks until commit.

- Contract: `fair-attribution-candidate-snapshot-v1`
- Scope: records in the one dataset whose state is `ACTIVE`, joined to active operational Candidates by `candidate_id`
- Order: ascending `candidate_id`
- Per-row fields: `candidate_id::text`, `graduation_year`, `source_row_no`, `source_reference_hash`, `source_type`, operational Candidate `version`
- Row encoding: `concat_ws('|', ...)`
- Row separator: LF (`0x0a`)
- Empty set: empty UTF-8 string
- Digest: SHA-256, lowercase hexadecimal
- Fixed digest: `01783932dc8cae65ef840dfa1e43becc41ebbb0e536b972d43017cadc141d1a3`

No Candidate name, contact detail, or other PII enters the canonical byte stream, audit log, or API response.
