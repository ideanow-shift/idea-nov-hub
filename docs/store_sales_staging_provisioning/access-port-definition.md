# Read-only Access Port Definition

## A. Store Master Access Port

| Item | Contract |
| --- | --- |
| Source | Staging replica/fixture of `public.stores` only |
| Operation | server-side read-only select through a least-privilege port |
| Shape | canonical store ID, store code, display name, class, active flag, operator code |
| Baseline | exact active current 20; Direct 13 and FC 7 |
| Tokorozawa | core legacy reference may resolve only inside the server port to the approved canonical public ID |
| Failure | mismatch, missing crosswalk proof, or non-20 result returns 503 |
| Prohibited | browser DB access, write RPC, DML, inferred class/operator, fallback rows |

## B. Accounting Projection Access Port

| Item | Contract |
| --- | --- |
| Source | Staging published Accounting Projection only |
| Operation | server-side read-only batch read by canonical Store ID and period |
| Returned fields | `operating_profit`, `total_revenue`, `operating_margin`, `confirmed_through_period`, confirmation state, tax basis |
| Profit rule | tax-exclusive store operating profit; margin is `operating_profit / total_revenue` |
| Unconfirmed | all profit-derived fields are `null` with `preparing` |
| FC / allocation | FC profit is `unavailable` in V1; headquarters allocation is absent |
| Failure | missing/invalid/foreign-environment output returns null/preparing or 503; never zero or synthetic data |

## Port implementation state

Both ports have interface-level source code in the Store Sales API candidate. Neither has a Staging adapter, credential, or real source binding yet.
