# Accounting Dictionary Approval

## Purpose

Store SalesとKPIが使う15 business項目のaccount group、集計、符号、sourceを正式承認する。

## Current State

prototype mappingは存在するが全項目の正式releaseは未実施。既存KPI group 9件も`proposed`。

## Target State

| business_name | account_group_code | included_accounts | excluded_accounts | sign_rule | aggregation_rule | source_priority | effective_from | effective_to | accounting_approval | management_approval | release_status | unresolved_questions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 売上 | total_revenue | 売上高合計 | 営業外収益 | source sign | monthly leaf、rollup二重計上禁止 | published Accounting | 2023-09-01 | TBD | proposed | proposed | proposed | 税込rule |
| 技術売上 | technical_revenue | 技術売上高 | 商品・EC | source sign | monthly | published Accounting | 2023-09-01 | TBD | proposed | proposed | proposed | 税区分 |
| 商品売上 | product_revenue | 商品売上高 | 技術・EC | source sign | monthly | published Accounting | 2023-09-01 | TBD | proposed | proposed | proposed | MID独立科目なし |
| EC売上 | ec_revenue | ECサイト商品売上高 | 店舗商品売上 | source sign | monthly | published Accounting | 2023-09-01 | TBD | proposed | proposed | blocked | 店舗配賦 |
| 売上総利益 | gross_profit | 売上総損益金額 | - | source sign | monthly | published Accounting | 2023-09-01 | TBD | proposed | proposed | proposed | PDF照合 |
| 営業利益 | operating_profit | 営業損益金額 | - | source sign | monthly | published Accounting | 2023-09-01 | TBD | proposed | proposed | proposed | PDF照合 |
| 経常利益 | ordinary_profit | 経常損益金額 | - | source sign | monthly | published Accounting | 2023-09-01 | TBD | proposed | proposed | proposed | PDF照合 |
| 当期純利益 | net_profit | 当期純損益金額 | 税引前利益 | source sign | monthly/legal entity | published Accounting | 2023-09-01 | TBD | proposed | proposed | proposed | P/L・B/S突合 |
| 純資産 | net_assets | 純資産合計 | 内訳二重計上 | source sign | point-in-time | published Accounting | 2023-09-01 | TBD | proposed | proposed | proposed | legal entity scope |
| 総資産 | total_assets | 資産合計 | 内訳二重計上 | source sign | point-in-time | published Accounting | 2023-09-01 | TBD | proposed | proposed | proposed | legal entity scope |
| 流動資産 | current_assets | 流動資産合計 | 内訳二重計上 | source sign | point-in-time | published Accounting | 2023-09-01 | TBD | proposed | proposed | proposed | legal entity scope |
| 流動負債 | current_liabilities | 流動負債合計 | 内訳二重計上 | source sign | point-in-time | published Accounting | 2023-09-01 | TBD | proposed | proposed | proposed | legal entity scope |
| 人件費 | labor_cost | 給与手当、賞与、法定福利費候補 | TBD | expense positive候補 | monthly sum | private approved mapping | TBD | TBD | under_review | proposed | blocked | 役員報酬・退職金・福利厚生 |
| 材料費 | material_cost | 材料仕入候補 | 消耗品・商品仕入候補 | expense positive候補 | 棚卸調整TBD | private approved mapping | TBD | TBD | under_review | proposed | blocked | 正式範囲、棚卸 |
| 家賃 | rent_cost | 賃借料の店舗家賃部分 | 設備lease | expense positive候補 | monthly sum | private auxiliary mapping | TBD | TBD | under_review | proposed | blocked | 補助科目・リース分離 |

## Confirmed Decisions

published Accountingのみをsourceとし、未取得を0にしない。leaf/summary二重計上を禁止する。

## Proposed Decisions

最初の12項目は承認準備可能。人件費・材料費・家賃とEC配賦は業務decision後にreleaseする。

## Unknowns

private auxiliary mapping、税、費用集合、effective date、approval actor。

## Blocking Items

正式release 0/15。KPI definition setは必要groupがapprovedになるまでrelease不可。

## Required Approvers

Accounting Approver、Management Approver、Sales Owner（売上・配賦）。

## Evidence／Source

- [Yayoi account mapping](../../accounting/yayoi-account-mapping.csv)
- [KPI account groups](../../accounting/accounting-kpi-account-groups.json)

## Exit Criteria

15件の必須欄と承認履歴が揃い、必要groupがreleasedで、計算・符号・重複negative testが合格する。
