# 既存資産一覧

## 確認済み資産

| 資産 | 場所 | 現状 | 判定 |
|---|---|---|---|
| 店舗営業管理画面 | `portal/management-app/` | 店舗一覧、法人画面、ローカル取込、比較表示の骨格 | Extend |
| 現行画面ロジック | `portal/management-app/app-v2.js` | API読取、local preview、複数CSV補助 | Extend |
| 旧画面ロジック | `portal/management-app/app.js` | 現行との重複候補。利用経路の確認が必要 | Archive候補 |
| responsive CSS | `portal/management-app/styles.css` | 768px/480pxのbreakpointあり | Reuse |
| 店舗CSV要件UI | `store-csv-requirements.js` | 必要ファイルをfail-closedで案内 | Reuse |
| 月次予算CSV | `store-monthly-budget-csv.js` | period、法人、店舗、売上/利益予算 | Reuse |
| 客数CSV | `store-customer-summary-csv.js` | local validationあり。正規化結果の項目保持は要再確認 | Extend |
| リピート/来店コホートCSV | `store-repeat-summary-csv.js`、`store-visit-cohort-summary-csv.js` | local preview | 後続へ保留 |
| 人員月次CSV | `store-workforce-monthly-summary-csv.js` | 在籍/稼働人数のlocal preview | Extend |
| メニューCSV | `store-menu-summary-csv.js` | 技術カテゴリ/メニュー/売上のlocal preview | 後続へ保留 |
| P/L local intake | `financial-data-intake.js`、`store-pl-quick-intake.js` | 本番保存なしの検証導線 | Reuse |
| read-only API候補 | `supabase/functions/nov-hub-api/management_readonly_candidate.ts` | actor scope、法人/店舗読取。店舗売上はplaceholder | Extend |
| Core master | `public.employees`、`public.stores`、`public.corporations` | 現在の物理正本候補 | Reuse |
| 店舗配属 | `employee_store_assignments` | 複数店舗・有効日を保持 | Extend |
| 配属履歴 | `employee_assignment_histories` | 法人/部門/店舗/役職/雇用状態の履歴 | Reuse |
| 財務月次 | `finance_monthly_*` | 法人・部門P/L等のread-only表示 | Reuse（照合用） |
| KPI snapshot | `management_performance_snapshots` | 集計スナップショットとして文書化 | Extend（派生のみ） |
| 改善/チェック系 | `management_improvement_actions`等 | 管理業務用テーブルとして文書化 | Extend |

## 設計のみで未実装

`sales_import_batches`、`sales_transactions`、`sales_transaction_lines`、`sales_payments`、`sales_adjustments`、`sales_daily_closes`、`sales_metric_definitions`、`sales_reconciliation_runs`、`sales_external_id_mappings` は再構築設計にあるが、既存の物理テーブルとしては確認していない。これらを「既存DB」と扱ってはならない。

## テスト状態

関連テストを実行し、57件中54件成功、3件失敗だった。失敗はファイル種別のエラー分類1件とソース回帰条件2件である。Phase 0では既存コードを変更していないため、再利用時に解消する品質負債として扱う。

## GitHub全体調査の限界

本調査はローカルcloneに存在する履歴・ファイルを対象とした。別repository、GitHub管理画面、未clone branch、外部サービス管理画面にしかない資産はUnknownである。
