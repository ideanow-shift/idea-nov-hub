# NOV Talent Staging Candidate Versioned Dataset Schema

## 判定

Candidate 636件を受けるVersioned Dataset schemaをRemote Stagingへ適用し、27卒528件・28卒108件、合計636件がACTIVEである。

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

- 正式ProjectはProduction `idea-nov-core`、Staging `idea-nov-staging`の2環境だけとし、追加Sandbox Projectを作成しない。
- NOV Talentは共通Staging内のschema、Function namespace、Dataset、Migration owner、Permission boundaryで分離する。
- 2テーブルともRLSを有効化する。
- `public`、`anon`、`authenticated` はアクセス不可。
- `service_role` はSELECT・INSERTのみ。
- seal・activate・restoreは `nov_talent_internal` の明示関数だけで行う。
- 空の共通StagingへEmployee Coreを複製せず、非公開schema内のoperator必須検証を使用する。正式Permission Modelは変更しない。
- ブラウザからの書込み経路は作らない。

## Source artifact

`supabase/migrations/20260803083708_nov_talent_candidate_versioned_dataset.sql`

このmigrationはRemote Staging `idea-nov-staging` へ適用済みで、Snapshot `NOV-TALENT-STAGING-E30AE047735FC922` の636 CandidateがACTIVEである。公開NOV TalentはStaging RuntimeとNOV HUB Session / Role Guardを使用する。Mock Runtimeは固定回帰とFeature Flag用に保持するが、公開業務データの正本ではない。
