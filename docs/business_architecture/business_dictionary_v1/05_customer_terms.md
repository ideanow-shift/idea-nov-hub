# Customer terms

辞書version: 1.0-draft / 用語数: 15

## 総客数 (`total_customer_count`)

| field | value |
|---|---|
| term_id | customer.total_customer_count |
| technical_key | total_customer_count |
| japanese_name | 総客数 |
| display_name | 総客数 |
| category | customer |
| definition | 対象期間の承認済みvisit/customer重複排除規則による客数。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | 総来店数 |
| exclusions | — |
| edge_cases | — |
| decision_required | 会計数/visit数/customer数の採用 |
| effective_from | — |
| version | 1.0-draft |

## 技術客数 (`technical_customer_count`)

| field | value |
|---|---|
| term_id | customer.technical_customer_count |
| technical_key | technical_customer_count |
| japanese_name | 技術客数 |
| display_name | 技術客数 |
| category | customer |
| definition | 技術serviceを受けたvisit/customerの承認済み客数。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 複数技術・同日再来の重複排除 |
| effective_from | — |
| version | 1.0-draft |

## 店販購入客数 (`retail_purchasing_customer_count`)

| field | value |
|---|---|
| term_id | customer.retail_purchasing_customer_count |
| technical_key | retail_purchasing_customer_count |
| japanese_name | 店販購入客数 |
| display_name | 店販購入客数 |
| category | customer |
| definition | 対象期間に店販購入条件を満たしたvisit/customer数。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | 商品購買客数 / 店販購買客数 |
| exclusions | — |
| edge_cases | — |
| decision_required | 顧客/会計単位と技術来店なし購入 |
| effective_from | — |
| version | 1.0-draft |

## 新規客 (`new_customer`)

| field | value |
|---|---|
| term_id | customer.new_customer |
| technical_key | new_customer |
| japanese_name | 新規客 |
| display_name | 新規客 |
| category | customer |
| definition | 承認済みlookback範囲内で初回来店と判定された顧客。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | 新規 |
| exclusions | — |
| edge_cases | — |
| decision_required | 全社/店舗初回、lookback、顧客ID欠損 |
| effective_from | — |
| version | 1.0-draft |

## 既存客 (`existing_customer`)

| field | value |
|---|---|
| term_id | customer.existing_customer |
| technical_key | existing_customer |
| japanese_name | 既存客 |
| display_name | 既存客 |
| category | customer |
| definition | 新規客以外で有効な来店履歴を持つ顧客。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 失客復帰の扱い |
| effective_from | — |
| version | 1.0-draft |

## 再来客 (`returning_customer`)

| field | value |
|---|---|
| term_id | customer.returning_customer |
| technical_key | returning_customer |
| japanese_name | 再来客 |
| display_name | 再来客 |
| category | customer |
| definition | 初回来店後に再度来店した顧客。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 対象期間と店舗跨ぎ |
| effective_from | — |
| version | 1.0-draft |

## リピート客 (`repeat_customer`)

| field | value |
|---|---|
| term_id | customer.repeat_customer |
| technical_key | repeat_customer |
| japanese_name | リピート客 |
| display_name | リピート客 |
| category | customer |
| definition | 承認済み回数・期間条件を満たす再来客。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 2回目/3回目/固定の包含と期間 |
| effective_from | — |
| version | 1.0-draft |

## 指名客 (`nominated_customer`)

| field | value |
|---|---|
| term_id | customer.nominated_customer |
| technical_key | nominated_customer |
| japanese_name | 指名客 |
| display_name | 指名客 |
| category | customer |
| definition | 対象来店で指名条件を満たす顧客。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 一部指名・複数担当 |
| effective_from | — |
| version | 1.0-draft |

## 指名外客 (`non_nominated_customer`)

| field | value |
|---|---|
| term_id | customer.non_nominated_customer |
| technical_key | non_nominated_customer |
| japanese_name | 指名外客 |
| display_name | 指名外客 |
| category | customer |
| definition | 対象来店で指名条件を満たさない顧客。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | フリー客 |
| exclusions | — |
| edge_cases | — |
| decision_required | 技術客のみを対象とするか |
| effective_from | — |
| version | 1.0-draft |

## 失客 (`lost_customer`)

| field | value |
|---|---|
| term_id | customer.lost_customer |
| technical_key | lost_customer |
| japanese_name | 失客 |
| display_name | 失客 |
| category | customer |
| definition | 承認済み無来店期間を超えた顧客。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Unknown |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | lookback期間と再来時の復帰 |
| effective_from | — |
| version | 1.0-draft |

## 来店回数 (`visit_count`)

| field | value |
|---|---|
| term_id | customer.visit_count |
| technical_key | visit_count |
| japanese_name | 来店回数 |
| display_name | 来店回数 |
| category | customer |
| definition | 承認済みvisit keyで重複排除した来店event数。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | visit |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 同日複数会計・施術の統合 |
| effective_from | — |
| version | 1.0-draft |

## 重複客数 (`duplicate_customer_count`)

| field | value |
|---|---|
| term_id | customer.duplicate_customer_count |
| technical_key | duplicate_customer_count |
| japanese_name | 重複客数 |
| display_name | 重複客数 |
| category | customer |
| definition | 同一人物の重複customer record数または重複除外数。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Unknown |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 意味、matching rule、PII利用を確認 |
| effective_from | — |
| version | 1.0-draft |

## キャンセル客 (`cancelled_customer`)

| field | value |
|---|---|
| term_id | customer.cancelled_customer |
| technical_key | cancelled_customer |
| japanese_name | キャンセル客 |
| display_name | キャンセル客 |
| category | customer |
| definition | 予約を取消した顧客/予約件数。売上客数には含めない候補。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 当日/事前、顧客数/予約数の単位 |
| effective_from | — |
| version | 1.0-draft |

## 無断キャンセル (`no_show_customer`)

| field | value |
|---|---|
| term_id | customer.no_show_customer |
| technical_key | no_show_customer |
| japanese_name | 無断キャンセル |
| display_name | 無断キャンセル |
| category | customer |
| definition | 来店せず、承認済みno-show条件を満たす予約。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | ノーショー |
| exclusions | — |
| edge_cases | — |
| decision_required | 連絡有無と期限 |
| effective_from | — |
| version | 1.0-draft |

## 紹介客 (`referred_customer`)

| field | value |
|---|---|
| term_id | customer.referred_customer |
| technical_key | referred_customer |
| japanese_name | 紹介客 |
| display_name | 紹介客 |
| category | customer |
| definition | 承認済み紹介sourceを持つ新規または既存顧客。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | visit / customer / daily / monthly / store |
| unit | count |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（POS/予約/顧客原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 |
| consumers | 店舗営業管理 |
| access_level | 集計はstore scope。個票は高感度権限 |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 紹介者・媒体・初回来店限定 |
| effective_from | — |
| version | 1.0-draft |
