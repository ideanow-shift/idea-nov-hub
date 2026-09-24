# KPI terms

辞書version: 1.0-draft / 用語数: 25

## 予算 (`budget`)

| field | value |
|---|---|
| term_id | kpi.budget |
| technical_key | budget |
| japanese_name | 予算 |
| display_name | 予算 |
| category | kpi |
| definition | 対象期間・scope・versionを持つ計画値の総称。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 正式versionと正本 |
| effective_from | — |
| version | 1.0-draft |

## 当初予算 (`initial_budget`)

| field | value |
|---|---|
| term_id | kpi.initial_budget |
| technical_key | initial_budget |
| japanese_name | 当初予算 |
| display_name | 当初予算 |
| category | kpi |
| definition | 対象年度・月の開始前に最初に承認された予算version。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 最初の承認時点 |
| effective_from | — |
| version | 1.0-draft |

## 修正予算 (`revised_budget`)

| field | value |
|---|---|
| term_id | kpi.revised_budget |
| technical_key | revised_budget |
| japanese_name | 修正予算 |
| display_name | 修正予算 |
| category | kpi |
| definition | 当初予算の後に承認された新version。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 改定権限・適用月・遡及 |
| effective_from | — |
| version | 1.0-draft |

## 承認予算 (`approved_budget`)

| field | value |
|---|---|
| term_id | kpi.approved_budget |
| technical_key | approved_budget |
| japanese_name | 承認予算 |
| display_name | 承認予算 |
| category | kpi |
| definition | 指定as-ofで有効な承認済み予算version。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 承認workflowと複数version選択 |
| effective_from | — |
| version | 1.0-draft |

## 予算達成率 (`budget_achievement_rate`)

| field | value |
|---|---|
| term_id | kpi.budget_achievement_rate |
| technical_key | budget_achievement_rate |
| japanese_name | 予算達成率 |
| display_name | 予算達成率 |
| category | kpi |
| definition | 実績値を承認予算で除した比率。 |
| formula | actual_sales / approved_budget * 100 |
| numerator | actual_sales |
| denominator | approved_budget |
| grain | monthly / store / employee |
| unit | percent |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | 予算比 / 目標達成率 |
| exclusions | — |
| edge_cases | — |
| decision_required | actual_salesの正式定義 |
| effective_from | — |
| version | 1.0-draft |

## 前年売上 (`prior_year_sales`)

| field | value |
|---|---|
| term_id | kpi.prior_year_sales |
| technical_key | prior_year_sales |
| japanese_name | 前年売上 |
| display_name | 前年売上 |
| category | kpi |
| definition | 比較可能な前年同期間の承認済み売上。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 閉店・移転・統合店舗の比較 |
| effective_from | — |
| version | 1.0-draft |

## 前年比 (`year_over_year_rate`)

| field | value |
|---|---|
| term_id | kpi.year_over_year_rate |
| technical_key | year_over_year_rate |
| japanese_name | 前年比 |
| display_name | 前年比 |
| category | kpi |
| definition | 当期値を比較可能な前年同期間値で除した比率。 |
| formula | current_period_value / prior_year_comparable_value * 100 |
| numerator | current_period_value |
| denominator | prior_year_comparable_value |
| grain | monthly / store / employee |
| unit | percent |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | 前年同月比 |
| exclusions | — |
| edge_cases | — |
| decision_required | 比較可能店と0分母 |
| effective_from | — |
| version | 1.0-draft |

## 前月比 (`month_over_month_rate`)

| field | value |
|---|---|
| term_id | kpi.month_over_month_rate |
| technical_key | month_over_month_rate |
| japanese_name | 前月比 |
| display_name | 前月比 |
| category | kpi |
| definition | 当月値を前月の比較可能値で除した比率。 |
| formula | current_month_value / previous_month_value * 100 |
| numerator | current_month_value |
| denominator | previous_month_value |
| grain | monthly / store / employee |
| unit | percent |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 速報/確定混在と0分母 |
| effective_from | — |
| version | 1.0-draft |

## 客単価 (`average_spend`)

| field | value |
|---|---|
| term_id | kpi.average_spend |
| technical_key | average_spend |
| japanese_name | 客単価 |
| display_name | 客単価 |
| category | kpi |
| definition | 承認済み対象売上を承認済み総客数で除した値。 |
| formula | approved_sales / total_customer_count |
| numerator | approved_sales |
| denominator | total_customer_count |
| grain | monthly / store / employee |
| unit | JPY/customer |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | 総単価 |
| exclusions | — |
| edge_cases | — |
| decision_required | 売上と客数の正式組合せ |
| effective_from | — |
| version | 1.0-draft |

## 技術単価 (`technical_average_spend`)

| field | value |
|---|---|
| term_id | kpi.technical_average_spend |
| technical_key | technical_average_spend |
| japanese_name | 技術単価 |
| display_name | 技術単価 |
| category | kpi |
| definition | 技術売上を技術客数で除した値。 |
| formula | technical_sales / technical_customer_count |
| numerator | technical_sales |
| denominator | technical_customer_count |
| grain | monthly / store / employee |
| unit | JPY/customer |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 税込/純売上と技術客の重複排除 |
| effective_from | — |
| version | 1.0-draft |

## 店販単価 (`retail_average_spend`)

| field | value |
|---|---|
| term_id | kpi.retail_average_spend |
| technical_key | retail_average_spend |
| japanese_name | 店販単価 |
| display_name | 店販単価 |
| category | kpi |
| definition | 店販売上を承認済み分母で除した値。 |
| formula | retail_sales / denominator_to_be_approved |
| numerator | retail_sales |
| denominator | Needs Business Decision |
| grain | monthly / store / employee |
| unit | JPY/customer |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 総客数か店販購入客数か |
| effective_from | — |
| version | 1.0-draft |

## 店販購買率 (`retail_purchase_rate`)

| field | value |
|---|---|
| term_id | kpi.retail_purchase_rate |
| technical_key | retail_purchase_rate |
| japanese_name | 店販購買率 |
| display_name | 店販購買率 |
| category | kpi |
| definition | 店販購入客数を承認済み対象客数で除した比率。 |
| formula | retail_purchasing_customer_count / denominator_to_be_approved * 100 |
| numerator | retail_purchasing_customer_count |
| denominator | Needs Business Decision |
| grain | monthly / store / employee |
| unit | percent |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | 購買率 |
| exclusions | — |
| edge_cases | — |
| decision_required | 総客数/技術客数/来店数のどれを分母にするか |
| effective_from | — |
| version | 1.0-draft |

## 新規客数 (`new_customer_count`)

| field | value |
|---|---|
| term_id | kpi.new_customer_count |
| technical_key | new_customer_count |
| japanese_name | 新規客数 |
| display_name | 新規客数 |
| category | kpi |
| definition | 承認済み新規客定義に該当する顧客の重複排除数。 |
| formula | COUNT(DISTINCT customer_id meeting new_customer rule) |
| numerator | new_customer |
| denominator | — |
| grain | monthly / store / employee |
| unit | customer |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 全社/店舗初回、lookback、顧客ID欠損 |
| effective_from | — |
| version | 1.0-draft |

## 新規比率 (`new_customer_rate`)

| field | value |
|---|---|
| term_id | kpi.new_customer_rate |
| technical_key | new_customer_rate |
| japanese_name | 新規比率 |
| display_name | 新規比率 |
| category | kpi |
| definition | 新規客数を承認済み対象客数で除した比率。 |
| formula | new_customer_count / denominator_to_be_approved * 100 |
| numerator | new_customer_count |
| denominator | Needs Business Decision |
| grain | monthly / store / employee |
| unit | percent |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 新規客定義と分母 |
| effective_from | — |
| version | 1.0-draft |

## 指名比率 (`nomination_rate`)

| field | value |
|---|---|
| term_id | kpi.nomination_rate |
| technical_key | nomination_rate |
| japanese_name | 指名比率 |
| display_name | 指名比率 |
| category | kpi |
| definition | 指名客数または指名売上を承認済み分母で除した比率。 |
| formula | nominated_metric / denominator_to_be_approved * 100 |
| numerator | Needs Business Decision |
| denominator | Needs Business Decision |
| grain | monthly / store / employee |
| unit | percent |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 客数/売上、総数/技術数の組合せ |
| effective_from | — |
| version | 1.0-draft |

## リピート率 (`repeat_rate`)

| field | value |
|---|---|
| term_id | kpi.repeat_rate |
| technical_key | repeat_rate |
| japanese_name | リピート率 |
| display_name | リピート率 |
| category | kpi |
| definition | 承認済みrepeat cohortの再来数を対象母数で除した比率。 |
| formula | repeat_customer_count / eligible_cohort_count * 100 |
| numerator | repeat_customer_count |
| denominator | eligible_cohort_count |
| grain | monthly / store / employee |
| unit | percent |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | cohort、期間、固定客、顧客ID欠損 |
| effective_from | — |
| version | 1.0-draft |

## 総生産性 (`total_productivity`)

| field | value |
|---|---|
| term_id | kpi.total_productivity |
| technical_key | total_productivity |
| japanese_name | 総生産性 |
| display_name | 総生産性 |
| category | kpi |
| definition | 承認済み総売上系分子を承認済み人員系分母で除したKPI。 |
| formula | approved_total_sales / approved_workforce_denominator |
| numerator | Needs Business Decision |
| denominator | Needs Business Decision |
| grain | monthly / store / employee |
| unit | JPY/person |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 分子、在籍/稼働/FTE/時間の選択 |
| effective_from | — |
| version | 1.0-draft |

## 技術生産性 (`technical_productivity`)

| field | value |
|---|---|
| term_id | kpi.technical_productivity |
| technical_key | technical_productivity |
| japanese_name | 技術生産性 |
| display_name | 技術生産性 |
| category | kpi |
| definition | 技術売上を承認済み人員系分母で除したKPI。 |
| formula | technical_sales / approved_workforce_denominator |
| numerator | technical_sales |
| denominator | Needs Business Decision |
| grain | monthly / store / employee |
| unit | JPY/person |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 稼働人数/FTE/時間の選択 |
| effective_from | — |
| version | 1.0-draft |

## 人時売上高 (`sales_per_labor_hour`)

| field | value |
|---|---|
| term_id | kpi.sales_per_labor_hour |
| technical_key | sales_per_labor_hour |
| japanese_name | 人時売上高 |
| display_name | 人時売上高 |
| category | kpi |
| definition | 承認済み売上を承認済み総労働時間で除した値。 |
| formula | approved_sales / approved_labor_hours |
| numerator | approved_sales |
| denominator | approved_labor_hours |
| grain | monthly / store / employee |
| unit | JPY/hour |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 売上基準と所定/実/休憩時間 |
| effective_from | — |
| version | 1.0-draft |

## 実労働売上高 (`actual_labor_sales_per_hour`)

| field | value |
|---|---|
| term_id | kpi.actual_labor_sales_per_hour |
| technical_key | actual_labor_sales_per_hour |
| japanese_name | 実労働売上高 |
| display_name | 実労働売上高 |
| category | kpi |
| definition | 承認済み売上を確定実労働時間で除した値。 |
| formula | approved_sales / confirmed_actual_labor_hours |
| numerator | approved_sales |
| denominator | confirmed_actual_labor_hours |
| grain | monthly / store / employee |
| unit | JPY/hour |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 人時売上高との差と実労働時間source |
| effective_from | — |
| version | 1.0-draft |

## 稼働率 (`utilization_rate`)

| field | value |
|---|---|
| term_id | kpi.utilization_rate |
| technical_key | utilization_rate |
| japanese_name | 稼働率 |
| display_name | 稼働率 |
| category | kpi |
| definition | 承認済み実稼働量を承認済み利用可能量で除した比率。 |
| formula | actual_utilized_amount / available_amount * 100 |
| numerator | Needs Business Decision |
| denominator | Needs Business Decision |
| grain | monthly / store / employee |
| unit | percent |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 人員・時間・予約枠のどれを測るか |
| effective_from | — |
| version | 1.0-draft |

## 稼働人員生産性 (`headcount_productivity`)

| field | value |
|---|---|
| term_id | kpi.headcount_productivity |
| technical_key | headcount_productivity |
| japanese_name | 稼働人員生産性 |
| display_name | 稼働人員生産性 |
| category | kpi |
| definition | 承認済み売上を稼働人数で除した値。 |
| formula | approved_sales / working_headcount |
| numerator | approved_sales |
| denominator | working_headcount |
| grain | monthly / store / employee |
| unit | JPY/person |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 売上基準と稼働人数定義 |
| effective_from | — |
| version | 1.0-draft |

## FTE生産性 (`fte_productivity`)

| field | value |
|---|---|
| term_id | kpi.fte_productivity |
| technical_key | fte_productivity |
| japanese_name | FTE生産性 |
| display_name | FTE生産性 |
| category | kpi |
| definition | 純売上をFTEで除した値。 |
| formula | net_sales / fte |
| numerator | net_sales |
| denominator | fte |
| grain | monthly / store / employee |
| unit | JPY/FTE |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | FTE標準時間と純売上 |
| effective_from | — |
| version | 1.0-draft |

## 店舗ランキング (`store_ranking`)

| field | value |
|---|---|
| term_id | kpi.store_ranking |
| technical_key | store_ranking |
| japanese_name | 店舗ランキング |
| display_name | 店舗ランキング |
| category | kpi |
| definition | 同一period・metric version・scopeで店舗を順位付けした派生値。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | monthly / store / employee |
| unit | rank |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 採用KPI、同順位、欠損、速報を含むか |
| effective_from | — |
| version | 1.0-draft |

## スタッフランキング (`staff_ranking`)

| field | value |
|---|---|
| term_id | kpi.staff_ranking |
| technical_key | staff_ranking |
| japanese_name | スタッフランキング |
| display_name | スタッフランキング |
| category | kpi |
| definition | 同一period・metric version・eligible populationでemployeeを順位付けした派生値。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | monthly / store / employee |
| unit | rank |
| timezone | Asia/Tokyo |
| source_of_truth | 承認済みsnapshot候補 |
| update_frequency | 月次close後 |
| owner | 営業部 / 経営者 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 職種・所属・応援・最低稼働条件 |
| effective_from | — |
| version | 1.0-draft |
