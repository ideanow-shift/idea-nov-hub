# DBF Store Monthly Integration Report

## Current-month integration

- Upstream source of truth: `storeMonthlyActualProjectionV1` / `STORE_MONTHLY_ACTUAL_V1`
- Consumer: Store Operations (read-only)
- Authentication: NOV HUB Session bearer token
- Scope: server-resolved only; the browser sends no role, store UUID, or requested scope
- Official baseline: 20 operating stores (DIRECT 13 / FC 7); headquarters excluded upstream
- Missing facts: stores and metrics remain `preparing`; zero or Synthetic fallback is prohibited
- Browser writes: none

The adapter validates the DBF contract, preserves missing values as `null`, and maps only the 19 approved monthly metrics. Store status and priority actions remain preparing/empty until their required comparison inputs are formally available.

## Comparison contract status

`STORE_MONTHLY_ACTUAL_V1` provides the selected month's actual facts. It does not provide budget ratio, year-over-year comparison, year-to-date totals, or monthly trend series.

CURRENT_PHASE_BLOCKER

- Required comparisons: budget ratio, year-over-year, year-to-date, six-/twelve-month trends
- Available facts: the 19 approved current-month store metrics
- Missing contract: actor-scoped read contract for approved budget and historical monthly facts
- Minimum future addition: a server-side, read-only comparison projection that applies the existing actor scope and returns `null` for unavailable values

No browser calculation, inferred value, migration, backend change, or synthetic comparison is included in this phase.

## Runtime gate

Preview fixtures remain isolated for Preview review only. Integration uses the DBF adapter when `contractVersion` is `STORE_MONTHLY_ACTUAL_V1`. Production mode remains blocked and no Production NOV HUB API, secret, database, or Edge Function is changed.
