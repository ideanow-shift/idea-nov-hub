# Core DB DDLレビュー依頼：職種マスタ追加候補

社員属性整理のため、職種マスタの追加を検討します。

## 追加候補

- `public.job_types`
- `employees.job_type_id references public.job_types(id)`

## 目的

- シフト自動生成で美容師・レセプション・カラーリストを分ける
- 雇用形態と職種を分離する
- 人件費分析、採用分析、教育対象分類に使う
- `レセプションパート` のような混合値を廃止する

## 初期職種候補

- 美容師
- レセプション
- カラーリスト
- 本部スタッフ
- その他

## 確認事項

1. `job_types` をCore共通マスタとして追加してよいか
2. `employees.job_type_id` をnullableで追加してよいか
3. 既存の `レセプションパート` を `employment_type = パート・アルバイト` + `job_type = レセプション` に移行してよいか
4. `未設定` はDB値ではなくNULL表示でよいか
5. DDL投入前に必要な制約・履歴・backfill方針はあるか

## 各アプリ共通方針

各アプリで社員属性を独自マスタ化しないでください。

| 属性 | 正本 |
| --- | --- |
| 社員 | `public.employees.id` |
| 店舗 | `public.stores.id` |
| 部署 | `public.departments.id` |
| 役職 | `public.positions.id` |
| 職種 | `public.job_types.id` 新設後 |
| 雇用形態 | `employees.employment_type` |
| 就労ステータス | `employees.employment_status` |
| 休職種別 | `employees.leave_type` |
| 権限 | `public.roles` / `public.employee_roles` |

表示名はCore DBから参照し、アプリ側では正本を重複保存しません。
