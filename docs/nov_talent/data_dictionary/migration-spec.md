# NOV Talent Migration仕様

## 1. 適用する辞書

本仕様は `NOV_TALENT_DATA_DICTIONARY` Version `1.1.0` を参照する。辞書と本仕様が矛盾する場合はMigrationを安全停止し、推測で補完しない。

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

## 4. HOLD解除に残る条件

1. `CROSS_SHEET_CANDIDATE_IDENTITY_RULE_APPROVAL`
   - 接触、エントリー、内定を1 Candidateへ紐付ける正式キーを承認する。
   - 照合不能または曖昧な行の隔離規則を承認する。
2. `HUMAN_REVIEW_DECISION_MAPPING_EVIDENCE`
   - 完了済み重複レビュー結果を安定ID対応としてMigrationへ渡せる証拠を確定する。
3. `MIGRATION_SOURCE_SCOPE_APPROVAL`
   - Source行をCandidate、Event、履歴のどれへ移行するか確定する。
4. `SOURCE_SNAPSHOT_AND_EXPECTED_RECEIPT`
   - 基準日時、Source別期待件数、隔離件数、不一致時rollback条件を固定し、Owner承認する。

上記4条件の完了までは `MIGRATION_HOLD` を維持する。完了後もMigration実行には別の明示承認が必要である。

## 5. 安全境界

- Spreadsheetを変更しない
- DB・Productionへ書き込まない
- 自動統合・自動削除を行わない
- 個人値を仕様書、ログ、GitHub成果物へ複製しない
- 件数不一致時はMigrationを開始しない
