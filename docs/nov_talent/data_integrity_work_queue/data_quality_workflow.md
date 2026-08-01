# Data Quality Workflow

## ライフサイクル

```text
総務人事部修正版Source
  → 不足・重複検出
  → 今日のWork Queue
  → 修正内容を確認
  → 正本Spreadsheetを1件修正
  → Spreadsheet修正済を確認
  → 次の1件
  → 再検証
  → 整合率更新
  → 100%でMigration可否判定
```

## 毎回の固定報告

- 今日修正件数
- 整合率
- 不足件数
- 重複件数
- 今日修正済
- 残件数
- Migration進捗
- 前回からの増減

## 100%条件

- 正本Sourceが確定
- 氏名、学校、状態、担当、次回対応の不足が解消または正式な未設定理由あり
- 重複候補が採用/保留でOwner判断済み
- NOV Talentとの差分0
- Migration receiptがSource件数と一致

## 未達時の制約

整合率100%までUI改善、分析、ROI、イベント分析、学校分析、CSV画面、Migration画面、新機能追加を行わない。

Work Queueは修正対象を管理するだけで、NOV Talent・DB・Productionへの保存を行わない。
