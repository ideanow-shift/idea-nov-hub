# Organization terms

辞書version: 1.0-draft / 用語数: 17

## 会社 (`company`)

| field | value |
|---|---|
| term_id | organization.company |
| technical_key | company |
| japanese_name | 会社 |
| display_name | 会社 |
| category | organization |
| definition | 日常語として用いられる事業体。法人との同義扱い可否は未承認。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | organization |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | 企業 |
| exclusions | — |
| edge_cases | — |
| decision_required | 会社と法人を同義にするか決定 |
| effective_from | — |
| version | 1.0-draft |

## 法人 (`corporation`)

| field | value |
|---|---|
| term_id | organization.corporation |
| technical_key | corporation |
| japanese_name | 法人 |
| display_name | 法人 |
| category | organization |
| definition | Core corporation IDで一意に識別する法人格または経営集計主体。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | corporation |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Confirmed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 店舗 (`store`)

| field | value |
|---|---|
| term_id | organization.store |
| technical_key | store |
| japanese_name | 店舗 |
| display_name | 店舗 |
| category | organization |
| definition | Core store IDで一意に識別する営業・管理拠点。名称は識別子にしない。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | store |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Confirmed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 営業店舗 (`operating_store`)

| field | value |
|---|---|
| term_id | organization.operating_store |
| technical_key | operating_store |
| japanese_name | 営業店舗 |
| display_name | 営業店舗 |
| category | organization |
| definition | 対象営業日に営業対象として有効な店舗。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | store / effective_date |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | 閉店後期間 |
| edge_cases | — |
| decision_required | 休業・開店準備中を含めるか |
| effective_from | — |
| version | 1.0-draft |

## 閉店店舗 (`closed_store`)

| field | value |
|---|---|
| term_id | organization.closed_store |
| technical_key | closed_store |
| japanese_name | 閉店店舗 |
| display_name | 閉店店舗 |
| category | organization |
| definition | 閉店effective date以降は新規営業実績を受け付けないが、過去実績参照を維持する店舗。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | store / effective_date |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 閉店日当日の扱い |
| effective_from | — |
| version | 1.0-draft |

## 直営店舗 (`directly_managed_store`)

| field | value |
|---|---|
| term_id | organization.directly_managed_store |
| technical_key | directly_managed_store |
| japanese_name | 直営店舗 |
| display_name | 直営店舗 |
| category | organization |
| definition | 承認済みownership ruleで直営と判定された店舗。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | organization |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | 直営店 |
| exclusions | — |
| edge_cases | — |
| decision_required | 判定属性と集計法人を承認 |
| effective_from | — |
| version | 1.0-draft |

## FC店舗 (`franchise_store`)

| field | value |
|---|---|
| term_id | organization.franchise_store |
| technical_key | franchise_store |
| japanese_name | FC店舗 |
| display_name | FC店舗 |
| category | organization |
| definition | 承認済みfranchise ruleでFCと判定された店舗。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | organization |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | FC店 |
| exclusions | — |
| edge_cases | — |
| decision_required | 所有法人・運営法人・集計法人の関係を承認 |
| effective_from | — |
| version | 1.0-draft |

## 部署 (`department`)

| field | value |
|---|---|
| term_id | organization.department |
| technical_key | department |
| japanese_name | 部署 |
| display_name | 部署 |
| category | organization |
| definition | Core department IDで識別する組織部門。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | department |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.departments |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Proposed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## エリア (`area`)

| field | value |
|---|---|
| term_id | organization.area |
| technical_key | area |
| japanese_name | エリア |
| display_name | エリア |
| category | organization |
| definition | 複数店舗を営業管理上まとめるeffective-dated管理単位。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | area / effective_period |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | area masterと店舗所属期間を承認 |
| effective_from | — |
| version | 1.0-draft |

## 所属 (`affiliation`)

| field | value |
|---|---|
| term_id | organization.affiliation |
| technical_key | affiliation |
| japanese_name | 所属 |
| display_name | 所属 |
| category | organization |
| definition | employeeと法人・部署・店舗等の有効期間付き関係。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | employee / organization / effective_period |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / assignment history |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 業務ownerの定義承認が必要 |
| effective_from | — |
| version | 1.0-draft |

## 主所属 (`primary_affiliation`)

| field | value |
|---|---|
| term_id | organization.primary_affiliation |
| technical_key | primary_affiliation |
| japanese_name | 主所属 |
| display_name | 主所属 |
| category | organization |
| definition | 同一時点の複数所属のうち基準となる一つの所属。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | organization |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 主所属選択規則を承認 |
| effective_from | — |
| version | 1.0-draft |

## 兼務 (`concurrent_assignment`)

| field | value |
|---|---|
| term_id | organization.concurrent_assignment |
| technical_key | concurrent_assignment |
| japanese_name | 兼務 |
| display_name | 兼務 |
| category | organization |
| definition | 同一期間に主所属以外の有効な所属を持つ状態。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | organization |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 実績・人員の按分規則を承認 |
| effective_from | — |
| version | 1.0-draft |

## 応援店舗 (`support_store`)

| field | value |
|---|---|
| term_id | organization.support_store |
| technical_key | support_store |
| japanese_name | 応援店舗 |
| display_name | 応援店舗 |
| category | organization |
| definition | 主所属以外で一時的に勤務・売上計上対象となる店舗。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | organization |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 勤務・売上・人件費の計上先を承認 |
| effective_from | — |
| version | 1.0-draft |

## 所有法人 (`owning_corporation`)

| field | value |
|---|---|
| term_id | organization.owning_corporation |
| technical_key | owning_corporation |
| japanese_name | 所有法人 |
| display_name | 所有法人 |
| category | organization |
| definition | 店舗資産または契約上の所有主体となる法人。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | organization |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 直営/FCでの正式属性を承認 |
| effective_from | — |
| version | 1.0-draft |

## 運営法人 (`operating_corporation`)

| field | value |
|---|---|
| term_id | organization.operating_corporation |
| technical_key | operating_corporation |
| japanese_name | 運営法人 |
| display_name | 運営法人 |
| category | organization |
| definition | 店舗の日常運営責任を負う法人。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | organization |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 所有法人と異なる場合の権限を承認 |
| effective_from | — |
| version | 1.0-draft |

## 集計法人 (`aggregation_corporation`)

| field | value |
|---|---|
| term_id | organization.aggregation_corporation |
| technical_key | aggregation_corporation |
| japanese_name | 集計法人 |
| display_name | 集計法人 |
| category | organization |
| definition | KPI・財務報告で実績を帰属させる法人。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | organization |
| unit | record |
| timezone | Asia/Tokyo |
| source_of_truth | Core Read Adapter / public.corporations, public.stores |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | FC・共同運営時の集計規則を承認 |
| effective_from | — |
| version | 1.0-draft |

## 店舗Core ID (`store_core_id`)

| field | value |
|---|---|
| term_id | organization.store_core_id |
| technical_key | store_core_id |
| japanese_name | 店舗Core ID |
| display_name | 店舗Core ID |
| category | organization |
| definition | 店舗名称・外部コードから分離したpublic.stores.id。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | store |
| unit | UUID |
| timezone | Asia/Tokyo |
| source_of_truth | public.stores.id |
| update_frequency | 随時（effective-dated） |
| owner | Core Master owner |
| consumers | 店舗営業管理 / 法人経営管理 / NOV Talent / 現職者管理 |
| access_level | 認可されたcorporation/store scope |
| status | Proposed |
| aliases | store_id |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |
