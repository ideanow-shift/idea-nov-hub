# Phase 5-2 Read-only Integration 設計

## 結論

Phase 5-2は、既存UIを変更せずにsyntheticなread-only Projectionへ接続できるところまでを対象とする。本番接続、Edge Function deploy、migration、認証・RLS変更は対象外である。

## Architecture

```text
Accounting Core (published)
  -> Accounting KPI Engine (active consumer projection)
  -> Store Status Engine / Priority Action Rules
  -> Store Sales Projection API
  -> Adapter contract validation
  -> Store Sales UI
```

UIが利用するデータ境界はStore Sales Projection APIだけである。Accounting、KPI、Directory、DB、Supabase tableをUIから直接参照せず、20店舗分のN+1取得も行わない。

## Aggregate API案（review-only）

- `GET /v1/store-sales/dashboard?period=YYYY-MM`
- `GET /v1/store-sales/stores/{storeId}?period=YYYY-MM`

サーバーはNOV HUB sessionからactorを解決し、Directory、published Accounting、active KPI、Status Engine、Priority Action rulesを一括集約する。クライアントが送信できるのはperiod、tab、filter、pagination、sortおよび詳細対象store IDだけで、store IDはサーバーでscope内か再検証する。

dashboardはExecutive Summary、Priority Actions、Business Drivers、優先順位済みStore Listを返す。detailはSummary、「今月やること」最大3件、Sales & Profit、Customer & Repeat、Value & Productivityを返す。

## Blocking

- production modeの承認と接続先確定
- Projection API/Edge Functionの実装・セキュリティレビュー
- published version、entity mapping、account group、税込ruleの人間承認
- NOV HUB session/RLSによるactor scope結合試験
- stagingでの負荷、監査ログ、障害復旧確認

