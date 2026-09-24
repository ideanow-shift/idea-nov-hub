# DBF Store Monthly Integration Report

## Current-month integration

- Upstream source of truth: `storeMonthlyActualProjectionV1` / `STORE_MONTHLY_ACTUAL_V1`
- Consumer: Store Operations (read-only)
- Authentication: NOV HUB Session bearer token
- Scope: server-resolved only; the browser sends no role, store UUID, or requested scope
- Official baseline: 20 operating stores (DIRECT 13 / FC 7); headquarters excluded upstream
- Missing facts: stores and metrics remain `preparing`; zero or Synthetic fallback is prohibited
- Browser writes: none

The adapter validates the DBF contract, preserves missing values as `null`, and maps only the 20 approved monthly metrics, including `RETAIL_PURCHASE_CUSTOMER_VISITS` as a quantity metric. Store status and priority actions remain preparing/empty until their required comparison inputs are formally available.

## Repeat and retail-purchase read projection

- `TOTAL_REPEAT_RATE` is projected from `public.dbf_store_monthly_repeat_rate_facts`, using the visit cohort four months before the selected calculation month.
- Only the formal `TOTAL` segment is exposed to Store Operations. `RETURNING` and `SEMI_FIXED` are validated but are never converted to legacy `SECOND_REPEAT_RATE` or `THIRD_REPEAT_RATE`.
- If a formal Total Repeat row is absent for a store and calculation month, the metric remains `preparing`; an older generic Total Repeat fact is not substituted.
- `RETAIL_PURCHASE_CUSTOMER_VISITS` is exposed as the POS quantity metric and remains distinct from `RETAIL_PURCHASE_RATE`.
- The precise rate candidate is calculated read-only as `RETAIL_PURCHASE_CUSTOMER_VISITS / TOTAL_CUSTOMERS` when both quantities exist and the denominator is positive.
- Existing `RETAIL_PURCHASE_RATE` remains the displayed canonical rate. The candidate, difference, and match result are attached as reconciliation evidence under policy `retain-existing-rate-no-overwrite`; no Fact is updated or superseded.
- When no canonical `RETAIL_PURCHASE_RATE` exists, the same candidate is displayed as `店販購買率（精密計算）` with reconciliation state `derived_only`. This display-only fallback never creates or backfills a rate Fact; absent numerator or denominator stays preparing.
- The browser receives neither raw Store UUIDs nor Company UUIDs. All repeat reads retain the server-resolved Store and effective-operator scope.

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

## Effective-dated store/corporation gate (review candidate)

The current Store Operations backend groups DBF reads by the corporation on the
current Store master. That relationship must not be applied retroactively. The
Gate 5 candidate adds a server-only function,
`store_corporation_effective_operator_range_read_v1`, which resolves each
`(store_id, fiscal_month)` through the active private
`identity_access.store_corporation_history_v1` publication.

- The browser receives no raw Store UUID, Corporation UUID, source row, or match evidence.
- `anon` and `authenticated` cannot execute the function.
- The exposed RPC is `SECURITY INVOKER`; its privileged resolver is confined to the non-exposed `identity_access` schema.
- `service_role` may execute the two-function chain but cannot directly SELECT the private history tables or view.
- A DBF fact is accepted only when its `company_id` equals the effective history result for the same store and month.
- A missing history period or mismatched fact is excluded from analysis and remains `preparing`; the current Corporation is never backcast.
- The current 20-store directory remains the authorization baseline. Historical inactive-store discovery is not added by this candidate and remains a separate contract decision.

Production migration, Edge deployment, and static-app publication remain separate Owner gates.

## Store decision comparison extension

`STORE_MONTHLY_COMPARISON_V1` may return four additional read-only comparison
fields without changing the canonical fact tables:

- `customerYearOverYear`: total-customer year-over-year percentage change.
- `ticketYearOverYear`: total-unit-price year-over-year percentage change.
- `retailYearOverYear`: retail-sales year-over-year percentage change.
- `retailBudgetRatio`: retail-sales budget achievement ratio.

Every value is calculated server-side from canonical current, prior-year, or
approved-budget facts after effective operator validation. A missing numerator,
missing denominator, duplicate budget candidate, or zero denominator returns
`{ dataState: "preparing", value: null }`; no zero or estimate is synthesized.
