# Monitoring and Operations

## Purpose

月次データとStore Sales Runtime/APIの異常を、秘密や金額を漏らさず検知する。

## Current State

prototypeに正式monitoring、alert、SLO、owner、retentionはない。

## Target State

| Signal | Event/metric | Proposed alert |
|---|---|---|
| import/validation | batch status、blocking count | failedまたはblocking>0 |
| approval/publish/rollback | transition、actor、version | 不正順序・遅延 |
| KPI | run status、duration、freshness | failed、publish後未完了 |
| Projection | request count、p95、error/deny | SLO超過、5xx増加 |
| Runtime | offline/timeout/maintenance | 継続率閾値TBD |
| data freshness | confirmed period、last publish | 翌月15日前後の遅延 |
| completeness | missing stores、preparing割合 | expected count不一致 |

ログはrequest/batch/version ID、actor ID、scope key、period、status、durationに限定し、金額、token、private科目名、raw responseを禁止する。

## Confirmed Decisions

access denied、session失効、publish delay、missing storeを監視対象に含める。

## Proposed Decisions

SEV別paging、dashboard、月次運用checklist、監査証跡retentionを環境別に設ける。

## Unknowns

監視基盤、閾値、retention、on-call、通知先、担当者。

## Blocking Items

DEC-OPS-001、DEC-INC-001、SLO/RTO、audit schema、Staging測定。

## Required Approvers

Platform Owner、Accounting Owner、Security Owner、Incident Commander。

## Evidence／Source

- [Monthly Runbook](monthly-accounting-runbook.md)
- [Incident Plan](rollback-and-incident-plan.md)

## Exit Criteria

Stagingでalert発火、担当通知、runbook遷移、秘密非露出、復旧確認まで演習済み。
