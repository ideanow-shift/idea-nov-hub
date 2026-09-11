# People terms

辞書version: 1.0-draft / 用語数: 25

## 社員 (`employee`)

| field | value |
|---|---|
| term_id | people.employee |
| technical_key | employee |
| japanese_name | 社員 |
| display_name | 社員 |
| category | people |
| definition | public.employees.idで一意に識別するcanonical person record。雇用状態とは分離する。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | UUID |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Confirmed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 現職者 (`active_employee`)

| field | value |
|---|---|
| term_id | people.active_employee |
| technical_key | active_employee |
| japanese_name | 現職者 |
| display_name | 現職者 |
| category | people |
| definition | 基準日時点で現職者管理の対象となるemployee。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | 現職社員 |
| exclusions | — |
| edge_cases | — |
| decision_required | 休職者・入社予定者を含めるか |
| effective_from | — |
| version | 1.0-draft |

## 在籍者 (`employed_person`)

| field | value |
|---|---|
| term_id | people.employed_person |
| technical_key | employed_person |
| japanese_name | 在籍者 |
| display_name | 在籍者 |
| category | people |
| definition | 基準日時点で雇用関係が有効なemployee。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 休職者を在籍人数に含めるか |
| effective_from | — |
| version | 1.0-draft |

## 休職者 (`leave_of_absence_employee`)

| field | value |
|---|---|
| term_id | people.leave_of_absence_employee |
| technical_key | leave_of_absence_employee |
| japanese_name | 休職者 |
| display_name | 休職者 |
| category | people |
| definition | 承認済み休職期間内にあるemployee。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | KPI分母ごとの除外規則を承認 |
| effective_from | — |
| version | 1.0-draft |

## 退職者 (`retired_employee`)

| field | value |
|---|---|
| term_id | people.retired_employee |
| technical_key | retired_employee |
| japanese_name | 退職者 |
| display_name | 退職者 |
| category | people |
| definition | 退職effective dateを経過したemployee。過去実績の帰属は保持する。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 退職日当日の権限・稼働扱い |
| effective_from | — |
| version | 1.0-draft |

## 稼働者 (`working_person`)

| field | value |
|---|---|
| term_id | people.working_person |
| technical_key | working_person |
| japanese_name | 稼働者 |
| display_name | 稼働者 |
| category | people |
| definition | 対象期間に承認済み稼働条件を満たすperson。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 出勤・売上・労働時間のどれを条件にするか |
| effective_from | — |
| version | 1.0-draft |

## 非稼働者 (`non_working_person`)

| field | value |
|---|---|
| term_id | people.non_working_person |
| technical_key | non_working_person |
| japanese_name | 非稼働者 |
| display_name | 非稼働者 |
| category | people |
| definition | 在籍しているが対象期間の稼働条件を満たさないperson。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 欠勤・研修・本部勤務の扱い |
| effective_from | — |
| version | 1.0-draft |

## 技術者 (`technician`)

| field | value |
|---|---|
| term_id | people.technician |
| technical_key | technician |
| japanese_name | 技術者 |
| display_name | 技術者 |
| category | people |
| definition | 技術施術売上の担当資格を持つperson。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 職位・資格・実績のいずれで判定するか |
| effective_from | — |
| version | 1.0-draft |

## スタイリスト (`stylist`)

| field | value |
|---|---|
| term_id | people.stylist |
| technical_key | stylist |
| japanese_name | スタイリスト |
| display_name | スタイリスト |
| category | people |
| definition | 承認済み職種masterでstylistに分類されるperson。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 技術者との包含関係 |
| effective_from | — |
| version | 1.0-draft |

## アシスタント (`assistant`)

| field | value |
|---|---|
| term_id | people.assistant |
| technical_key | assistant |
| japanese_name | アシスタント |
| display_name | アシスタント |
| category | people |
| definition | 承認済み職種masterでassistantに分類されるperson。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 技術売上担当可否 |
| effective_from | — |
| version | 1.0-draft |

## 店長 (`store_manager`)

| field | value |
|---|---|
| term_id | people.store_manager |
| technical_key | store_manager |
| japanese_name | 店長 |
| display_name | 店長 |
| category | people |
| definition | 有効期間付きroleとstore scopeを持つ店舗責任者。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 複数店兼任時の権限 |
| effective_from | — |
| version | 1.0-draft |

## エリアマネージャー (`area_manager`)

| field | value |
|---|---|
| term_id | people.area_manager |
| technical_key | area_manager |
| japanese_name | エリアマネージャー |
| display_name | エリアマネージャー |
| category | people |
| definition | 有効期間付きroleとarea/store scopeを持つ責任者。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | area assignmentの物理正本 |
| effective_from | — |
| version | 1.0-draft |

## FCオーナー (`franchise_owner`)

| field | value |
|---|---|
| term_id | people.franchise_owner |
| technical_key | franchise_owner |
| japanese_name | FCオーナー |
| display_name | FCオーナー |
| category | people |
| definition | 特定FC法人・店舗scopeを持つprincipal。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | employee/外部principalの区分 |
| effective_from | — |
| version | 1.0-draft |

## 応援スタッフ (`support_staff`)

| field | value |
|---|---|
| term_id | people.support_staff |
| technical_key | support_staff |
| japanese_name | 応援スタッフ |
| display_name | 応援スタッフ |
| category | people |
| definition | 対象期間に主所属外店舗で有効な応援assignmentを持つperson。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 売上と人時の計上先 |
| effective_from | — |
| version | 1.0-draft |

## 月中異動者 (`mid_month_transfer_employee`)

| field | value |
|---|---|
| term_id | people.mid_month_transfer_employee |
| technical_key | mid_month_transfer_employee |
| japanese_name | 月中異動者 |
| display_name | 月中異動者 |
| category | people |
| definition | 月内に有効な所属が変更されたemployee。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 月次人数・売上の按分/実績日帰属 |
| effective_from | — |
| version | 1.0-draft |

## 入社日 (`joined_date`)

| field | value |
|---|---|
| term_id | people.joined_date |
| technical_key | joined_date |
| japanese_name | 入社日 |
| display_name | 入社日 |
| category | people |
| definition | 雇用開始を表すeffective date。実列名joined_onはAdapterで吸収する。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | date |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees.joined_on |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Proposed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 退職日 (`retired_date`)

| field | value |
|---|---|
| term_id | people.retired_date |
| technical_key | retired_date |
| japanese_name | 退職日 |
| display_name | 退職日 |
| category | people |
| definition | 雇用終了を表すeffective date。実列名retired_onはAdapterで吸収する。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | date |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees.retired_on |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Proposed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 配属期間 (`assignment_period`)

| field | value |
|---|---|
| term_id | people.assignment_period |
| technical_key | assignment_period |
| japanese_name | 配属期間 |
| display_name | 配属期間 |
| category | people |
| definition | employeeと組織の関係が有効な開始日から終了日までの期間。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | period |
| timezone | Asia/Tokyo |
| source_of_truth | employee_assignment_histories / employee_store_assignments |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Proposed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 在籍人数 (`headcount`)

| field | value |
|---|---|
| term_id | people.headcount |
| technical_key | headcount |
| japanese_name | 在籍人数 |
| display_name | 在籍人数 |
| category | people |
| definition | 指定as-ofまたは期間ルールで在籍者を重複排除した人数。 |
| formula | COUNT(DISTINCT employee_id meeting employed rule) |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | as-of日・休職・月中異動の扱い |
| effective_from | — |
| version | 1.0-draft |

## 稼働人数 (`working_headcount`)

| field | value |
|---|---|
| term_id | people.working_headcount |
| technical_key | working_headcount |
| japanese_name | 稼働人数 |
| display_name | 稼働人数 |
| category | people |
| definition | 対象期間に稼働条件を満たしたpersonの重複排除人数。 |
| formula | COUNT(DISTINCT employee_id meeting working rule) |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 稼働条件と応援者の帰属 |
| effective_from | — |
| version | 1.0-draft |

## FTE (`fte`)

| field | value |
|---|---|
| term_id | people.fte |
| technical_key | fte |
| japanese_name | FTE |
| display_name | FTE |
| category | people |
| definition | 対象期間の標準労働量に対する実労働量の換算人数。 |
| formula | confirmed_labor_hours / standard_labor_hours |
| numerator | confirmed_labor_hours |
| denominator | standard_labor_hours |
| grain | employee / effective_period |
| unit | FTE |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 標準労働時間と休暇扱い |
| effective_from | — |
| version | 1.0-draft |

## 労働時間 (`labor_hours`)

| field | value |
|---|---|
| term_id | people.labor_hours |
| technical_key | labor_hours |
| japanese_name | 労働時間 |
| display_name | 労働時間 |
| category | people |
| definition | 承認済み勤怠から得る対象期間の時間量。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | hour |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（勤怠正本候補） |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 実労働/所定/残業/休憩の包含 |
| effective_from | — |
| version | 1.0-draft |

## スタッフ数 (`staff_count`)

| field | value |
|---|---|
| term_id | people.staff_count |
| technical_key | staff_count |
| japanese_name | スタッフ数 |
| display_name | スタッフ数 |
| category | people |
| definition | 現行表記。正式には在籍人数・稼働人数・FTEのいずれかへ分解する。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.employees, assignment history |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Needs Business Decision |
| aliases | 社員数 |
| exclusions | — |
| edge_cases | — |
| decision_required | 利用画面ごとに正式分母へ置換 |
| effective_from | — |
| version | 1.0-draft |

## 上長関係 (`manager_relationship`)

| field | value |
|---|---|
| term_id | people.manager_relationship |
| technical_key | manager_relationship |
| japanese_name | 上長関係 |
| display_name | 上長関係 |
| category | people |
| definition | employeeと直属上長の有効期間付き関係。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | person |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（Core拡張候補） |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Proposed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 社員外部ID (`employee_external_id`)

| field | value |
|---|---|
| term_id | people.employee_external_id |
| technical_key | employee_external_id |
| japanese_name | 社員外部ID |
| display_name | 社員外部ID |
| category | people |
| definition | source system内のstaff ID。Core IDへmappingして利用する。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / effective_period |
| unit | identifier |
| timezone | Asia/Tokyo |
| source_of_truth | source system |
| update_frequency | 随時（effective-dated） |
| owner | 人事 / Core Master owner |
| consumers | 店舗営業管理 / NOV Talent / 現職者管理 |
| access_level | 本人・管理scope。個人情報はHR権限 |
| status | Proposed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |
