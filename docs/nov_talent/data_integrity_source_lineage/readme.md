# NOV Talent Data Integrity Source Lineage

## 目的

Data Integrity Work Queueの再監査後残件12件を、総務人事部が管理する正本Spreadsheetの行へread-onlyで紐付ける。

## 正本Inventory

| 卒年 | 正本ファイル | 対象シート | 用途 |
|---|---|---|---|
| 27卒 | 求人計画27卒_2025年9月～2026年8月 | 接触学生一覧（27卒） | 残件12件中6件の正本 |
| 28卒 | 求人計画28卒_2027年9月～2027年8月 のコピー | 接触学生一覧（28卒） | 残件12件中6件の正本。Owner提供URLを採用 |
| 28卒 | 求人計画28卒_2027年9月～2027年8月 | 接触学生一覧（28卒） | 構造一致を確認した参照候補。Lineageには不使用 |

## 照合結果

- 再監査済: 17 / 17
- 解消確認済: 5
- 正式Work Queue残件: 12
- 未特定: 0
- 27卒: 重複候補6グループ
- 28卒: 氏名不足4件、状態不足2件
- Data Consistency Issue: 採番済547行と実データ入力済535行の差分12件
- 正本Spreadsheet変更: 0
- DB・Production書込み: 0
- 個人情報のGitHub保存: 0

固定Lineageは `portal/talent/data-integrity-source-lineage.json` を正本とする。実氏名は保持せず、Spreadsheet、シート、行番号、修正項目、匿名stable keyだけを保持する。

## 再照合

1. Lineage JSONの該当 `open_url` から正本行を開く。
2. `stable_key_hint` と行番号を使って対象位置を固定する。
3. 総務人事部が正本を修正する。
4. 同じ行をread-onlyで再確認する。
5. Work Queueで「Spreadsheet修正済」から「次へ」へ進む。

Work Queueから正本、DB、Productionへ書き込む経路は作らない。
