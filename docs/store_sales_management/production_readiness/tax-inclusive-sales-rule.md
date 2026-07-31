# Tax-Inclusive Sales Rule

## Purpose

税抜の弥生sourceから、監査可能な税込売上を生成する承認済みruleを定義する。

## Current State

弥生Excelは税抜。科目・取引別税区分、税率、端数、税込source、EC/MID配賦は未確認。一律1.1倍は禁止。

## Target State

| Rule element | Proposal | Status |
|---|---|---|
| 税抜source | published Accountingの技術・商品・EC・売上 | proposed |
| 税込source優先 | 承認済み税込明細 > 税区分付き明細変換 > 科目rule変換 | proposed |
| 科目別税区分 | account mapping versionで管理 | unknown |
| 取引別税区分 | 取引metadataがある場合は科目ruleより優先 | proposed |
| 標準/軽減税率 | 有効期間付き税率master、具体値TBD | unknown |
| 非課税/不課税/対象外 | multiplierを使わず分類を保持 | proposed |
| 返品/取消/訂正 | 元取引税区分・税率・符号を継承 | proposed |
| 端数単位/方式 | transaction/invoice/monthly、切捨/四捨五入等TBD | unknown |
| EC売上 | source優先・店舗配賦rule TBD | blocked |
| MID | 独立科目なし。Directory/営業source候補TBD | blocked |
| 店舗配賦 | approved allocation versionのみ | blocked |
| provenance | source fact、tax rule version、rate/effective period、rounding、allocationを追跡 | proposed |

## Confirmed Decisions

- 一律1.1倍を禁止する。
- 変換不能時は数値を非表示、`data_state=preparing`、理由を返す。
- 税ロジックはAccounting/Projection server-sideに置き、Runtime/UIに置かない。

## Proposed Decisions

rule versionをAccounting versionに紐付け、Accounting Approverの承認後だけpublished projectionへ利用する。

## Unknowns

税込source有無、実税区分、率、有効期間、端数、EC/MID、訂正運用。

## Blocking Items

DEC-TAX-001、サンプル取引照合、経理承認、negative/境界値test。

## Required Approvers

Accounting Approver、Management Approver、Sales Owner。税務判断が必要な場合は専門家。

## Evidence／Source

- [Yayoi structure audit](../../accounting/yayoi-excel-structure-audit.md)
- [Accounting Core API](../../accounting/accounting-core-api-v1.yaml)

## Exit Criteria

全売上sourceを分類し、境界日・返品・非課税・端数・配賦・変換不能testが合格し、Accounting approvalが記録される。
