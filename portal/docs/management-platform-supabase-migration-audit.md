# Supabase Migration Dependency Audit

作成日: 2026-07-01
対象: NOV HUB / Management Platform / Management OS

## 結論

Management Platform本体の保存先は、Core DB / Supabase中心へ移行済み。
ただし、NOV HUB周辺・外部成果データ・写真URL・一部既存アプリでは、Spreadsheet / GAS / Google Drive / POS等の外部ソース参照が残る。

現時点の方針は「全データを無理に一括移行」ではなく、以下に分けて進める。

1. Management Platform固有の履歴データ: Supabaseへ集約済み、継続
2. Coreマスタ: Core DB既存テーブル参照、重複作成しない
3. 外部実績ソース: 初期は取り込み/スナップショット化、将来APIまたは正規化
4. HUB運用情報: Core DB化候補として段階移行
5. 既存GASアプリ: 即停止せず、移行対象を個別判断

## Supabase移行済み

| 領域 | Supabaseテーブル | 状態 | 備考 |
| --- | --- | --- | --- |
| 環境整備チェック項目 | management_check_items | 移行済み | 29項目をDB管理。version / is_current対応済み |
| 環境整備チェック本体 | management_checks | 移行済み | 店舗・期間・承認・履歴管理対応 |
| チェック結果 | management_check_results | 移行済み | score / boolean / text対応済み |
| 写真 | management_check_photos | DB設計済み | Phase2でStorage本格対応予定 |
| 操作ログ | management_operation_logs | 移行済み | Management固有ログとして運用 |
| 改善アクション | management_improvement_actions | 移行済み | Phase4。環境整備・成果どちらの改善にも使う |
| 成果KPI | management_performance_snapshots | 移行済み | POS/予算/NPS等の集約スナップショット |
| 店舗取り組み | management_performance_initiatives | 移行済み | 今月/来月の取り組み、店舗課題 |
| 社員/店舗/部署/役職/権限 | employees / stores / departments / positions / roles | Core DB参照 | Management側では新規作成しない |

## まだSpreadsheet/外部依存が残る領域

| 領域 | 現在の依存 | 移行判断 | 優先度 | 方針 |
| --- | --- | --- | --- | --- |
| NOV HUBアプリ一覧 | portal/apps.json / HUB API / 運用元データ | Core DB化候補 | 中 | appsマスタをCore DB化し、HUBはAPI参照へ寄せる |
| NOV HUBログイン補助 | Firebase / HUB API / 一部GAS運用 | 継続しつつCore DB連携 | 高 | Firebase UID -> employees -> roles の流れを標準化 |
| アクセスログ | access_logs / HUB API | Supabase化対象 | 高 | service_role権限付与済み。HUB監査ログとして整理 |
| IDEA LINK | GAS URL直接参照 | 別プロジェクトで判断 | 低 | Management Platformの移行範囲外 |
| 写真URL | Google Drive等URL入力 | Phase2でSupabase Storage候補 | 中 | 当面URL履歴保存。正式運用はStorageへ |
| POSデータ | 外部/POS/CSV等 | source_detail付き取り込み | 高 | performance_snapshotsへ日次/月次集約 |
| 予算管理 | Spreadsheet想定 | source_detail付き取り込み | 高 | 月次KPIとしてsnapshotへ集約 |
| キャンペーン/NPS/eNPS | Spreadsheet/手入力想定 | source_detail付き取り込み | 中 | Phase5ではスナップショット、将来正規化 |
| 既存マネジメントチェックSheet | 旧データ/参照元 | 移行完了後は参照専用 | 中 | 29項目はSupabase管理。過去履歴移行は必要に応じて実施 |

## 移行優先順位

### Phase A: Management Platformの完全DB運用

- `management_check_items` を唯一のチェック項目マスタにする
- 新規環境整備チェックはSupabaseにのみ保存
- 改善アクションは `management_improvement_actions` に統一
- 成果改善も同じ改善アクションDBを使う

### Phase B: 写真管理

- 現在: Google Drive等のURLを履歴として保存可能
- 次: `management_check_photos` + Supabase Storageへ寄せる
- 目的: 写真複数枚、撮影者、削除履歴、AI分析用メタデータを保持

### Phase C: 成果データ取り込み

- POS/予算/NPS/eNPS/キャンペーンは、直接参照ではなく `management_performance_snapshots` に集約
- 元データの出典は `source_detail jsonb` に保存
- 将来、元データがCore DB化されたら参照IDへ置き換える

### Phase D: HUBマスタのCore DB化

- HUBアプリ一覧、権限表示、アクセスログをCore DBに寄せる
- フロントは静的JSONからAPI取得へ段階移行
- ただしGitHub Pages配信は継続可能

## 重要な設計ルール

- Management Platform固有データは `management_` prefix
- Coreマスタは既存Core DBを参照し、重複作成しない
- 物理削除ではなく `status / is_active / deleted_at / deleted_by_employee_id`
- AIは評価者ではなく、比較・要約・改善提案・優先順位付け・成長分析のみ
- Spreadsheetは「正式保存先」ではなく、移行元/外部入力元/一時運用元として扱う

## 次にやること

1. 写真管理をSupabase Storageへ寄せる設計を作る
2. 成果データ取り込みのCSV/手入力フローを固める
3. HUBアプリ一覧をCore DB化するDDL案を作る
4. Spreadsheet依存が残る既存アプリをプロジェクト別に棚卸しする
5. Obsidian change-logへ移行状況を継続記録する
