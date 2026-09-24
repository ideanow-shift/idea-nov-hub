# Store Operations Actual Labor FTE Production Execution Readiness

Date: 2026-09-24

Portfolio Lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-09-21-V5`

Current Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`

Base main SHA: `d83600fe64bcef2d6d000a27777cfe4889d7142c`

## Status

`READY_FOR_SEPARATE_OWNER_PRODUCTION_EXECUTION_APPROVAL`

This package prepares the already-reviewed `ACTUAL_LABOR_FTE` aggregate for a later, separately approved Production execution. Creating and testing this package does not authorize or perform Production DDL, DML, deploy, DBF write, or Store Operations business write.

## Fixed inputs and outputs

- Aggregate handoff SHA-256: `3D456AF80CFC2D60873A34E82F4A370CDE491884C604C3EB4ADBDC4777AF4157`
- Aggregate handoff byte size: `689484`
- Source workbook SHA-256: `7E04D2107876FCA9902D07F9CB548403B51529591CB431239399912A77BC3E16`
- Corrected handoff workbook SHA-256: `679ACF51066B12398E2DB5016A7A91EC1552B9C0F80A1FA7CE2518E5445F4303`
- Corrected package root SHA-256: `F1E69E596C10E381B7AD333C3E1E7B06598976B12965ED6EF685E821A56A3787`
- Candidate root SHA-256: `77D561C62C9BBFB38AF85E2B60A13CA16D29F09F5440582D310FFB2EEE991D05`
- Generated SQL SHA-256: `B6D0AFD0FA443E7DA6B4A2D7F15E5E4F569CACB24B9F8B2A9224F607256CB980`
- Generated SQL byte size: `860791`

The generated SQL and manifest are:

- `store-operations-actual-labor-fte-v1.execution.sql`
- `store-operations-actual-labor-fte-v1.execution-manifest.json`

## Exact plan

| Item | Count |
|---|---:|
| Metric definitions | 1 |
| Company mappings | 6 |
| Store mappings | 20 |
| Import batches | 36 |
| Raw aggregate rows | 671 |
| Valid staging rows | 671 |
| Canonical inserts | 671 |
| Supersedes | 0 |
| Unchanged canonical rows | 0 |
| Employee audit rows included | 0 |
| Headquarters rows | 0 |
| Unmatched rows | 0 |
| Ambiguous rows | 0 |

July 2026 is fixed at 20 stores, 1,700,849 allocated minutes, 28,347.483333 hours, source FTE 163.1415937692, and stored `numeric(20,4)` FTE 163.1415.

## Fail-closed controls

The SQL:

1. starts one transaction and acquires a dedicated advisory transaction lock;
2. requires `app.store_operations_actual_labor_fte_execution_approval=OWNER_APPROVAL_REQUIRED_AFTER_FIXED_SHA_REVIEW` before any schema or business write;
3. verifies the exact Production baseline: one active actor, zero prior metric definitions, zero active `ACTUAL_LABOR_FTE` facts, zero fixed source files, zero dedicated mappings, six companies, and twenty active non-HQ stores;
4. validates metric/version, positive quantity, workbook SHA, actual-hours/minutes consistency, the 173.76-hour formula, `actual_punch_store=false`, `shift_backfill=false`, unique store-month grain, and zero HQ rows;
5. performs exact-count readback before commit; and
6. rolls the entire transaction back on any mismatch.

The artifact does not set its own approval value. It contains no public RPC, no `security definer`, and no grants. Existing RLS and service-role-only ingestion boundaries remain unchanged.

## Excluded data

The 445 unallocated employee-month audit rows remain source audit only and are not embedded in the generated SQL, manifest, or canonical fact plan. Missing facts remain absent rows (`NULL` semantics); they are not synthesized as zero.

## Required next authorization

Before any Production execution, the Owner must review the fixed SQL SHA-256 above and explicitly approve that exact artifact. A later approval is limited to executing that reviewed file against Production and does not authorize application deploy, GitHub Pages deploy, unrelated DBF writes, or changes outside Store Operations Management V1.
