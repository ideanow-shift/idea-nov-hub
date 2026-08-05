# NOV Talent Staging先行運用契約

## 運用方針

Stagingを開発環境ではなく、総務人事部が実業務を開始する「運用検証環境」として扱う。ProductionはStaging運用の受入確認と別の昇格承認が終わるまで使用しない。

運用方針はData Dictionary v1.3.0で定義する。既存のsealed dry-runはData Contract v1.2.0の履歴証拠として保持し、Candidate mappingの意味は変更しない。ただし、実投入直前に正式Sourceを再照合して新しいSnapshotを生成する。

## 初回Staging Migration範囲

- 正式Source: 27卒と28卒の登録済み正式Source 2件のみ
- 27卒: 528 Candidate
- 28卒: 108 Candidate
- 合計: 636 Candidate
- Human Review 6グループ: `different_person / keep_separate`
- 自動集約: 0件
- Quarantine: 0件
- 初回の書込み対象Entity: Candidateのみ

Event / Contact候補1,550件とSelection History候補0件はread-only dry-runの結果として保持するが、初回Staging Migrationの書込み範囲には含めない。履歴Entityは別の件数・映射・承認ゲートで開放する。

## 総務人事部がStagingで行うこと

- Candidate管理画面の利用
- Candidate検索
- Dashboardによる状況確認

NOV Talent画面からCandidate正本を直接更新しない。正本の更新はSpreadsheetで行い、承認済みImportでStagingへ反映する。

## 固定運用フロー

1. 総務人事部が正式Spreadsheetを更新
2. 正式Sourceのread-only preflightで件数・Hash・Lineageを検証
3. OwnerがImport対象Snapshotを承認
4. Staging限定Importを別承認で実行
5. 件数・Hash・権限の一致後に新しいStaging dataset versionを有効化
6. 総務人事部がCandidate管理・検索・Dashboardを確認

Sourceが更新された場合は、以前のSnapshotを再利用せず、新しいpreflightとSnapshot承認を必須とする。

## ImportとRollback

- Importは差分の弱い照合キーupsertではなく、versioned snapshot replacementとする
- `snapshot_id + artifact_hash`を冪等性キーとする
- retryは0回
- 初回Migrationは単一接続・単一DB transactionとする
- 件数またはHash不一致はCOMMITせず全体rollbackする
- 日常Importは新dataset versionを作成し、検証後に有効化する
- 有効化後の異常時は直前のStaging dataset versionへ戻す

## 承認ゲート

Staging利用開始までに、次の3つを別々記録する。

1. OwnerによるSnapshot受領
2. Staging限定Migration実行承認
3. Migration receipt確認後のStaging運用開始承認

Production昇格承認はこれらに含まれない。

## 禁止境界

- ProductionへのMigrationまたは書込み
- StagingからProductionへの自動昇格
- canonical昇格、LINE履歴書込み、Employee Core書込み
- NOV TalentからSpreadsheetへの逆書込み
- 弱い照合キーによる自動統合
- Candidateの自動削除
- 個人値のGitHub、Markdown、Console、公開artifactへの複製

## 現在地

Ownerによる最新Snapshot受領、Staging Migration、Migration照合後の運用開始承認は受領済みである。正式Sourceのread-only再受領も636件でPASSした。既存受入schema不整合に対して、Candidate専用Versioned Dataset schemaのmigration sourceを実装した。Remote Staging適用、Candidate投入、運用開始は未実施であり、Productionは引き続き禁止する。
