# NOV Talent Staging Candidate Versioned Dataset Schema

## 判定

Candidate 636件を受けるVersioned Dataset schemaのmigration sourceを実装した。Remote Stagingへの適用とCandidate投入は未実施である。

## 対象

- Candidate: 636件
- 27卒: 528件
- 28卒: 108件

Event / Contact、Selection History、Production、canonical、NOV People、Employee Core、LINE履歴は対象外とする。

## Dataset lifecycle

1. `BUILDING`: SnapshotとCandidate行を投入する。
2. `READY`: 期待総数・卒年別件数が一致したdatasetだけをsealする。
3. `ACTIVE`: Stagingが参照するdataset。常時最大1件とする。
4. `RETIRED`: 直前版として保持し、必要時に再有効化できる。

切替は非公開schemaの `nov_talent_internal.activate_candidate_dataset_v1` 内で直前ACTIVEの退役と新datasetの有効化を同一transactionで行う。途中で失敗した場合、PostgreSQLのtransactionにより変更全体をrollbackする。

## Tables

- `public.nov_talent_candidate_datasets_v1`
- `public.nov_talent_candidate_dataset_records_v1`

Candidate行は `BUILDING` datasetへのINSERTだけを許可する。READY以降のCandidate行は不変とし、UPDATE・DELETE権限を付与しない。

## Access boundary

- 2テーブルともRLSを有効化する。
- `public`、`anon`、`authenticated` はアクセス不可。
- `service_role` はSELECT・INSERTのみ。
- seal・activate・restoreは `nov_talent_internal` の明示関数だけで行う。
- 空の共通StagingへEmployee Coreを複製せず、非公開schema内のoperator必須検証を使用する。正式Permission Modelは変更しない。
- ブラウザからの書込み経路は作らない。

## Source artifact

`supabase/migrations/20260803083708_nov_talent_candidate_versioned_dataset.sql`

このmigrationはRemote Staging `idea-nov-staging` へ適用済みで、Snapshot `NOV-TALENT-STAGING-E30AE047735FC922` の636 CandidateがACTIVEである。公開NOV Talentは引き続き匿名Mock Runtimeであり、総務人事部の利用開始にはStaging専用のread runtimeと既存Role Guardの接続が必要である。
