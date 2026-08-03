# NOV Talent Migration仕様

## 1. 適用する辞書

本仕様は `NOV_TALENT_DATA_DICTIONARY` Version `1.2.0` を参照する。辞書と本仕様が矛盾する場合はMigrationを安全停止し、推測で補完しない。

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

次の4契約はVersion 1.2.0で仕様確定した。

- Candidate同一性契約
- Human Review安定ID証拠構造
- Migration先区分
- Snapshot・受領・Rollback契約

ただし、Human Review完了6グループの結果値が記録されておらず、実Snapshotとdry-runも未生成である。運用前提が満たされるまでは `MIGRATION_HOLD` を維持する。

## 5. 安全境界

- Spreadsheetを変更しない
- DB・Productionへ書き込まない
- 自動統合・自動削除を行わない
- 個人値を仕様書、ログ、GitHub成果物へ複製しない
- 件数不一致時はMigrationを開始しない
