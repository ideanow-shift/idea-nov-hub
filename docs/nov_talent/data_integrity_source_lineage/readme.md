# NOV Talent Data Integrity Source Lineage

## 目的

Data Integrity Work Queueの現行6件を、総務人事部が管理する正本Spreadsheetの行へread-onlyで紐付ける。

## 正本Inventory

| 卒年 | 正本ファイル | 対象シート | 用途 |
|---|---|---|---|
| 27卒 | 求人計画27卒_2025年9月～2026年8月 | 接触学生一覧（27卒） | 重複候補6グループの正本 |
| 28卒 | 求人計画28卒_2027年9月～2027年8月 | 接触学生一覧（28卒） | 正式Source。全108実データ行を再監査済み |

28卒の旧コピーは非正本であり、現行Lineage・Work Queue・リンクには使用しない。

## 28卒終了結果

- 氏名不足4件: `false_positive`。未使用テンプレート行を実データ扱いした誤検出
- 状態不足2件: `resolved`。正式Sourceの現在値は入力済み
- 28卒の氏名・状態・学校名不足: 0件
- 28卒Work Queue: 0件
- 個人情報の記録: 0件

終了履歴は `closedIssues` に、Issue ID、終了状態、理由、終了時刻、Source種別、現行Queue対象外フラグだけを保持する。

## 現行Queue

- 正式Work Queue残件: 6
- 27卒: 氏名・学校一致の重複候補6グループ
- 28卒: 0件
- Data Consistency Issue: 採番済547行と実データ入力済535行の差分12件
- 正本Spreadsheet変更: 0
- DB・Production書込み: 0

固定Lineageは `portal/talent/data-integrity-source-lineage.json` を正本とする。実氏名は保持せず、Spreadsheet、シート、行番号、修正項目、匿名stable keyだけを保持する。

## 再照合

1. Lineage JSONの該当 `open_url` から27卒正本行を開く。
2. 行番号と相手行を確認する。
3. 総務人事部が「同一人物」「別人」「判断保留」を判断する。
4. 正本Spreadsheetへ判断を反映する。
5. Work Queueで「Spreadsheet修正済」から「次へ」へ進む。

Work Queueから正本、DB、Productionへ書き込む経路は作らない。
