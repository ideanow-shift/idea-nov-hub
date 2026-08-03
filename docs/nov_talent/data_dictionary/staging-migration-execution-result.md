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

Staging専用read-only API、HUB Auth Guard、既存正式RoleによるRole Guard、ACTIVE Dataset読取りを接続しました。Mock Runtimeは削除せずFeature Flagで保持し、公開候補設定はStaging Runtime・書込み無効です。

Staging APIは適用済みですが、GitHub PagesのProduction公開は本Sprintの禁止事項に従って実行していません。総務人事部への公開URL引渡しは `STAGING_RUNTIME_READY_FOR_PUBLICATION` とし、PR統合後の明示承認付きPages公開と実ブラウザ確認を次Gateにします。
