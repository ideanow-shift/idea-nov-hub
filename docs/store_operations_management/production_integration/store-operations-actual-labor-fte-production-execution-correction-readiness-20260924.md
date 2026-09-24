# Store Operations Actual Labor FTE Production Execution Correction Readiness

Date: 2026-09-24

Portfolio Lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-09-21-V5`

Current Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`

Base main SHA: `4f81fd455dead5911b1c63cbf8bf8c17c0550bbe`

## Status

`READY_FOR_SEPARATE_OWNER_REVIEW_OF_CORRECTED_FIXED_SHA`

This correction package does not authorize or perform Production DDL, DML, deploy, DBF write, or Store Operations business write. A new Owner approval must name the corrected v2 SQL SHA before any Production execution.

## Prior executed-failed artifact

The immutable v1 SQL remains in the repository as execution-history evidence:

- File: `store-operations-actual-labor-fte-v1.execution.sql`
- SHA-256: `76CD092C7D3CBE3756FBA6DC2D97C044652052623D59EDFB3BF1911DA8BDB7E6`
- Result: `PRODUCTION_BASELINE_GATE_FAILED actor=1 definition=0 fact=0 source=0 mapping=0 company=6 store=2 kyara_master=1`
- Transaction outcome: atomic rollback
- Production rows written: `0`
- Production DDL/DML retained after failure: `0`

The failure occurred before the first schema or business write. The v1 file and its manifest were not overwritten.

## Root cause and read-only master resolution

The v1 candidate mapping contained historical store UUIDs for 18 stores. 久米川 (`0003|0001`) and KYARA HALF (`0001|0019`) already matched the current Production master; the other 18 did not.

The correction was resolved read-only against Production project `nkmxevmioczcmnldreyo` using only the stable key `store_no + corporation_id` and `is_active=true` for both store and corporation. Store names and name similarity were not used for resolution.

| Resolution gate | Result |
|---|---:|
| Expected stable keys | 20 |
| Exact active matches | 20 |
| Missing | 0 |
| Ambiguous | 0 |
| Corrected UUIDs | 18 |
| Unchanged UUIDs | 2 |

The corrected SQL rechecks both stable-key uniqueness and the exact resolved UUID for every store before any write. A missing, inactive, ambiguous, or changed master row fails closed.

## Corrected fixed inputs and outputs

- Corrected SQL: `store-operations-actual-labor-fte-v2.execution.sql`
- Corrected manifest: `store-operations-actual-labor-fte-v2.execution-manifest.json`
- Corrected SQL SHA-256: `F3CF815799BE8D739596C42A3697DB7999F4DB493A4A282E588F8C221D5B02A6`
- Corrected SQL byte size: `868594`
- Fixed aggregate input SHA-256: `3D456AF80CFC2D60873A34E82F4A370CDE491884C604C3EB4ADBDC4777AF4157`
- Corrected candidate root SHA-256: `DBCE3BFE5859408EB6062E1026CD9713D46CD428278DCAC1E225CA978233C3C3`

## Preserved canonical contract

| Item | Count or rule |
|---|---:|
| Canonical store-month candidates | 671 |
| Store mappings | 20 |
| Months | 36 |
| KYARA HALF canonical months | 36 |
| Former staging-only KYARA HALF months included within 671 | 5 |
| Unallocated employee-month audit rows excluded | 445 |
| Headquarters rows | 0 |
| Missing/ambiguous mappings | 0 |
| Reference-hour formula | `allocated_actual_work_hours / 173.76` |
| Missing semantics | absent row means `NULL`; no synthesized zero |

July 2026 remains fixed at 20 stores, 1,700,849 allocated minutes, 28,347.483333 hours, source FTE 163.1415937692, and stored `numeric(20,4)` FTE 163.1415.

## Corrected fail-closed controls

The v2 SQL:

1. requires a new approval value, `OWNER_APPROVAL_REQUIRED_AFTER_CORRECTED_FIXED_SHA_REVIEW`;
2. checks all 20 active stable keys are unique by `store_no + corporation_id`;
3. checks all 20 resolved UUIDs exactly match the read-only Production master snapshot;
4. preserves the six exact corporation UUID checks and KYARA HALF Owner decision;
5. preserves the 671-row, 36-month, 173.76 formula, no-HQ, unique-grain, and exact readback gates; and
6. executes in one transaction and rolls back on every mismatch.

## Production safety record

- Correction preparation Production DDL/DML: `0`
- Correction preparation Production deploy: `0`
- Correction preparation Production business-data write: `0`
- Corrected SQL execution: not authorized and not executed
