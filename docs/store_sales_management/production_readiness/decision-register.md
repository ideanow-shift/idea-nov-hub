# Production Readiness Decision Register

## Purpose

業務・技術・運用判断を、未確認のままapprovedにしない正式台帳として管理する。

## Current State

16 decisions: `approved=0`、`proposed=4`、`under_review=3`、`unknown=6`、`blocked=3`、`rejected=0`。

## Target State

| decision_id | title | status | proposal | alternatives | impact | required_approvers | owner | target_date | evidence | decided_at | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DEC-PR-001 | Phase 3 PRと依存順 | under_review | Phase3→4→5→5-5A | squash/retarget | merge安全性 | CTO, Maintainer | TBD | TBD | [sequence](deployment-sequence.md) | TBD | Phase3 PRなし |
| DEC-STG-001 | Staging Supabase新設 | proposed | Productionと別project | 現行流用（非推奨） | 分離・費用 | CTO, Platform, Security | TBD | TBD | [architecture](staging-architecture.md) | TBD | ID/URLを創作しない |
| DEC-STG-002 | Staging NOV HUB公開方式 | unknown | 専用origin候補 | Preview service等 | session/CORS | Platform, Security | TBD | TBD | [architecture](staging-architecture.md) | TBD | 方式未確認 |
| DEC-DATA-001 | Stagingデータ段階 | proposed | synthetic→masked→limited | 全店舗実データ | UAT/漏洩 | Accounting, Security, UAT | TBD | TBD | [UAT](uat-plan.md) | TBD | rollback必須 |
| DEC-MAP-001 | 38 entityとCore UUID | blocked | 4者承認 | 名称自動一致 | 誤scope/金額 | Accounting, Core, Sales, Management | TBD | TBD | [mapping](data-and-mapping-approval.md) | TBD | 0/38 approved |
| DEC-ACC-001 | Accounting account group | under_review | 15項目台帳でrelease | prototypeのまま | KPI/表示 | Accounting, Management | TBD | TBD | [dictionary](accounting-dictionary-approval.md) | TBD | release 0 |
| DEC-KPI-001 | KPI definition set | under_review | 6初期KPIを正式release | 全候補同時 | 指標整合 | Accounting, Management | TBD | TBD | [KPI report](../../accounting/accounting-kpi-phase4-final-report.md) | TBD | checked-in proposed |
| DEC-TAX-001 | 税込売上変換 | blocked | versioned tax rule | 1.1倍（禁止） | 売上正確性 | Accounting, Management, Sales | TBD | TBD | [tax](tax-inclusive-sales-rule.md) | TBD | 税区分不明 |
| DEC-ROLE-001 | 正式role/scope | proposed | 7 role/6 scope候補 | app独自role | 認可 | Management, Sales, Security | TBD | TBD | [role](role-scope-approval.md) | TBD | employee deny候補 |
| DEC-PROFIT-001 | 利益閲覧範囲 | unknown | scope連動候補 | role別例外 | 機密性 | Management, Accounting, Sales | TBD | TBD | [role](role-scope-approval.md) | TBD | 正式承認なし |
| DEC-SEC-001 | RLS/Security owner | unknown | Security Ownerを指名 | 兼任 | gate責任 | CTO, Security | TBD | TBD | [security](security-and-rls-review.md) | TBD | 個人名TBD |
| DEC-OPS-001 | 月次運用責任者 | unknown | role別RACI | ad hoc | 締め遅延 | Accounting, Platform, Management | TBD | TBD | [runbook](monthly-accounting-runbook.md) | TBD | 代理もTBD |
| DEC-UAT-001 | UAT責任者 | unknown | UAT Owner指名 | Sales兼任 | sign-off | CTO, Sales | TBD | TBD | [UAT](uat-plan.md) | TBD | TBD |
| DEC-INC-001 | Incident責任者 | unknown | Incident Commander指名 | 当番制 | 復旧 | CTO, Platform, Security | TBD | TBD | [incident](rollback-and-incident-plan.md) | TBD | TBD |
| DEC-RTO-001 | RTO/RPO | proposed | API 30分/Core 4h/RPO0候補 | TBD | 復旧投資 | CTO, Platform, Accounting | TBD | TBD | [incident](rollback-and-incident-plan.md) | TBD | 正式承認前 |
| DEC-GO-001 | Production最終承認 | blocked | CTO+経理+営業+Security+経営 | 単独承認（非推奨） | production risk | listed roles | TBD | TBD | [checklist](production-go-live-checklist.md) | TBD | 0/29 |

## Confirmed Decisions

許可statusは`proposed/under_review/approved/rejected/blocked/unknown`。owner/date不明はTBD。

## Proposed Decisions

decision変更をPR review対象とし、evidenceとapproverなしにapprovedへ変更できないようにする。

## Unknowns

owner、target date、個人approver、正式会議体。

## Blocking Items

blocked 3件とunknown 6件。Production GoはDEC-GO-001がblocked。

## Required Approvers

各行の`required_approvers`。

## Evidence／Source

本directoryの20文書、Phase 3〜5の設計・結果、GitHub remote/PR metadata。

## Exit Criteria

Production必須decisionがapproved、evidence/owner/date/decided_atを保持し、rejected/blocked/unknownがGo対象に残らない。
