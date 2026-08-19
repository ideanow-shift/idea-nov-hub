# DBF Comparison Projections

## Scope

`STORE_MONTHLY_COMPARISON_V1` supplies Store Operations with four formal read-only comparisons: budget ratio, prior-year same-month ratio, fiscal-year-to-date totals, and a 24-month trend. It extends `STORE_MONTHLY_ACTUAL_V1`; it does not change its action name or accept client-provided role, employee, store UUID, or scope.

## Canonical sources

- Actuals: confirmed, active `public.dbf_store_monthly_metric_facts`
- Budgets: confirmed, active store-grain `public.dbf_budget_facts`
- Fiscal year: `public.corporation_business_profiles.fiscal_year_end_month`
- Store scope: the existing server-resolved Permission Model and official 20-store operating baseline

The range RPCs are `security invoker`, executable only by `service_role`, limited to 24 months and 20 unique server-resolved store UUIDs. The migration only defines read functions and is not remotely applied by this work unit.

## Calculation contract

- Budget ratio = selected-month `TOTAL_SALES` / same-month canonical budget × 100.
- Prior-year ratio = selected-month `TOTAL_SALES` / prior-year same-month `TOTAL_SALES` × 100.
- Fiscal YTD starts in the month following the corporation's formal fiscal year-end month and ends at the selected month.
- Fiscal YTD sales, operating profit, and customer count require every month in that period.
- Fiscal YTD budget achievement requires one unambiguous budget scenario for every month.
- Trend includes up to 24 months for sales, operating profit, customer count, total unit price, retail sales, and allocated EC sales.

Missing facts, multiple budget scenarios, missing fiscal-year definition, and missing or zero denominators produce `preparing` with `value: null`. They never produce zero, estimates, or Synthetic fallback values.

## Runtime and authorization invariants

- Store Operations management runtime: `assignedScopeEnabled=true`.
- DBF BusinessDataAdmin handoff: `assignedScopeEnabled=false`.
- Area Manager: active and effective assigned stores only.
- Store Manager: own store only.
- Executive/authorized global role: all formal operating stores.
- Client scope or identity spoofing cannot expand the server-resolved scope.

## Release gate

No Production or Staging deployment is included. Production remains gated by:

`PRODUCTION READ-ONLY DEPLOY APPROVAL REQUIRED`
