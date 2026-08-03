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

Data Consistency Issueの件数基準差12件と総合整合率は未確定。正式件数定義、NOV Talentとの差分、Migration receiptの一致を確認するまでMigrationは行わない。

## 安全境界

Work Queueは終了状態を表示するだけで、Spreadsheet、NOV Talent、DB、Productionへ保存しない。新しいQueueはread-only再監査で新規問題が確認された場合にのみ別途作成する。
