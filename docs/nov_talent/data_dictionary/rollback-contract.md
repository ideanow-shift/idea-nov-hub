# Migration Rollback契約

## Rollback条件

次のいずれかを検出した場合はMigrationをCOMMITせず、単一transaction全体をrollbackする。

1. Source行数、Migration対象数、除外テンプレート数、Quarantine数の不一致
2. Snapshotまたはsealed artifactのhash不一致
3. Candidate重複数の増加
4. Candidateまたは履歴の必須項目欠落
5. Source LineageとSnapshotのSpreadsheet、Sheet、行参照の不一致
6. Permission／RLSの既存契約との不一致
7. Migration処理の途中失敗、timeout、結果receipt不整合
8. 未承認のHuman Review結果または曖昧Candidateのcanonical経路到達

## 原則

- Migrationは単一接続・単一DB transactionとする
- commit前に期待件数とreceiptを照合する
- rollback後に部分データを残さない
- 自動retryは行わない
- rollbackを理由にSource Spreadsheetを書き換えない
- canonical、LINE履歴、Employee Core等の別境界へ到達しない
- Stagingの日常Importは新しいdataset versionを作成し、件数・Hash・Permission検証後にだけ有効化する
- 有効化後の異常は直前のStaging dataset versionを再有効化する
- StagingのrollbackはProductionやSpreadsheetを変更しない

現Sprintではrollback契約の定義だけを行い、DB接続・transaction・書込み・rollback実行は行わない。
