# Data Quality Workflow

## 完了したライフサイクル

```text
総務人事部修正版Source
  → 不足・重複検出
  → Human Review Queue
  → 総務人事部の人間確認完了
  → Work Queue 17 / 17件解消
  → Data Integrity成果物 Release Ready
```

## 継続する判定

Platform Status / Release Noteは `DATA_INTEGRITY_COMPLETED / DATA_CONSISTENCY_REVIEW / MIGRATION_HOLD` とする。Data Integrityは完了済みであり、Migrationを保留する理由は「件数定義未確定」である。

## 安全境界

Work Queueは終了状態を表示するだけで、Spreadsheet、NOV Talent、DB、Productionへ保存しない。新しいQueueはread-only再監査で新規問題が確認された場合にのみ別途作成する。
