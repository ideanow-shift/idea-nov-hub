# Store and Scope Inventory

| UI項目 | technical_key | 必要原本 | 現在の取得元 | 判定 | 加工方法 | 更新頻度 | 信頼度 | 未確定事項 |
|---|---|---|---|---|---|---|---|---|
| store_id | store_id | Core Store | public.stores.id | Available | Core Read Adapterで取得 | 随時 | High | なし |
| corporation_id | corporation_id | Core Corporation | public.stores.corporation_id/public.corporations.id | Available | Core Read Adapterで取得 | 随時 | High | NULL/不整合品質 |
| 店舗名 | store_name | Core Store | public.stores.store_name | Available | store_idに紐づけ表示 | 随時 | High | 改名履歴 |
| 直営・FC | store_ownership_type | Core Store | stores.store_type列候補。値・正式判定未確認 | Unknown | ownership ruleで分類 | 随時 | Low | 所有/運営/集計法人 |
| 営業中・閉店 | store_active_status | Core Store | public.stores.is_active | Available | is_activeで現状態。過去はeffective historyが必要 | 随時 | Medium-High | 閉店日・休業区分 |
| エリア | area_id | Area master/assignment | stores.area文字列候補のみ | Unknown | 構造化area IDへmapping | 随時 | Low | area master・有効期間 |
| 担当営業 | sales_owner_employee_id | 担当関係 | 明示的relationshipなし | Unavailable | effective-dated owner assignmentが必要 | 随時 | High | roleと担当scope |
| FCオーナー | fc_owner_principal_id | FC ownership relation | roleは候補だがstore relationなし | Unavailable | principal-store-corporation relationが必要 | 随時 | High | employee/外部principal |
| 月中の所属変更 | assignment_change_in_month | assignment history | employee_assignment_histories | Derivable | effective datesを対象月で差分抽出 | 月次 | Medium-Low | 履歴欠損・inactive assignment |

## Rules

- Phase 0のread-only inventoryでは稼働店舗が21件だった一方、Version1要件は「全20店舗」である。除外対象を名称推測せず、営業部がCore IDの対象集合を承認する必要がある。
- 正式処理は`public.stores.id`を使い、店舗名matchingはimport前のmapping候補検出に限定する。
- 月中異動/応援売上はsource transactionの発生store_idへ帰属させる。現在はtransaction factがないため実適用不可。
- 直営/FC、area、担当営業、FC ownerはscope表示前にeffective-dated relationを整備する。
