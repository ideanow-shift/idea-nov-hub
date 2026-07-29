# Rollback and Incident Plan

## Purpose

各layerを独立して封じ込め・rollbackし、復旧と検証まで行う。

## Current State

Accounting/KPI prototypeのversion rollback設計はあるが、Staging rehearsal、owner、RTO/RPO、連絡経路は未確定。

## Target State

| Layer | Containment / rollback |
|---|---|
| Accounting publication | active停止、新`rollback_restore` versionを二段階承認・publish |
| KPI active result | 障害run除外、前提Accountingに対する新run/recalculate |
| Projection API | traffic停止または前artifactへ戻す |
| Store Sales UI | 前artifactへ戻す |
| NOV HUB card | feature flagで非表示 |
| Runtime | production flagを再block（責務変更なし） |
| Staging data | access停止、承認済み削除/restore |
| secrets | revoke/rotate、利用主体再認証 |
| migration | forward fix優先、承認済みdown/restore手順 |

Severity候補: SEV1=重大漏洩/全停止、SEV2=広範囲誤数値/認可障害、SEV3=限定機能/一部店舗、SEV4=軽微表示。

Flow: detection→Incident Commander任命→containment→communication→rollback→recovery→business/security validation→postmortem。

暫定案（`proposed`）: UI/API RTO 30分、会計再公開RTO 4時間、published version RPO 0。正式承認前。

## Confirmed Decisions

published factをUPDATE/DELETEしない。Runtime責務追加で障害回避しない。金額/tokenをincident logへ出さない。

## Proposed Decisions

四半期または大変更前にrollback rehearsalを行い、NOV HUB card offとproduction reblockを最初のcontainment optionにする。

## Unknowns

DEC-RTO-001、Incident Commander、連絡先、backup/restore SLO、status communication。

## Blocking Items

DEC-INC-001、監視、artifact retention、migration/secret rehearsal、business validation owner。

## Required Approvers

Incident Commander、CTO、Platform Owner、Security Owner、Accounting/Management Approver。

## Evidence／Source

- [Accounting Core result](../../accounting/accounting-core-phase3-2-result.md)
- [Monitoring](monitoring-and-operations.md)

## Exit Criteria

全layerのrehearsal、時間測定、連絡、復旧後scope/金額/freshness検証、postmortem templateが承認済み。
