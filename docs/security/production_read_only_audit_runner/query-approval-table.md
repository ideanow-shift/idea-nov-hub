# Query Approval Table

| Query ID | 目的 | 対象object | 最大行数 | timeout | 出力項目 | masking | failure時 |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| Q01_SCHEMA_CATALOG | schema存在確認 | information_schema.schemata | 2 | 5秒 | schema名 | 不要 | 停止・rollback |
| Q02_STORE_TABLE_CANDIDATES | 店舗relation候補 | pg_class/pg_namespace | 1,000 | 5秒 | schema・relation・種別 | 不要 | 停止・rollback |
| Q03_PUBLIC_STORES_COUNT | public店舗件数 | public.stores | 1 | 5秒 | 件数 | 不要 | 停止・rollback |
| Q04_CORE_STORES_COUNT | core店舗件数 | core.stores | 1 | 5秒 | 件数 | 不要 | 停止・rollback |
| Q05_CURRENT_STORE_IDENTITY | 店舗列の形 | information_schema.columns | 1,000 | 5秒 | schema/table/column/type/nullability | 不要 | 停止・rollback |
| Q06_TOKOROZAWA_CANDIDATES | 所沢候補件数 | public/core.stores | 2 | 5秒 | schema・候補件数 | UUID非出力 | 停止・rollback |
| Q07_STORE_FK_REFERENCE_COUNTS | FK参照件数 | pg_constraint | 1,000 | 5秒 | 参照元relation・件数 | 不要 | 停止・rollback |
| Q08_STORE_VIEW_REFERENCES | View参照 | pg_rewrite/pg_depend | 1,000 | 5秒 | view・件数 | 不要 | 停止・rollback |
| Q09_STORE_FUNCTION_REFERENCES | Function依存 | pg_proc/pg_depend | 1,000 | 5秒 | schema・件数 | body非出力 | 停止・rollback |
| Q10_STORE_OPERATION_HISTORY | 履歴table形 | information_schema.columns | 1,000 | 5秒 | schema/table/column/type | 不要 | 停止・rollback |
| Q11_RLS_AND_POLICIES | RLS/policy存在 | pg_class/pg_policy | 2 | 5秒 | relation/RLS/policy件数 | expression非出力 | 停止・rollback |
| Q12_READONLY_GUARD_VERIFICATION | read-only guard | session setting | 1 | 5秒 | read-only状態 | 不要 | 即時rollback |

Q01/Q02/Q11/Q12は最初のcatalog-only smoke候補です。残りはsmoke受入後に目的別承認で実行します。
