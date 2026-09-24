# Store Operations Preparing Metrics Production Preflight — 2026-09-24

## Execution boundary

- Portfolio Lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-09-21-V5`
- Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
- Production project: `nkmxevmioczcmnldreyo`
- This package is review-only. Production DDL/DML, migration, deploy, and business-data writes remain **not authorized**.
- The SQL artifact begins with an unconditional exception and cannot execute its proposed DDL/DML.

## Fixed input and validation

- Retail package SHA-256: `EF2C56108BACED3F1999F6903C681B8D7BE963A50707388DC84BEA2BBFA68942`
- Package root SHA-256: `94CA104E062E3BCB2CB47910AA47F95F578C1BF9463196A2A4D9304E5A4ABBBA`
- File size: `3,252,873` bytes
- Package rows / unique grains: `2,476 / 2,476`
- Store promotion candidates: `1,492`
- Exact store/company mappings: `1,492`; unmatched: `0`; ambiguous: `0`
- Negative quantities, quantity greater than denominator, NULL-to-zero conversions: all `0`

## Proposed Production effect after separate approval

| Boundary | Insert | Supersede | Unchanged/excluded |
|---|---:|---:|---:|
| Store `RETAIL_PURCHASE_CUSTOMER_VISITS` | 1,492 | 0 | 0 |
| Existing `RETAIL_PURCHASE_RATE` v1 | 0 | 0 | 4 |
| Company total | 0 | 0 | 92 excluded |
| EC/HQ | 0 | 0 | 830 staging-only |
| Outside canonical operation period | 0 | 0 | 62 quarantined |

The loader has `DATABASE_WRITE_CAPABILITY=false`. It validates the fixed SHA, creates deterministic mapped candidates and fingerprints, and writes only local review artifacts when an output directory is explicitly supplied.

## UI read projection

- If an existing canonical `RETAIL_PURCHASE_RATE` and the precise candidate both exist, retain the existing rate and display their difference.
- If the existing rate is absent but `RETAIL_PURCHASE_CUSTOMER_VISITS` and `TOTAL_CUSTOMERS` exist, display `店販購買率（精密計算）` as a derived-only value.
- The derived-only path does not create, update, supersede, or backfill the canonical rate.
- Missing numerator or denominator remains `準備中`; it is never converted to zero.

For June 2026, 19 stores have package denominators aligned with the canonical customer facts. Roane by BASSA preserves the known source-denominator difference (`47 / 272` in the package versus Production total customers `271`) as a review difference; no rate is overwritten.

## Security and object boundary

- No new public table, view, function, policy, grant, or Data API exposure is proposed.
- The proposed quantity facts use the existing `public.dbf_store_monthly_metric_facts` contract.
- Company-total, EC/HQ, and quarantined rows cannot enter the Store Fact selection.
- The review SQL does not use `SECURITY DEFINER` and does not grant `service_role`, `authenticated`, or `anon` access.

## Stop point

Production write count is `0`. A new fixed execution SHA, planned insert/unchanged counts, and separate Owner approval are required before any Production database action.
