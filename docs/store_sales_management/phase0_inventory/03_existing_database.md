# 既存データベース

## 確認済みの基盤テーブル

| 領域 | テーブル | 用途 | 判定 |
|---|---|---|---|
| Core | `public.employees` | canonical employee候補 | Reuse |
| Core | `public.stores` | 店舗master候補 | Reuse |
| Core | `public.corporations` | 法人master候補 | Reuse |
| Core | `employee_store_assignments` | 複数店舗、有効期間 | Extend |
| Core | `employee_assignment_histories` | 配属・役職・雇用状態履歴 | Reuse |
| AuthZ | `roles`、`employee_roles` | roleとscope | Extend |
| Store | `store_business_profiles` | 店舗補足情報 | Reuse |
| Finance | `finance_monthly_corporate_pl`等 | 法人/部門財務 | Reuse（照合） |
| Management | `management_performance_snapshots` | KPI集計snapshot | Extend（派生） |
| Management | checks/actions/logs系 | 改善業務 | Extend |

## 実データ品質の既知事項

Phase 3のlive read-only確認資料に基づく:

- employees 775件、active 190件、inactive 585件
- active store assignments 456件
- active assignmentのうちinactive employee参照 257件
- storesはactive 21件、inactive 1件
- corporationsはactive 6件
- employeeの`corporation_id` NULL 300件
- employeeの`store_id` NULL 329件
- active employeeのFirebase UID欠損 184件

これらは売上閲覧scopeとスタッフ別集計に直接影響する。as-of dateとactive stateを必ず適用し、不完全なidentity/scopeはdenyする。

## 売上・予算・KPIの現状

- `finance_monthly_*`に売上額の列があっても、会計集計であり店舗取引原本ではない。
- `management_performance_snapshots`は集計済みsnapshotであり、取消・返品・訂正を再構成できる原本ではない。
- 店舗予算のlocal CSV contractはあるが、canonical budget tableと承認workflowは確認できない。
- 日次取引、決済、取消、返品、締め、reconciliationの物理正本は確認できない。

## RLS / GRANT / service role

確認したSQLでは`store_business_profiles`、`employee_store_assignments`等にRLSが有効で、anon/authenticatedをrevokeし、service roleに限定した権限がある。これはブラウザ直読を避ける点では妥当だが、server-side queryがactor scopeを欠くと過大権限になる。Phase 1ではDBを変更せず、API契約とnegative testを先に固定する。

## 未確認

- management系全テーブルのlive schema、row count、RLS、GRANT
- 店舗売上canonical factの存在
- 予算承認済みデータの物理正本
- 実運用中のservice role API一覧
