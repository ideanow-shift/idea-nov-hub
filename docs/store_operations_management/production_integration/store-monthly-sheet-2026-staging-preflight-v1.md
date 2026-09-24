# Store Monthly Sheet 2026 Staging Preflight v1

## Purpose

This contract converts the approved June 2026 store-monthly sheet layout into
candidate DBF rows in memory only. It is a Staging preparation boundary, not a
data import, promotion, or Production path.

The implementation is the pure module:

`portal/management-app/dbf-store-monthly-sheet-2026-preflight.js`

It makes no network call, database call, browser persistence call, file write,
or mutation of the source sheet.

## Fixed Source Profile

| Contract field | Required value |
| --- | --- |
| Source system | `store_operations_monthly_sheet_2026_v1` |
| Target month | `2026-06` |
| Sheet name | `6月 ` (including its trailing space) |
| Grid | 101 rows and 23 columns after trailing blanks are padded |
| Header row | Row 1 |
| Aggregate columns | `直営店計` and `グループ計` |
| Store columns | The exact 20 labels below, in the fixed order |

The first column is validated as an item-label column. Aggregate cells are never
converted into facts. The module rejects a changed title, aggregate header,
store-header order, source row label, row count, or source sheet name.

## Fixed Store Source Keys

These are source keys, not Canonical IDs. The new source system requires its own
server-side mapping receipts; it must not silently reuse
`store_ops_historical_master_v1` mappings.

| Source header | Source store key | Source company key |
| --- | --- | --- |
| 所沢 | `tokorozawa` | `0001` |
| アネックス | `annex` | `0001` |
| 野方 | `nogata` | `0001` |
| 石神井公園 | `shakujiikoen` | `0001` |
| 池袋 | `ikebukuro` | `0001` |
| キャラハーフ | `kyarahalf` | `0001` |
| 保谷 | `hoya` | `0001` |
| 高田馬場 | `takadanobaba` | `0001` |
| 下井草 | `shimoigusa` | `0001` |
| 上石神井 | `kamishakujii` | `0001` |
| 東大和 | `higashiyamato` | `0001` |
| 立川 | `tachikawa` | `0001` |
| 久米川（FC） | `kumegawa` | `0003` |
| 東久留米（FC） | `higashikurume` | `0006` |
| 花小金井（FC） | `hanakoganei` | `0005` |
| 新所沢（FC） | `shintokorozawa` | `0002` |
| 鷺ノ宮（FC） | `saginomiya` | `0002` |
| ロアネ（FC） | `roane` | `0002` |
| 国分寺（FC） | `kokubunnji` | `0004` |
| 江古田（FC） | `ekoda` | `0001` |

The `FC` presentation suffix is not a Canonical operating-model, ownership, or
company-classification rule. The module emits no `direct`, `franchise`, or
Canonical ID. Canonical mapping and effective operating model remain a
server-side evidence decision.

The fixed mapping request set is exactly 26 requests: six company source keys
and 20 store source keys.

## Supported Metrics

Only these source rows create candidate facts. All other source rows, including
MID, EC allocation, profit, aggregate rows, and customer or repeat measures
outside this approved source profile, are excluded. Adding another metric from
the sheet requires a separately approved source-profile revision.

| Period | Source row | Source label | Metric code |
| --- | ---: | --- | --- |
| 2026 Actual | 56 | 総売上 | `TOTAL_SALES` |
| 2026 Actual | 57 | 技術売上 | `TECHNICAL_SALES` |
| 2026 Actual | 58 | 商品売上 | `RETAIL_SALES` |
| 2026 Actual | 59 | 総単価 | `TOTAL_UNIT_PRICE` |
| 2026 Actual | 60 | 技術単価 | `TECHNICAL_UNIT_PRICE` |
| 2026 Actual | 61 | 総客数 | `TOTAL_CUSTOMERS` |
| 2026 Actual | 64 | 店販購買客比率 | `RETAIL_PURCHASE_RATE` |
| 2026 Actual | 65 | 総生産性 | `TOTAL_PRODUCTIVITY` |
| 2026 Actual | 66 | 技術生産性 | `TECHNICAL_PRODUCTIVITY` |
| 2026 Actual | 68 | 新規客数 | `NEW_CUSTOMERS` |
| 2026 Actual | 72 | 新規リピート | `NEW_REPEAT_RATE` |
| 2025 Actual | 81-97 | The corresponding 11 raw-data labels | The same 11 metric codes |
| 2026 Budget | 3 | 予算値 | `TOTAL_SALES` |
| 2026 Budget | 77 | 技術売上予算 | `TECHNICAL_SALES` |
| 2026 Budget | 78 | 商品売上予算 | `RETAIL_SALES` |

Rates must be explicit percentage text or decimal values in the range `0..1`.
Percentage text is normalized to a decimal. Quantity values must be non-negative
integers. Empty cells produce an `SOURCE_CELL_BLANK` unavailable receipt and no
candidate fact. They are never converted to zero.

The caller supplies `confirmed` or `provisional` independently for Actual and
Budget. The preflight does not invent a confirmation state.

## Mandatory Evidence Gates

Local parsing does not authorize an import. Before a candidate can be submitted
to DBF server-side validation, all of the following must exist:

1. Exactly one active, server-side receipt for every one of the six company and
   20 store mapping requests under this new source system.
2. An approved, server-side effective-operator evidence package for every one
   of the 20 stores at both `2025-06` and `2026-06`.
3. No unavailable receipt for a required source cell.

The current Core Master snapshot must never be backcast to prove a historical
month. A missing historical period remains fail-closed. This is especially
important because the current Core Master effective dating does not itself prove
the June 2026 operator relationship.

The module can return only one of these local states:

| State | Meaning |
| --- | --- |
| `BLOCKED_SOURCE_DATA_MISSING` | At least one selected source cell is blank. |
| `BLOCKED_MAPPING_RECEIPTS` | A new-source mapping receipt is missing or duplicated. |
| `BLOCKED_HISTORICAL_OPERATOR_EVIDENCE` | Required monthly effective-operator evidence is not approved. |
| `READY_FOR_SERVER_VALIDATION` | Source structure and local evidence references are complete; DBF must still revalidate them server-side. |

`promotionAllowed` is always `false` in this module. No local evidence object,
browser value, or source presentation label can authorize a DB write.

## Subsequent Controlled Path

1. Retrieve the approved sheet into a rectangular in-memory grid.
2. Run this preflight and preserve unavailable receipts without synthesizing
   values.
3. Resolve the new source-system mappings through the DBF server-side mapping
   lifecycle.
4. Revalidate the effective operator for each `(store, fiscal month)` using the
   approved historical evidence package.
5. Use the existing DBF validation, review, approval, and promotion lifecycle.

This contract does not change the two-store Production Pilot, Edge Functions,
Migrations, RLS, Pages, or Production configuration. Existing historical facts
with a separate MID metric are comparison evidence only and are not a direct
promotion artifact for this source profile.
