# Store Sales Projection API Production Design

## Purpose

UI専用read-only Projection APIのProduction候補契約を固定する。

## Current State

rule-based Projection builder、adapter contract、Runtimeは存在するが、正式actor-scoped endpoint、DB接続、deploy、auditは未実装。

## Target State

### Endpoints

- `GET /v1/store-sales/dashboard?period=YYYY-MM`
- `GET /v1/store-sales/stores/{storeId}?period=YYYY-MM`
- `GET /health`（秘密・依存詳細を返さない）

RequestはBearer session、period、detail store ID、許可されたpagination/filter/sortのみ。Responseは`contractVersion=store-sales-projection-v1`、`generatedAt`、actor scopeに整形済みのExecutive Summary、Actions、Drivers、Stores/Detail、data state、provenance ID候補を返す。

### Server flow

session検証→Directory actor/scope解決→scope内store set一括取得→published Accounting一括取得→active KPI一括取得→Status Engine→Priority Rules→contract validation→監査。

dashboardはset-based query/batchでN+1を禁止。detail store IDをscopeに再照合する。

### Controls

| Control | Proposal |
|---|---|
| cache | actor/scope version/period/store/projection versionで分離、private/no-storeから開始 |
| timeout | server budget TBD、Runtime 8秒以内 |
| rate limit | actor/session/IP候補、閾値TBD |
| audit | request ID、actor ID、scope key、period、status、duration。金額/tokenなし |
| error | 401/403/404/422/429/503/timeoutをRuntime stateへ安全にmapping |
| deployment | Staging専用Edge Function候補 |
| rollback | 前artifactへ戻し、Runtime production blockまたはHUBカードoff |

## Confirmed Decisions

UI/RuntimeにAccounting、KPI、status、priorityの業務ロジックを移さない。未取得を0にしない。

## Proposed Decisions

初期cacheはoff。測定後にprivate cacheを承認する。contract version変更は互換性review必須。

## Unknowns

deployment service、rate、timeout内訳、cache TTL、Directory API、監査sink、pagination上限。

## Blocking Items

Accounting/KPI migration、mapping/release、session、RLS、Staging、contract/security/performance test。

## Required Approvers

Platform Owner、Security Owner、Accounting Owner、Sales Owner、CTO。

## Evidence／Source

- [Phase 5-2 Integration](../phase5/phase5-2-integration-design.md)
- `supabase/functions/nov-hub-api/store_sales_projection.ts`
- [Runtime Design](../phase5/phase5-4-runtime-design.md)

## Exit Criteria

両endpointのcontract、scope、N+1、error、audit、rate、timeout、rollback、health、Staging E2Eが合格する。
