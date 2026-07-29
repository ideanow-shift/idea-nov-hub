# Store Sales Production Readiness Assessment

## Purpose

Phase 3〜5のprototypeを、localhost Previewから完全分離されたStagingへ移すための条件を固定する。Phase 5-5Aは文書・承認設計のみで、接続、migration、deployを行わない。

## Current State

- Preview: Go。Production: No-Go。
- Phase 3 remote branchは存在するがPRは未確認。Phase 4 Draft PR #6はPhase 3 base。Phase 5 remote branchはpush済みだがPR未作成。
- Accounting Core、KPI、Projection、Runtime、UIはprototype。Runtime責務は凍結済み。
- Staging専用Supabase、NOV HUB、URL、secrets、ownerはUnknown。

## Target State

Phase 3→4→5の依存を解決し、環境分離、承認済みmapping/dictionary/tax/role、RLS、actor-scoped API、監視、UAT、rollbackを満たしたStagingを構築する。

## Confirmed Decisions

- UIはRuntimeのみ、RuntimeはStore Sales Projectionのみを利用する。
- Accounting/KPIの業務ロジックをRuntime/UIへ移さない。
- production modeは最終承認までblocked。
- frontend service role、role/scope自己申告、一律1.1倍を禁止する。
- StagingはProductionと完全分離する。

## Proposed Decisions

- データはsynthetic→masked→限定実データの順で段階導入する。
- Critical pathは8〜12週。性能暫定値は[Performance Test Plan](performance-test-plan.md)で管理する。

## Unknowns

Staging資産、担当者名、RTO/RPO、正式role/scope、利益閲覧範囲、Core UUID、税規則、正式account group/KPI release。

## Blocking Items

Decision Registerのapproved化、Staging、migration/RLS、Projection API、session integration、E2E/UAT、rollback、monitoring。

## Required Approvers

CTO、Platform Owner、Accounting Approver、Management Approver、Sales Owner、Core Master Owner、Security Owner。

## Evidence／Source

- [Accounting Core結果](../../accounting/accounting-core-phase3-2-result.md)
- [KPI Phase 4結果](../../accounting/accounting-kpi-phase4-final-report.md)
- [Phase 5 Runtime結果](../phase5/phase5-4-runtime-result.md)
- [Decision Register](decision-register.md)

## Exit Criteria

[Production Go-Live Checklist](production-go-live-checklist.md)の必須項目が100%完了し、DEC-GO-001がapprovedであること。現時点は**No-Go**。
