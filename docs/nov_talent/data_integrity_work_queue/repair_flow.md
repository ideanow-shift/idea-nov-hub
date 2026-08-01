# Repair Flow

## 固定フロー

```text
Work Queueを開く
  → 現在値と修正候補を確認
  → 修正値または重複対応を選び「修正内容を確認」
  → 総務人事部管理の正本Spreadsheetを修正
  → Work Queueで「Spreadsheet修正済」
  → 「次へ」
  → 次の1件を表示
```

## 操作ステップ数

- 全対象: 3ステップ（修正確認、Spreadsheet修正済、次へ）
- 重複候補の保留も正本Spreadsheetに記録してから完了扱いにする。

## 保存禁止

Work Queueは進捗をメモリ上で確認するだけである。NOV Talent、DB、Production、ローカルファイルのいずれにも修正値を保存しない。正本は総務人事部管理のSpreadsheetである。
