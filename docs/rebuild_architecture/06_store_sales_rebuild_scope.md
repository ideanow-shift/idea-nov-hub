# 06 Store Sales Rebuild Scope

## 目的

店舗の日々の営業判断に必要な売上・KPI・運営チェック・改善を一つの独立Webアプリへまとめ、法人経営には確定済みの店舗集計だけを供給する。POSそのものを作るかはMVPと分離して判断する。

## 対象ユーザー

| Role | 主な操作 | Scope |
| --- | --- | --- |
| 店長 | 自店舗実績、チェック、施策、改善 | own_store |
| エリア/営業責任者 | 担当店舗比較、承認、改善支援 | assigned_stores |
| 経営者 | 全店舗・法人集計 | all_stores |
| 経理 | 売上締め、会計調整、差額確認 | corporation/all |
| 店舗スタッフ | 自店舗/本人に限定した参照・入力 | own_store/self |
| 監査/管理者 | 履歴・取込・権限監査 | 明示付与 |

## 必要機能

1. 店舗・日/月切替ダッシュボード。
2. 売上取込、batch状態、重複/欠損/訂正の検証。
3. 店舗別、担当別、技術/店販、メニュー、支払別分析。
4. 予算・前年・前月比較。
5. 環境整備/Management check、写真、承認。
6. KPIスナップショットと施策・改善アクション。
7. 締め、再オープン、訂正理由、監査履歴。
8. 法人経営向け確定snapshotの公開。
9. CSV exportとreconciliation report。

会計待機、レジ確定、予約表、顧客カルテ、返金実行はPhase 2以降の別判断とする。

## 使用する既存テーブル

| テーブル | 用途 | 利用方式 |
| --- | --- | --- |
| Core stores/employees/corporations | 店舗・actor・法人 | read-only |
| employee_store_assignments | 兼務と担当scope | read-only、as-of |
| store_business_profiles | 営業補足 | 店舗営業が更新候補 |
| management_checks/items/results/photos | 運営チェック | 継続利用候補 |
| management_performance_snapshots | KPI集計 | 継続利用候補。原票ではない |
| management_performance_initiatives | 店舗施策 | 継続利用候補 |
| management_improvement_actions | 改善 | 継続利用候補 |
| management_operation_logs | 監査 | 継続利用候補 |
| finance_account_classification_rules | 承認済み分類 | read-only |
| attendance/shift確定データ | 人時・予定比較 | read-only |

実装前にライブ列、RLS、件数、query logを再確認する。既存表へ無断で列追加しない。

## 新規テーブル候補

以下は設計候補であり、今回は作成しない。

| 候補 | 責任 |
| --- | --- |
| sales_import_batches | source、digest、店舗、期間、状態、再実行 |
| sales_transactions | 取引header。外部取引ID、営業日時、取消状態 |
| sales_transaction_lines | 技術/商品、数量、金額、担当者 |
| sales_payments | 支払方法、金額 |
| sales_adjustments | 取消、返品、訂正、理由、元取引 |
| sales_daily_closes | 店舗日次締め、version、承認 |
| sales_metric_definitions | KPI辞書。式、単位、丸め、owner |
| sales_reconciliation_runs | POS/取込/法人P&Lとの照合結果 |
| sales_external_id_mappings | 外部店舗/スタッフ/商品コードとCore IDの対応 |

既存外部POSが正式正本なら、原票テーブルをCore DBへ複製せず、import batchとsnapshotだけを持つ案も比較する。

## 画面一覧

| 画面 | MVP | 説明 |
| --- | --- | --- |
| 店舗サマリー | Yes | 売上、客数、客単価、技術/店販、前年差 |
| 全店比較 | Yes | scope内店舗ランキングと異常値 |
| 売上取込 | Yes | file選択、dry-run、mapping、結果 |
| 取込エラー/未対応mapping | Yes | 解消まで確定不可 |
| 日次/月次締め | Yes | 件数・金額・差額・承認 |
| 売上明細drill-down | Yes | PIIを除いた取引/分類確認 |
| Management check | Yes | 項目、結果、写真、承認 |
| 施策・改善 | Yes | owner、期限、成果 |
| KPI定義/権限管理 | Admin | 管理者のみ |
| POSレジ | No | Phase 2判断 |
| 予約表 | No | Phase 2判断 |

## KPI定義

| KPI | 定義案 | 要承認点 |
| --- | --- | --- |
| 総売上 | 取消前の課税/非課税売上合計 | 税込/税抜 |
| 純売上 | 総売上 - 値引 - 取消 - 返品 | 会計P/Lとの調整 |
| 客数 | 確定取引の一意会計数 | 伝票分割/統合 |
| 客単価 | 純売上 ÷ 客数 | 0件時 |
| 技術売上 | approved category=service | 分類owner |
| 店販売上 | approved category=retail | セット商品の按分 |
| 店販比率 | 店販売上 ÷ 純売上 | 分母 |
| 生産性 | 純売上 ÷ 確定労働時間 | 勤怠締め時点 |
| 予算達成率 | 純売上 ÷ 承認予算 | 予算version |
| Management score | 確定check結果の定義済み集計 | 未回答の扱い |

全KPIにtimezone=Asia/Tokyo、営業日境界、単位、丸め、source、versionを持たせる。

## 権限

- 店舗scopeはCore store IDで判定し、店舗名文字列では判定しない。
- assigned scopeは現行Edge候補で無効のため、MVP公開前に実装とnegative testが必須。
- 取込、締め、再オープン、分類承認は別permission。
- 写真はbucket/path単位でcheck/store scopeを強制。
- 法人経営は確定snapshotを参照できるが、店舗取引を編集できない。

## MVP

### 含む

- 既存CSV/外部帳票の一つを正式inputに選定。
- read-only Core Master adapter。
- 店舗売上dashboard、取込dry-run/commit、締め、照合。
- management check、KPI snapshot、改善。
- HUB導線とrole/scope。
- 法人経営向け確定月次snapshot。

### 含まない

- POS会計確定、予約、顧客カルテ、RPA、自動返金。
- 複数POSの同時対応。
- Core Master変更。
- AIによる自動評価・自動確定。

## 既存機能からの移行

| 移行元 | 移行先 |
| --- | --- |
| Management `stores` | 店舗サマリー/全店比較 |
| Management店舗dataops | 売上取込・mapping |
| POS Sales prototype | 分析画面の情報設計 |
| POS Ops prototype | Phase 2の操作要件資料としてFREEZE |
| management checks | Management check |
| snapshots/initiatives/actions | KPI・施策・改善 |

## 法人経営との連携

- 店舗営業が店舗日次/月次を締め、immutableなversion付きsnapshotを公開する。
- 法人経営が会計P/Lと照合し、差額理由を記録する。
- 法人経営は店舗営業原票を上書きしない。会計調整は法人経営側で保持する。
- 店舗営業は法人P/Lを上書きしない。
- 月次切替のacceptance gateは「全店舗締め」「取込digest一致」「P/L差額承認」「再現可能」の4点とする。

