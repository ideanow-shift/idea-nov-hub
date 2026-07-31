# Master Verification Evidence

## Google Sheet

- Spreadsheet: [店舗設備等情報（AI対応ソース）](https://docs.google.com/spreadsheets/d/1Ozyzi3WqYh7HkYYKBObZr8Mvsm941BQh4XL4w_qp-90/edit)
- `店舗マスター` sheetId: 0
- `店舗運営会社ログ` sheetId: 449599264
- Access: read-only success
- Read date: 2026-07-29

利用した列は店舗名、オープン日、所属、状況、閉店日、NOV店舗ID、表示名、利用可否、種別、store_no、および運営会社ログの期間列。認証関連列、個人情報、賃料・面積・設備等のEntity Mapping不要列は成果物へ転記していない。

## Entity Approval Board

本指示で人間承認済みとして提示された以下を根拠とした。

- 直営13店舗、FC7店舗
- 運営法人: IDEA NOV、ALBERO、UNO、BIOEL、FILM、LUA
- 立川店は同一store entityの運営主体履歴
- 店舗entityは運営区分変更で作り直さない
- official_name / display_name / brand_name / search_aliasを分離
- 表記揺れを別entityへ自動分割しない

## Repository Core Evidence

- [Core schema / seed review](../../../../core-employee-ledger-v1-review.md)
  - `public.stores`: UUID `id`、`store_no`、`store_id`、`store_name`、`corporation_id`、`is_active`
  - `public.corporations`: UUID `id`、法人番号・code・name
  - 法人seed候補: IDEA_NOV、ALBERO、UNO、BIOEL、FILM、LUA
- [Core assignment history SQL](../../../../../supabase/core-assignment-histories.sql)
- [Core read-only checks](../../../../../supabase/core-master-readonly-checks-20260703.sql)
- `nov-hub-api`のstore SELECT候補

## Evidence Classification

|証跡|分類|理由|
|---|---|---|
|Google店舗マスター|live reference|指定Sheetをread-only取得|
|Google運営会社ログ|live reference|期間履歴をread-only取得|
|Entity Approval Board|human approved|本指示で承認済みとして提示|
|Core DDL文書|design/review candidate|実DB値ではない|
|法人seed SQL文書|seed candidate|本番反映を証明しない|
|Staging synthetic fixture|mock|正式マスター比較に使用しない|
|Store Sales review fixture|mock|正式マスター比較に使用しない|

## 不足証跡

`public.stores`と`public.corporations`の正式なread-only exportがない。最低限必要な列:

- stores: `id, store_no, store_id, store_name, corporation_id, is_active`
- corporations: `id, corporation_code, corporation_name, is_active`
- 運営履歴テーブルがある場合: store UUID、corporation UUID、effective_from、effective_to、current_flag

取得時はsecretや接続文字列を成果物へ含めず、SELECT結果のみを安全なレビュー用exportとして提供する。
