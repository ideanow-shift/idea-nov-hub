# Sprint 1 匿名seed

## 件数

- 27卒: 27件
- 28卒: 120件
- 合計: 147件

件数は既存構造の確認に必要なカテゴリだけを参考にした。実CSVの行、氏名、学校、連絡先、source key、IDは読まず、複製していない。

## 生成内容

候補者番号、氏名、学校、担当者、状態、日付、履歴は決定的な架空値として生成する。電話とemailは空欄に固定する。分類は確認済み・要確認・隔離を混在させ、一覧、フィルタ、空状態、期限順、タスクを確認できるようにする。

`containsRealPersonalValues: false` と `sourceFilesMutated: false` をseed inventoryへ固定している。
