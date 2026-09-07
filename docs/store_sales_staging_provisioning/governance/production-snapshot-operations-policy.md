# Production Snapshot運用規程

## 1. 目的

本規程は、Store Operations向けProduction Snapshotを、Productionへの常時接続を作らず、安全に取得・審査・投入・停止するための会社運用基準を定める。

## 2. 基本原則

1. SnapshotはProductionからSandboxへの一方向・集計済み・承認済みデータである。
2. Store Operationsの実行時にProductionへ接続してはならない。
3. 取得は都度承認された一回の実行に限り、自動再実行を行わない。
4. Productionの正本データ、権限、RLS、UUID、schema、migrationを本運用で変更しない。
5. Snapshotに個人情報、資格情報、接続情報、生仕訳、任意UUID一覧、任意SQL結果を含めない。

## 3. 対象データ

初回の実行対象はQ01 Store Master、Q02 Confirmed Accounting、Q08 Legacy Crosswalkのみとする。Q03-Q07は正式Source承認まで`unavailable`とし、取得しない。

## 4. 実行基準

店舗20件、直営13件、FC7件、所沢legacy crosswalk、confirmed利益、未確定利益`null`、FC利益`unavailable`、AM未割当deny-by-defaultの全条件を満たす場合のみ発行できる。不一致時は成果物を発行せず、rollback後に停止する。

## 5. 有効期間と更新

通常の候補作成時間は04:00 JSTとする。初期有効期間は承認時刻から30時間とし、期限切れSnapshotは利用しない。更新・再実行・期限延長は新しい承認を必要とする。

## 6. 記録と保管

保存できるものはrun ID、承認ID、日時、Query ID/件数、成否、rollback/close結果、artifact hash、manifest hash、期限、結果区分のみとする。資格情報、接続文字列、実UUID、実会計金額、個人情報は記録しない。

## 7. 違反時

規程違反、ID不一致、秘密情報露出、未承認の再実行、または異常なデータを検知した場合は、緊急停止手順を実施し、Snapshot利用を無効化する。
