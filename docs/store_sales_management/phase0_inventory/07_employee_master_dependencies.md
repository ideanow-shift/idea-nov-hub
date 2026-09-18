# 社員マスタ依存

大規模再構築は不要である。既存masterと履歴をCore Read Adapterから利用し、不足関係だけを追加する。

| 必要項目 | 現状 | 方針 |
|---|---|---|
| employee_id | `public.employees.id`をcanonical、業務employee_idも存在 | Reuse |
| store_id | employeesのprimary storeとassignment | Extend |
| corporation_id | employeesに存在。ただしNULLあり | 品質改善 |
| role | roles/employee_roles | scopeを含めExtend |
| position | position_id/positions | Reuse |
| employment_status | employees/assignment history | 正規化 |
| joined_at | 実列は`joined_on` | Adapterで名称吸収 |
| left_at | 実列は`retired_on` | Adapterで名称吸収 |
| assignment history | employee_assignment_histories | Reuse |
| manager relationship | 明示的・有効日付き関係を未確認 | 最小追加 |
| area assignment | stores.areaは文字列、manager-to-area関係なし | 最小追加 |

## 不足項目

1. 有効日付きの`manager_employee_id`相当、またはreporting relationship
2. area master IDとarea-to-store relation
3. area managerの有効日付きassignment
4. 雇用状態のcanonical enum/辞書
5. 外部売上staff IDとemployee IDのmapping

5は社員master本体ではなく、店舗売上integrationの外部ID mappingとして保持する。

## 既知の品質リスク

inactive employeeを参照するactive assignmentが257件あり、active employeeのFirebase UID欠損も多い。売上集計ではidentityの有無と実績帰属を分離し、退職者の過去売上は保持する一方、現在のログイン・更新権限はdenyする。履歴集計は売上発生日のassignment、現在権限はrequest日時のassignmentで評価する。
