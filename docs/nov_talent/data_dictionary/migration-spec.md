# NOV Talent Migration仕様

## 1. 適用する辞書

本仕様は `NOV_TALENT_DATA_DICTIONARY` Version `1.3.0` を参照する。辞書と本仕様が矛盾する場合はMigrationを安全停止し、推測で補完しない。

## 2. Migration対象行

次の7項目のうち、いずれか1項目以上が入力されている行をMigration対象とする。

- 氏名
- 学校
- 電話番号
- メール
- LINE
- イベント
- ステータス

null、空文字、空白文字だけの値は未入力として扱う。No.だけ採番された空テンプレート行はMigration対象外とする。

この定義は行をMigration母集団へ含める条件であり、Candidate同一性、移行先Entity、canonical昇格を自動確定する条件ではない。

## 3. 現在の確認値

最新read-only観測では、27卒接触Sourceの採番済み541行のうち、Migration対象は528行、No.だけの対象外テンプレートは13行である。旧547／535／12は過去の監査値であり、現在のMigration receiptには使用しない。

## 4. Migration契約

次の4データ契約はVersion 1.2.0で仕様確定し、Version 1.3.0でStaging先行運用契約を追加した。

- Candidate同一性契約
- Human Review安定ID証拠構造
- Migration先区分
- Snapshot・受領・Rollback契約

Human Review完了6グループは、Owner確認により `different_person / keep_separate` として安定IDへ記録した。pending reviewと当該グループ由来Quarantineは0件である。正式Source 2件のprivate read-only dry-runは636対象行、Quarantine 0件でPASSし、件数とHashだけを持つSnapshot候補を生成済みである。

Migrationは環境ごとに分離する。StagingはOwner受領、Staging Migration承認、運用開始承認を経て先行利用する。Candidate専用Versioned Dataset schemaはRemote Stagingへ適用済みで、636 CandidateがACTIVEである。ProductionはStaging運用検証完了後の別昇格承認まで `PRODUCTION_MIGRATION_HOLD` とする。

Candidate schemaは `BUILDING / READY / ACTIVE / RETIRED` を固定状態とし、ACTIVEは最大1件、seal前に総数・卒年別件数を一致確認する。Dataset切替は単一transactionで行い、直前ACTIVEをRETIREDとして保持する。Event / ContactとSelection Historyは本schemaの対象外である。

## 5. Private read-only dry-run

- Source: 正式27卒・28卒接触Sourceの2件だけ
- Migration対象: 27卒528行、28卒108行、合計636行
- 対象外テンプレート: 27卒13行、28卒418行
- Candidate候補: 636件（自動集約0件）
- Event / Contact候補: 1,550件
- Selection History候補: 0件
- Quarantine: 0件
- Snapshot候補: `migration-dry-run-snapshot.candidate.json`

個人値はメモリ内だけで処理し永続化していない。Source更新時はHashが変わるため、同じSnapshot候補を再利用しない。

## 6. 安全境界

- Spreadsheetを変更しない
- 本設計更新でDB・Staging・Productionへ書き込まない
- 自動統合・自動削除を行わない
- 個人値を仕様書、ログ、GitHub成果物へ複製しない
- 件数不一致時はMigrationを開始しない

## 7. 初回Staging Migrationの履歴契約

- 環境区分: `OPERATION_VALIDATION_ENVIRONMENT`
- 対象: 27卒528件＋28卒108件、合計636 Candidate
- 初回書込みEntity: Candidateのみ
- 利用機能: Candidate管理、検索、Dashboard
- 初回Migration Source: 承認済み正式Spreadsheet Snapshot
- 初回更新経路: `Spreadsheet Snapshot → read-only preflight → 承認済みImport → Staging`
- 現在の日常更新: NOV Talentの認証済みserver-side API
- Import: versioned snapshot replacement、retry 0、件数・Hash不一致は安全停止
- Production昇格: Staging受入完了後の別承認

初回Migration後のSpreadsheetは参照用アーカイブであり、日常の新規入力、通常更新、双方向同期を行わない。詳細は `staging-operations-contract.json` を機械可読正本とする。
