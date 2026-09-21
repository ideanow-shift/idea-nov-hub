# Phase 3 Owner / Sales UAT Execution Guide

Date prepared: 2026-09-21
Portfolio lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-09-21-V5`
Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
Environment: Production read-only Store Operations application

## Purpose

This guide is the fixed walkthrough for the 13 business checks in
`phase3-owner-sales-uat-record-20260921.md`. The Owner completes all 13 checks.
Portfolio Lock V5 does not require a separate Sales Department walkthrough or
acceptance. The walkthrough does not authorize a deployment, database write,
source substitution, or Phase transition.

## Before starting

1. Open NOV HUB using the normal signed-in business account.
2. Open Store Operations from NOV HUB. Do not paste credentials, tokens, employee
   IDs, or store UUIDs into the record.
3. Use Production only. A Preview or Staging banner is a failure for this UAT.
4. Use the normal desktop browser for cases 01 through 11 and 13. Use the normal
   mobile device for case 12.
5. Record only `PASS`, `FAIL`, or `NOT_RUN`. A screenshot note may include the
   month, scope, visible store name, and visible state, but no personal data.

## Fixed walkthrough

| ID | Operator action | PASS condition |
| --- | --- | --- |
| UAT-P3-01 | Open Store Operations once from NOV HUB and once from the direct Production route. | Both routes reach the same authenticated application and approved scope without a second business-data login. |
| UAT-P3-02 | Select all stores and monthly view. Compare 2026-06 with 2026-07. | Target month, profit confirmation month, tax basis, total sales, and profit state are understandable; July does not present unconfirmed profit as confirmed. |
| UAT-P3-03 | Review all-store summary, direct scope, and FC scope. | All-store population is 20, direct scope is 13, and FC/other-operator scope is 7. No duplicate or unknown store appears. |
| UAT-P3-04 | Review the priority-action section for 2026-06 and 2026-07. | No more than three actions appear, and each explains the metric or state that requires attention. |
| UAT-P3-05 | Open the store list and review at least one stable, improving, and action-required store where available. | Status, sales, customer count, productivity, assigned area manager, and focus text are understandable for prioritisation. |
| UAT-P3-06 | Open one direct-store detail for 2026-06 and 2026-07. Review Summary, Sales/Profit, Customer/Repeat, and Value/Productivity. | Available facts retain their intended business meaning; unavailable facts remain explicit states instead of zero or an invented value. |
| UAT-P3-07 | Review budget ratio on the all-store summary and one store detail in both months. | A ratio appears only when the confirmed budget fact exists. Missing budget never appears as zero or 0%. |
| UAT-P3-08 | Review year-on-year, cumulative, and trend controls. Switch at least two metrics and two periods. | The selected comparison period is clear, the graph follows the selected metric, and missing periods do not become zero. |
| UAT-P3-09 | Review 2026-06 all-store profit, 2026-07 all-store profit, and 2026-06 FC profit. | June confirmed profit, July preparing state, and FC `V1対象外` are distinct. |
| UAT-P3-10 | Review repeat rate and retail purchase rate in summary and detail. | Both remain `準備中` wherever the formal source is absent. A percentage or zero in place of `準備中` is a failure. |
| UAT-P3-11 | Navigate between all, direct, FC, list, and detail using only visible controls and links. | The operator remains inside the approved business scope; raw UUIDs, hidden stores, or an expanded scope are not exposed. |
| UAT-P3-12 | On the normal mobile device, open summary, list, one store detail, and the FC scope. | Text and values are readable, controls are operable, and no horizontal overflow blocks the business content. |
| UAT-P3-13 | Without opening a separate spreadsheet, identify up to three stores to discuss and state why. | The available V1 metrics and visible states are sufficient to choose the review targets and explain the reason. |

## Failure handling

For a failed case, record the case ID, selected month, selected scope, visible error
or incorrect value, and whether the issue blocks business use. Do not include the
signed-in person's name, email, employee ID, access token, session value, or URL
query parameters. Do not retry a write or alter Production data.

The overall UAT remains `PENDING` if any Owner case fails or has a `NOT_RUN`
result, or blocking defects have not been evaluated.

## Acceptance text

After completing the walkthrough, the Owner can provide the following concise
record without personal data:

```text
Phase 3 Store Operations UAT
Role: Owner
Date: YYYY-MM-DD
UAT-P3-01 through UAT-P3-13: PASS / FAIL / NOT_RUN
Blocking defects: 0 / count
Business acceptance: PASS / PENDING
```

All 13 Owner results, zero blocking defects, and Owner acceptance are required
before the complete UAT can become `PASS`. The Sales result column remains in the
record as historical structure and may stay `NOT_RUN`; it is not an Exit Criterion
under Portfolio Lock V5.
