# Monthly Accounting Runbook

## Purpose

弥生出力からStore Sales反映までの月次責任、期限、失敗時状態を固定する。

## Current State

prototype workflowは検証済みだが実施者名、代理、締切、運用system、incident ownerは未確定。

## Target State

| Step | Executor | Approver | Delegate | Standard deadline | Failure handling/evidence |
|---|---|---|---|---|---|
| 弥生出力 | Accounting Operator | Accounting Owner | Accounting Delegate | 月初TBD | hash、source metadata |
| Import | Accounting Operator | - | Platform Operator | 出力後1営業日 | retry、batch audit |
| Validation | Accounting Operator | Accounting Owner | Accounting Delegate | import当日 | `validation_error`、blocking解消 |
| mapping解消 | Accounting+Core Master | Core Master Owner | TBD role | 承認前 | 未解消は`preparing` |
| 経理承認 | Accounting Approver | - | 指定代理role | 翌月15日前後候補 | 未承認は`collecting` |
| 経営承認 | Management Approver | - | 指定代理role | 経理承認後 | 未承認は`collecting` |
| Publish | Accounting Publisher | Management Approver | Platform Operator | 二承認後 | immutable audit |
| KPI calculation | Platform Operator | Accounting Owner | Platform Delegate | publish後TBD | retry/new run |
| Projection/反映確認 | Sales Operator | Sales Owner | UAT Owner | KPI完了後 | store count/state確認 |

状態: `available`=承認済み数値、`collecting`=未確定、`preparing`=rule/source未準備、`unavailable`=取得不能、`validation_error`=データ確認必要。

再実行は同version上書きでなく新batch/run。rollbackは[Incident Plan](rollback-and-incident-plan.md)に従う。

## Confirmed Decisions

`imported→validated→accounting_approved→management_approved→published`を飛ばさない。`confirmed_through_period`より後をpublishしない。

## Proposed Decisions

利益確定目標を翌月15日前後とし、遅延時は数値を隠して状態表示する。

## Unknowns

実担当者、代理、各SLA、休日、通知先、承認system。

## Blocking Items

DEC-OPS-001、職務分離、監視、代理承認、incident escalation。

## Required Approvers

Accounting Owner/Approver、Management Approver、Sales Owner、Platform Owner。

## Evidence／Source

- [Accounting Core operations](../../accounting/accounting-core-phase3-2-operations.md)
- [Monitoring](monitoring-and-operations.md)

## Exit Criteria

役割、代理、期限、audit evidence、失敗・retry・rollbackをStagingで一巡し承認する。
