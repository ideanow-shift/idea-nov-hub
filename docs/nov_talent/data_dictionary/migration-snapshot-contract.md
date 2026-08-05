# Migration Snapshot契約

Migration実行前に、正式Sourceをread-onlyで固定集計し、次の固定項目を持つSnapshot receiptを生成する。

| 項目 | 必須 | 定義 |
|---|---:|---|
| `snapshot_id` | 必須 | 再利用しない一意なSnapshot ID |
| `generated_at` | 必須 | タイムゾーン付き生成日時 |
| `source_spreadsheet_id` | 必須 | Data Dictionary登録済み正式Source ID |
| `sheet_id` | 必須 | 登録済み正式Sheet ID |
| `source_type` | 必須 | 辞書に定義されたSource Type |
| `source_row_count` | 必須 | read-onlyで読んだSource行数 |
| `migration_target_count` | 必須 | Version 1.3.0が継承する正式対象行定義を満たす行数 |
| `excluded_template_count` | 必須 | No.だけの空テンプレート行数 |
| `quarantine_count` | 必須 | 固定理由コード別Quarantine総数 |
| `exact_match_count` | 必須 | Candidate同一性契約のexact match数 |
| `ambiguous_count` | 必須 | probable、ambiguous、conflictのうち人間確認が必要な総数 |
| `artifact_hash` | 必須 | sealed private manifestのSHA-256。raw値を出力しない |
| `schema_version` | 必須 | Snapshot schema version |
| `data_dictionary_version` | 必須 | 新規Snapshotは完全一致で `1.3.0`。既存Version 1.2.0のsealed dry-run Snapshotは参照証拠としてのみ保持する |
| `owner_approval` | 必須 | OwnerのSnapshot受領。初期値false |
| `migration_approval` | 必須 | Migration実行の別承認。初期値false |

1つのSnapshotは1回のdry-runまたはMigration承認だけに使用し、Source更新後は再生成する。旧コピーを含むSnapshotは無効とする。

現Sprintでは契約だけを固定し、実Snapshotの生成、hash計算、承認、Migrationは実行しない。
