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
  → Work Queue解消率更新
  → Data Consistencyを別監査
  → 両方の整合確認後にMigration可否判定
```

## 毎回の固定報告

- 今日修正件数
- Work Queue解消率
- Data Consistency整合率
- 不足件数
- 重複件数
- 今日修正済
- 残件数
- Migration判定
- 前回からの増減

## Migration判定条件

- 正本Sourceが確定
- 氏名、学校、状態、担当、次回対応の不足が解消または正式な未設定理由あり
- 重複候補が同一人物/別人/判断保留で総務人事部判断済み
- NOV Talentとの差分0
- Migration receiptがSource件数と一致
- Data Consistency Issueが解消し、27卒の正式件数定義が確定

## 未達時の制約

Work QueueとData Consistencyの両方が確定するまでUI改善、分析、ROI、イベント分析、学校分析、CSV画面、Migration画面、新機能追加を行わない。

Work Queueは修正対象を管理するだけで、NOV Talent・DB・Productionへの保存を行わない。
