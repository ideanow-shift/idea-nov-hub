# 08 Migration Strategy

## 移行原則

- 旧機能を削除せず、再現可能な状態で保存する。
- Core Masterは変更しない。
- 新旧の同時書き込みを避け、領域ごとにsingle writerを宣言する。
- 切替単位は画面ではなく、データ責任とoperation。
- 各Gateは証跡が揃うまで次へ進めない。

## Phase 0: 既存機能の保存

1. 対象commit SHA、deployment URL、HUB `portal_apps`行、環境変数名、Edge versionを記録。
2. 旧画面、API action、table/View/RPC、role/scope、外部sourceをmanifest化。
3. 代表データの件数・金額・hashをSELECT-onlyで保存。
4. rollback手順と所有者を記録。
5. RLS/Policy/Grant/Function definition/Storage policyをライブcatalogから取得。

Gate: ソースだけでなく、稼働構成と数値baselineを復元できる。

## Phase 1: Legacy凍結

1. 店舗営業旧機能とHR previewにLegacy ownerを設定。
2. 機能追加を停止し、Critical bug/security fixのみ許可。
3. Legacy UIに新規writeを追加しない。
4. app_idを新旧で分け、アクセスログを収集。
5. 未使用候補の90日観測を開始。

Gate: 凍結対象、例外承認者、復旧方法が文書化される。

## Phase 2: 新Webアプリ構築

### 共通foundation

- Firebase→employee→role/scope adapter。
- Core Master read adapter。
- audit/correlation/error contract。
- app-specific CORS/audience/handoff。
- contract/negative authorization tests。

### 店舗営業

- input sourceとKPI辞書の承認。
- 取込、検証、締め、snapshot、reconciliation。
- Management check/改善の移行。

### 現職者

- onboarding case、employee link。
- 配属/在籍履歴、PII、文書、手続。
- Core変更申請。

Gate: production dataを書かない環境で、契約・権限・状態遷移が通る。

## Phase 3: 新旧並行テスト

### shadow read

- 新アプリは本番のread replica相当またはread-only APIから計算。
- 旧機能がwriterのまま。
- 画面、集計、scopeを比較。

### controlled write

- 対象店舗/対象人事caseを限定。
- operationごとにwriterを一つにする。
- dual-writeではなく、新writerの結果を旧画面がreadできる形を優先。
- rollbackは導線とwriter flagを戻す。データを手作業で巻き戻さない。

Gate: 重大権限漏れ0、重複0、再試行で同一結果。

## Phase 4: 数値・データ検証

### 店舗営業

- transaction/line/payment件数。
- 店舗日次・月次売上、税、値引、取消、返品。
- 技術/店販/担当/支払別。
- 法人P/Lとの調整差額。

### 現職者

- employee linkの一意性。
- active/leave/retired件数。
- 現在配属とas-of履歴。
- onboarding caseとemployeeの対応。
- 書類件数、期限、閲覧権限。

### 共通

- orphan FK 0。
- actor/app/correlation監査率100%。
- unauthorized negative test 100%拒否。
- Core Master baselineに予期しない差分0。

Gate: ownerが署名したreconciliation report。

## Phase 5: NOV HUB導線切替

1. 新app_idとURLを先に非表示登録。
2. pilot role/scopeだけに表示。
3. openApp access logとhandoffを確認。
4. 新アプリを既定導線に変更。
5. 旧カードは「Legacy参照」へ名称変更または管理者のみ表示。
6. `portal_apps`とfallback/fixed appを同一release manifestで更新。

Gate: 認証loop、403誤判定、旧URL誤誘導がない。

## Phase 6: 旧機能の停止

- 旧writerを停止しread-onlyにする。
- API write actionを権限面から閉じる変更案を別承認。
- 旧機能の最終snapshotと利用ログを保存。
- emergency rollback windowを定める。
- DB/Table/Functionは削除しない。

Gate: 新writerが安定し、rollback windowを経過。

## Phase 7: 廃止判断

次を全て満たすまで廃止しない。

1. 90日以上利用なし。
2. 業務owner、法務/経理/人事、セキュリティ承認。
3. 保存期間・監査要件を満たす。
4. exportとrestore test済み。
5. 外部GAS/BI/手動運用から参照なし。
6. Core Master、FK、View、Functionの依存なし。

廃止のDDL/コード削除は本タスク外の独立変更として扱う。

## Rollback

| 障害 | 対応 |
| --- | --- |
| HUB導線のみ | portal routeを旧read-onlyへ戻す |
| 新API認可 | 新writer flagを閉じ、旧承認済みwriterへ戻す |
| 集計差 | snapshot公開を停止し、最後の確定versionを参照 |
| onboarding重複 | 自動再実行を止め、idempotency keyとlinkを監査 |
| PII漏えい疑い | 該当route/signed URLを停止、access log保全、incident対応 |

RollbackのためにCore Masterを上書き・削除してはならない。

