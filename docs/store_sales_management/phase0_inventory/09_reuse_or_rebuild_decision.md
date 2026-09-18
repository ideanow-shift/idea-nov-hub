# Reuse / Extend / Replace判定

## Reuse

- `public.employees`、`public.stores`、`public.corporations`（Adapter越し）
- employee assignment historyの考え方
- NOV HUBの既存入口とsession（今回変更なし）
- management appのresponsive shell
- local CSVのfail-closed validatorとsanitized receipt
- finance read model（店舗売上との月次照合用）

## Extend

- 店舗別状況画面
- `managementStoresSummary`のactor/scopeとresponse contract
- employee store assignmentの品質、有効日、area scope
- `management_performance_snapshots`を派生snapshotとして利用
- management improvement action/commentのworkflow
- CSV validatorをstaged importのpreflightへ接続
- audit、idempotency、source lineage

## Replace

- 店舗summaryの0固定placeholderをcanonical read modelに置換
- 店舗名ベースmatchingをimmutable external ID mappingに置換
- local previewを本番入力とみなす運用
- 意味が曖昧な単一「sales per staff」表示
- request由来actor/storeを信用する設計が残る場合はserver-derived scopeへ置換

## Archive候補

- `app.js`など現行経路から外れた重複frontend
- 実接続されていないdemo POS/prototype
- 重複・文字化け・現行判断と矛盾する旧資料

Archiveは利用参照を確認した後の別Phaseで行い、今回は削除しない。

## Unknown

- 正式なPOS/Salon系source
- current live Spreadsheet/GAS flow
- management系tableのlive schema/policy/row count
- candidate backendのproduction wiring
- 実際のGitHub Pages deployment設定

## 全体方針

全面rebuildではなく、**既存UI・Core・validatorを再利用し、売上fact pipelineと業務契約を新設する部分再構成**を採用する。
