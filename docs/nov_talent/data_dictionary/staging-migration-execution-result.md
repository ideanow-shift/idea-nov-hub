# Staging Candidate Migration 実行結果

判定は `PASS_STAGING_CANDIDATE_DATASET_ACTIVE` です。正式Source 2件をread-onlyで再取得し、単一transactionでCandidate 636件をStagingへ投入しました。

## 結果

- Project: `idea-nov-staging` (`zgkoofphhivesclehrom`)
- Snapshot: `NOV-TALENT-STAGING-E30AE047735FC922`
- Dataset state: `ACTIVE`
- 27卒: 528件
- 28卒: 108件
- 合計: 636件
- 除外テンプレート: 431件
- Quarantine: 0件
- Human Review: 17/17反映
- 27卒6グループ: `different_person / keep_separate`
- 自動統合: 0件
- 自動削除: 0件
- retry: 0

## 権限と安全境界

- RLS: 2表とも有効
- `anon` / `authenticated`: 直接SELECT不可
- `service_role`: SELECT / INSERTのみ
- UPDATE / DELETE / TRUNCATE: 不可
- Event / Contact、Selection History、Production、canonical、NOV People、Employee Core、LINE履歴への書込み: 0件

## Rollback

Migration中の不一致は単一transaction全体をrollbackする契約です。今回は件数・hashが一致したためrollbackはありません。初回Datasetのため直前ACTIVE Datasetは存在しません。将来の更新では直前Datasetを保持し、専用関数で復帰できます。

## 運用開始判定

Datasetは利用準備済みですが、公開NOV Talentは匿名Mock Runtimeのままで、Staging Datasetを読むAPI/runtimeと既存Role Guardが未接続です。総務人事部のStaging画面利用は `STAGING_UI_RUNTIME_NOT_CONNECTED` として保留し、次の最小単位を `STAGING_CANDIDATE_READ_RUNTIME_AND_ROLE_GUARD_IMPLEMENTATION` とします。
