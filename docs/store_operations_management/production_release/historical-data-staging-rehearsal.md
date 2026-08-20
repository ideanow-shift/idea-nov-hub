# Historical Data Staging Rehearsal

## Scope

- Period: 2024-07 through 2026-06 (24 months)
- Stores: the 20 official stores; headquarters is excluded
- Metrics: the existing 19 `STORE_OPERATING_RESULT` metric codes
- Destination: Staging DBF import pipeline only
- Production, canonical direct write, synthetic fill, and missing-to-zero conversion: prohibited

## Preparation contract

The source is a normalized CSV with this exact header:

`fiscal_month,company_key,store_key,metric_code,value,definition_version,confirmation_status`

Run the local preflight with an approved 20-key Store Master snapshot and a read-only export of active canonical grains:

```powershell
node scripts/dbf-historical-store-data-rehearsal.mjs --input=history.csv --stores=official-store-keys.json --protected=active-grains.json --budgets=budget-scopes.json --output=work/historical-rehearsal
```

The tool emits 24 monthly CSVs only when all blocking validations pass. Those files preserve the existing one-batch/one-fiscal-month contract and are uploaded through DBF Management UI. The Owner performs validation, approval, and promotion. No tool output writes business facts.

## Fail-closed checks

- Month is within the fixed period.
- Company and store source keys are present; the store key belongs to the approved 20-store snapshot.
- Metric code belongs to the frozen 19-code contract.
- Grain `(month, company, store, metric)` is unique.
- Rate values use the canonical 0–1 representation; quantities are non-negative integers.
- Confirmation status is explicitly `provisional` or `confirmed`.
- When all components exist, sales and customer totals are compared and warnings are reported without changing values.
- Every month/store cell reports present, confirmed, provisional, and missing counts; missing metric codes; Budget availability; and YoY, September-start Fiscal YTD, and six-month Trend readiness. Blanks remain missing.
- A collision with an active fact blocks generation and requires the existing correction lineage flow.

## Protected pilot

The 2026-06 Saginomiya active Revision 2 grains for `TOTAL_SALES`, `TECHNICAL_SALES`, and `RETAIL_SALES` must be included in `active-grains.json`. Any matching source row returns `ACTIVE_FACT_COLLISION_CORRECTION_REQUIRED`; the existing batch is never overwritten.

## Current readiness

The preparation path is ready, but the historical source file and approved Store Master snapshot have not been supplied. Staging import, approval, promotion, Store Operations read-back, and UAT therefore remain Owner-gated. The separate 2026-06 budget batch remains `owner_review` (777 staging rows, 0 errors, 3 warnings) and is not promoted by this rehearsal.
