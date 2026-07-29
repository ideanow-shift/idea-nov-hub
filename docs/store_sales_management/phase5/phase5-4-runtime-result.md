# Phase 5-4 Store Sales Runtime Integration 結果

## 判定

**Conditional Go** — mock Previewと隔離integration/stagingのRuntime検証へ進める。本番接続はNo-Go。

## 実装

- `portal/store-sales/runtime/`を追加
- UI importをRuntime単一入口へ変更
- 10種類のRuntime State（`maintenance`を含む）
- 5種類のFeature Flag（`preview`を含む）
- adapter管理、loading、empty、error mapping、retry
- session restore、refresh hook、update、401 clear
- Projection切替API
- maintenance/timeout/offline時の再試行button
- production blockingを維持

## Safety

Accounting/KPI/Projectionの業務ロジックは変更していない。UIによるAccounting/KPI API、Projection adapter、DB、service roleの直接利用はない。本番Supabase、DB、Storage、NOV HUB、IDEA LINKへ接続・deployしていない。

## Test

2026-07-29に149/149件が合格した。

- Store Sales Runtime / Preview / Adapter / UI: 84/84
- Store Sales Projection: 4/4
- Accounting Core: 28/28
- Accounting KPI: 33/33
- Runtime固有: 16/16
- NOV NAVI dashboard boundary: 合格
- Node/Deno構文・型、JSON、`git diff --check`: 合格
- Windows `start-preview.bat`のcmd.exe起動check: 合格

実ブラウザで`NOV HUB -> 店舗営業管理 -> Runtime -> Preview Mode`を確認し、Store List表示、Runtime起動errorなし、application console error/warning 0件だった。

## Freeze

Phase 5-4の承認要件を満たしたため、Store Sales Runtimeの責務を凍結する。次フェーズはStore Sales Production Readinessとし、Runtime責務の追加は重大障害修正またはCTOの例外承認に限定する。

## Blocking

- production Projection endpointとserver-side actor scope承認
- session refresh実装の正式なHUB API結合
- staging E2Eと監査ログ
- Corporate Management共通Runtime package境界のowner合意
- production Feature Flag有効化の明示承認
