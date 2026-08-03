# Staging Migration実行結果

判定は `SAFE_STOP_FIXED_STAGE` です。正式Source 2件のread-only再受領は完了しましたが、既存受入schemaが承認済みCandidate 636件の契約を満たさないため、書込み前に停止しました。

## 再受領結果

- Snapshot: `NOV-TALENT-STAGING-20260803-91891F18AAC989B9`
- 27卒: 528件
- 28卒: 108件
- 合計: 636件
- 除外テンプレート: 431件
- Human Review: 17件適用、6グループを `different_person / keep_separate`

## 安全停止理由

- 現行受入tableのSource区分制約が28卒を受け付けない
- 現行Import batchはdry-run専用制約である
- Datasetの有効化、旧版保持、再有効化を表すschema契約が存在しない

schema変更は禁止されているため、Migrationは実行していません。Spreadsheet、Staging、Production、canonical、LINE履歴、promotion、Employee Coreへの書込みはすべて0件です。transactionを開始していないためrollbackは不要です。
