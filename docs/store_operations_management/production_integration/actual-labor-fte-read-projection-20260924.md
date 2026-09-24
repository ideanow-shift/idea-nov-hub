# 実労働FTE（換算人数）— Store Operations read projection readiness

## Portfolio gate

- Lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-09-21-V5`
- Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
- Work allowed: YES
- Production DDL/DML, deploy, merge: NOT AUTHORIZED

## Fixed source

- Source workbook SHA-256: `7E04D2107876FCA9902D07F9CB548403B51529591CB431239399912A77BC3E16`
- Corrected handoff workbook SHA-256: `679ACF51066B12398E2DB5016A7A91EC1552B9C0F80A1FA7CE2518E5445F4303`
- Corrected package root SHA-256: `F1E69E596C10E381B7AD333C3E1E7B06598976B12965ED6EF685E821A56A3787`
- Period: 2023-09 through 2026-08
- Canonical candidate: 671 store-month rows; unique 671; duplicate 0
- July 2026: 20 stores; 28,347.483333 hours; 163.1415937692 FTE

The earlier timecard-store override is not canonical. All 56 override rows (6,903.33 hours) are excluded and retained only in the unallocated audit as `NO_FTE_PLACEMENT` or `FTE_ZERO`.

## Read-only Production preflight

- Project: `nkmxevmioczcmnldreyo`
- Existing `ACTUAL_LABOR_FTE` definition: 0
- Existing `ACTUAL_LABOR_FTE` facts: 0
- Exact active store mappings: 20/20
- Unmatched / multiple / inactive mappings: 0 / 0 / 0
- Existing generic read RPCs can project an active quantity metric; no new read RPC is required.
- The current `metric_definitions_metric_code_check` does not allow `ACTUAL_LABOR_FTE`.

The review-only SQL extends the existing allow-list without removing any current code and inserts the versioned quantity definition. It ends with `ROLLBACK` and is not an execution package.

## UI projection

- Adapter key: `actualLaborFte`
- Label: `実労働FTE（換算人数）`
- Available value: two decimal places, suffix `人相当`
- Formal zero: `0.00人相当`
- Missing fact: `準備中`; never converted to zero
- Note: actual hours are allocated by same-month official FTE placement ratio; this is not an actual punch/support-store measure.

## Missing source data

| Reason | Employee-months | Hours | Required canonical correction |
|---|---:|---:|---|
| `NO_FTE_NAME_MATCH` | 389 | 50,608.20 | Formal employee-number/name alias or employee number in the FTE canonical source |
| `NO_FTE_PLACEMENT` | 49 | 6,290.15 | Same-month official store placement in the latest `FTE_店舗名` sheet |
| `FTE_ZERO` | 7 | 613.18 | Positive FTE only when the canonical zero is demonstrably incorrect |
| **Total** | **445** | **57,511.53** | Keep unallocated; do not guess |

Confirmed shifts are intentionally not a missing dependency because the fixed definition prohibits shift backfill. Months after 2026-08 remain NULL until actual attendance becomes canonical.

## Next approval gates

1. Complete loader, validator, dry-run, idempotency, and exact-count package.
2. Review and merge the read-only UI projection separately.
3. Report fixed SHA and planned insert/unchanged/reject counts.
4. Obtain explicit Owner approval before Production DDL/DML.
5. Obtain separate approval before Edge/UI deploy.
