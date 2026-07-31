# Performance Test Plan

## Purpose

20店舗と将来拡張時のProjection/Runtime性能、N+1、timeout、retryを測定する。

## Current State

Staging測定なし。Runtime timeoutは8秒。以下の数値はすべて`proposed`でapprovedではない。

## Target State

| Measure | Proposed threshold |
|---|---|
| 20店舗dashboard warm p95 | <= 2.0s |
| Store Detail warm p95 | <= 1.5s |
| cold start p95 | <= 3.5s |
| Runtime timeout | 8.0s |
| concurrency | 50 actor候補 |
| error rate | TBD |
| throughput | TBD |

Scenarioはcache hit/miss、scope種別、cold start、retry、timeout、publish直後、20店舗、50/100/将来店舗、detail burstを含む。DB query countを計測し店舗数に比例するqueryを失敗とする。actor別cache混入をnegative testする。

## Confirmed Decisions

N+1を禁止し、timeoutを無限延長しない。性能改善でscope/securityを弱めない。

## Proposed Decisions

初期cache offでbaselineを取り、private cacheはisolation test後に導入判断する。

## Unknowns

production SLO、データ量、concurrency実績、region、cold start特性、rate limit。

## Blocking Items

Staging API、代表data、observability、load generator、SLO承認。

## Required Approvers

Platform Owner、Security Owner、CTO、UAT Owner。

## Evidence／Source

- [Projection API Design](projection-api-production-design.md)
- [Runtime Design](../phase5/phase5-4-runtime-design.md)

## Exit Criteria

提案値を承認済みSLOへ更新し、全scenario・N+1・cache isolation・error budgetが合格する。
