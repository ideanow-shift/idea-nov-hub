# PR001-B1 M061 Corrective Migration Design Package

## Decision

M061 is an additive corrective migration for the already-applied M011 Snapshot Metadata Foundation. M011 and its migration history remain immutable. M012–M019 retain their approved PR002 allocation, and M020–M060 retain their future reservations.

## Scope and contract

M061 adds three fail-closed CHECK constraints:

| Table | Constraint | Contract |
|---|---|---|
| `governance.master_source_snapshots` | `master_source_snapshots_mapping_contract_version_nonblank` | `btrim(mapping_contract_version) <> ''` |
| `governance.master_source_snapshots` | `master_source_snapshots_masking_policy_version_nonblank` | `btrim(masking_policy_version) <> ''` |
| `governance.snapshot_validation_results` | `snapshot_validation_results_status_value_consistency` | passed iff expected equals actual; failed iff they differ |

Both version columns remain NOT NULL. Empty and whitespace-only values are rejected after trimming. The validation-evidence constraint closes the related M011 gap in which mismatch evidence could be labelled passed.

## Cross-column audit

| Required identifier/reference | Result |
|---|---|
| `source_version` | Existing `master_source_snapshots_source_version_nonblank` is sufficient |
| `mapping_contract_version` | M061 correction required |
| `masking_policy_version` | M061 correction required |
| Header `approval_reference` | Existing M011 length and token-format constraint rejects blank/whitespace |
| Header `created_by` | Existing M011 actor-reference format rejects blank/whitespace |
| Manifest `schema_version`, `source_extract_version` | Existing nonblank constraints sufficient |
| Approval `approval_reference`, `approved_by` | Existing format constraints sufficient |

No optional descriptive field is mechanically tightened.

## Existing-data preflight

M061 performs no data repair. It stops before DDL if either target version is NULL/blank or if existing validation status contradicts expected/actual equality. The authorized read-only staging preflight found zero Snapshot Header rows and zero violations across all audited columns.

## Migration and rollback

Forward: `20260807112029_m061_bdf_snapshot_contract_versions_nonblank.sql`.

Rollback removes only the three M061 constraints. It preserves M001–M011, M012, all tables, columns and data; CASCADE is prohibited.

## Release Gate

M061 may be rehearsed only on a disposable non-Production DB. Staging apply requires a separate Owner authorization and must occur before any M012 Staging apply. Gate evidence:

1. staging read-only violation count is zero;
2. static contract test passes;
3. Fresh/test DB rejects empty and whitespace-only mapping/masking versions;
4. valid contract versions insert successfully;
5. record-count mismatch blocks activation;
6. Hash, Mapping and Masking mismatch cannot be recorded as passed;
7. validation and exact rollback pass;
8. M011 file change count is zero and `git diff --check` passes.

## Current authorization

Authoring and non-Production DB testing are authorized. Commit, push, PR, Staging apply, M012 apply, M013 work, Snapshot data load and Production access are not authorized.
