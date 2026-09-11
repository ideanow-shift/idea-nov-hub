# Accounting Read-only Port Contract

## Status

**Interface contract exists; source binding is pending the Data Source decision and Accounting approval.**

## Fixed request boundary

| Item | Contract |
| --- | --- |
| Input | server-issued canonical store IDs already limited by Store Scope, plus one `YYYY-MM` period |
| Read operation | fixed published projection lookup only; no arbitrary SQL, report, source table, or field selection |
| Required fields | `operating_profit`, `total_revenue`, `operating_margin`, `confirmed_through_period`, confirmation state, tax basis |
| Tax rule | tax-exclusive values only |
| Profit rule | store operating profit only; `operating_margin = operating_profit / total_revenue` when both values are confirmed and denominator is positive |
| Unconfirmed | all profit-derived numeric fields are `null`; state is `preparing` |
| FC | profit state is `unavailable` in V1; no FC profit is returned |
| Headquarters allocation | absent in V1 |
| Write behavior | INSERT, UPDATE, DELETE, UPSERT, write RPC, migration, and schema change are prohibited |

## Published-only rule

The adapter returns a row only when the source declares the period confirmed and tax basis compatible. It must never transform missing, draft, estimate, or unconfirmed values into zero or a formal value.

## Staging Snapshot minimum content if B is approved

Only aggregate rows keyed by canonical store and period, plus confirmation/tax-basis metadata. Raw journal rows, customer-level data, employee-level data, allocation detail, and data outside the approved period are excluded.

