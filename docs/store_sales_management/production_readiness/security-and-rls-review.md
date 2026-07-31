# Security and RLS Review

## Purpose

Accounting、KPI、Projection、session、cacheのdefault-deny境界をProduction候補として固定する。

## Current State

Core/KPIにreview-only DDL/RLS案があり、未適用。frontendはRuntimeだけを利用しproduction modeはblocked。

## Target State

- 全table RLS enabled、policyなしdefault denyから開始
- anon/authenticatedのraw/mapping/approval/audit/provenance直接権限revoke
- actorは検証済みsessionからserver-side解決
- store/department/FC/legal entity越境拒否
- SECURITY DEFINERは専用NOLOGIN owner、固定`search_path`、最小権限
- Storageはprivate、短時間signed URL、path scope検査
- frontend service role禁止
- cache keyにactor/session、scope version、period、store、projection version
- secretsは環境別secret manager、rotation・access audit
- access denied、session失効、rate limitを監査

## Confirmed Decisions

raw response、token、金額、private科目名をlogへ出さない。role/scope自己申告と共有cacheを禁止する。

## Proposed Decisions

RLS negative suiteをmigrationごとに必須化し、Security OwnerのapprovalなしでStaging/Productionへ進めない。

## Unknowns

正式DB roles、security owner、retention、signed URL TTL、key rotation、incident連絡。

## Blocking Items

review-only SQLの正式化、RLS関数review、FC/Store mapping、secret分離、penetration review。

## Required Approvers

Security Owner、Platform Owner、Accounting Owner、CTO。

## Evidence／Source

- [Accounting Core result](../../accounting/accounting-core-phase3-2-result.md)
- [KPI review SQL](../../accounting/accounting-kpi-postgresql-review.sql)
- [Phase 5-2 Security](../phase5/phase5-2-security.md)

## Exit Criteria

default-deny、全越境、service-role自己申告、session失効、cache isolation、Storage、SECURITY DEFINERのnegative testが全件合格する。
