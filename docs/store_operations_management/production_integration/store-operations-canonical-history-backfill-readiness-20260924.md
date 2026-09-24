# Store Operations canonical history backfill readiness (2026-09-24)

## Decision

The fixed package is ready for review and a separate Production execution approval. No Production write or deploy was performed while preparing it.

The package fills the missing historical part of the nine existing Store Fact metrics and reconciles existing facts to the latest fixed canonical source. Corrections are append-only: the prior row is retained, marked inactive, and referenced by the replacement row.

## Portfolio boundary

- Portfolio lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`
- Current phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
- Included: canonical SALON operating facts used by Store Operations.
- Excluded: company totals, EC, HQ, outside-operation-period rows, corporate accounting facts, annual financial statements, and FC corporate accounting.
- Corporate accounting canonical workbooks remain queued for their applicable portfolio phase; they are not mixed into Store Facts.

## Fixed inputs

| Input | SHA-256 | Bytes |
| --- | --- | ---: |
| `POS_Canonical_Store_Monthly_Actual.csv` | `A87BF388B5B5F7349EDE6A65DF37FDF3689039E947CDBD30CA67B6C952B64CC9` | 37,665,586 |
| Retail customer-count mapping package | `EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942` | 3,252,873 |

The retail package is reused only as already-reviewed effective-month evidence for the six companies and 21 canonical store IDs, including the February 2024 KYARA physical-store transition. Its retail quantity values are not reinserted by this package.

## Included metrics

- `TOTAL_SALES`
- `TECHNICAL_SALES`
- `RETAIL_SALES`
- `TOTAL_CUSTOMERS`
- `NEW_CUSTOMERS`
- `TOTAL_UNIT_PRICE`
- `TECHNICAL_UNIT_PRICE`
- `TOTAL_PRODUCTIVITY`
- `TECHNICAL_PRODUCTIVITY`

All use the existing active `v1` definitions. No metric definition or schema change is included.

## Fixed counts

| Boundary | Count |
| --- | ---: |
| Exact-match canonical store-month mappings | 1,492 |
| Candidate slots (1,492 × 9) | 13,428 |
| Canonical values | 13,422 |
| Planned inserts, 2019-01 through 2024-06 | 9,003 |
| Existing facts compared with the latest canonical source, 2024-07 through 2026-08 | 4,419 |
| Exact unchanged facts | 4,192 |
| Append-only corrections | 227 |
| Preserved unavailable cells | 6 |
| Planned source files | 1 |
| Planned import batches | 83 |
| Planned raw rows | 9,230 |
| Planned staging rows | 9,230 |
| Planned missing-grain inserts | 9,003 |
| Planned correction inserts | 227 |
| Planned prior-version invalidations / value updates / deletes | 227 / 0 / 0 |

The six unavailable cells are `TOTAL_UNIT_PRICE` and `TECHNICAL_UNIT_PRICE` for the historical KYARA unit in 2020-01, 2020-02, and 2020-03. The denominator is zero or missing. They stay unavailable and are not converted to zero.

The 227 reviewed corrections are:

| Metric | Corrections |
| --- | ---: |
| `NEW_CUSTOMERS` | 1 |
| `TECHNICAL_PRODUCTIVITY` | 109 |
| `TOTAL_PRODUCTIVITY` | 109 |
| `TECHNICAL_UNIT_PRICE` | 4 |
| `TOTAL_UNIT_PRICE` | 4 |

The two productivity groups reflect the latest FTE-backed canonical recalculation. Sales, retail sales, technical sales, and total customers have zero differences. Amount metrics use the existing Store Fact precision contract (two decimal places), while the higher-precision source value is retained in the normalized lineage payload.

## Execution gates

The generated SQL:

1. requires a fixed Owner approval session setting before any write;
2. takes an advisory transaction lock;
3. verifies the actor, nine metric definitions, six company mappings, 21 store mappings, and absence of a prior package run;
4. requires 4,192 existing active facts to equal the fixed canonical values and exactly 227 to match the reviewed correction set;
5. requires all 9,003 missing-history grains to be absent;
6. stages 9,003 missing rows and 227 append-only corrections;
7. invalidates only the 227 prior versions and records `correction_of_fact_id` plus the correction reason on each replacement;
8. verifies all 13,422 active values after insertion;
9. rolls the entire transaction back on any mismatch or drift.

The canonical table remains protected by its existing RLS/FORCE RLS and grants. This package creates no public object, policy, grant, view, function, or Data API exposure.

## Artifact

- SQL: `store-operations-canonical-history-backfill-v1.execution.sql`
- SQL SHA-256: `09826822FE6785B85092C23BAB723E00518615535EB4A6992F31A9778F1DFCEA`
- SQL bytes: 15,375,878
- Manifest: `store-operations-canonical-history-backfill-v1.execution-manifest.json`
- Status: `AWAITING_SEPARATE_OWNER_PRODUCTION_EXECUTION_APPROVAL`

## Remaining canonical Store Operations streams

These are intentionally not combined into this package because they need separate metric definitions or grain contracts:

- FTE staff count and workforce allocation;
- standard/active time and timecard allocation;
- labor-input productivity (671 READY store-months, 21 `NO_TIMECARD_ALLOCATION` store-months preserved as unavailable);
- POS customer segment counts and payment-method metrics that do not yet have an approved Store Fact/UI contract;
- company-total, EC, and HQ scopes.

Each stream should receive its own fixed input hash, semantic definition, exact mapping report, loader, validator, dry-run, and Owner execution gate. Missing values must not be synthesized.
