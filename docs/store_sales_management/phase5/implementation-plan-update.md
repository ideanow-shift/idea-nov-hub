# Store Sales Management Phase 5 実装前提更新

## CTO追加指示の反映

Phase 5の依存方向を次に固定する。

`Accounting Core -> Accounting KPI Engine -> Store Status Engine -> Store Sales Projection API -> Store Sales UI`

UIは`storeSalesProjection`だけを呼び、Accounting API、KPI API、Directory APIを直接呼ばない。
会計式、税込変換、KPI計算、店舗状態、Priority Action、一覧順序をUIへ持たせない。

## Projection API責務

- Executive Summary
- Priority Actions（最大3件）
- Business Drivers
- Store List
- Store Detailと「今月やること」（最大3件）
- actor scope内データだけを返す
- 未取得値を`null`と明示的な`dataState`で返す

現行本番schemaにはAccounting/KPIのpublished projectionがまだない。このため初期接続では
server-side scopeで解決した店舗directoryを返し、数値はすべて`preparing`とする。
0、carry-forward、未承認税込変換を表示値へ変換しない。

## Store Status Engine

rule registryをserver-side moduleとして分離した。初期ruleは、経常利益赤字、営業利益率
15%未満、validation error、データ確定遅延、複数指標改善、利益率・目標達成を扱う。
最優先matched ruleが状態を決定し、一覧は次の順にProjection APIでsortする。

1. Needs Attention
2. Improving
3. Stable
4. Good

AI判定はPhase 5に含めない。

## 本番境界

本変更はprototype sourceのみであり、migration、RLS変更、deploy、本番データ接続を含まない。
Accounting/KPI実projection adapterは、各成果のproduction gate承認後にProjection API内部へ
接続する。UI契約はその際も変更しない。

