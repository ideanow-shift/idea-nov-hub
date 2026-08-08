# Sales terms

辞書version: 1.0-draft / 用語数: 21

## 総売上 (`gross_sales`)

| field | value |
|---|---|
| term_id | sales.gross_sales |
| technical_key | gross_sales |
| japanese_name | 総売上 |
| display_name | 総売上 |
| category | sales |
| definition | 指定税・値引・取消・返品ルールに基づく売上集計。現時点では式未承認。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | 売上 / 総売上高 |
| exclusions | — |
| edge_cases | — |
| decision_required | 税込/税抜、調整前後、構成項目を承認 |
| effective_from | — |
| version | 1.0-draft |

## 税込売上 (`tax_inclusive_sales`)

| field | value |
|---|---|
| term_id | sales.tax_inclusive_sales |
| technical_key | tax_inclusive_sales |
| japanese_name | 税込売上 |
| display_name | 税込売上 |
| category | sales |
| definition | 消費税を含む売上額。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 内税/外税と端数規則 |
| effective_from | — |
| version | 1.0-draft |

## 税抜売上 (`tax_exclusive_sales`)

| field | value |
|---|---|
| term_id | sales.tax_exclusive_sales |
| technical_key | tax_exclusive_sales |
| japanese_name | 税抜売上 |
| display_name | 税抜売上 |
| category | sales |
| definition | 消費税を含まない売上額。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 税計算・端数・軽減税率 |
| effective_from | — |
| version | 1.0-draft |

## 技術売上 (`technical_sales`)

| field | value |
|---|---|
| term_id | sales.technical_sales |
| technical_key | technical_sales |
| japanese_name | 技術売上 |
| display_name | 技術売上 |
| category | sales |
| definition | 承認済みservice categoryに分類された売上。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | 施術売上 |
| exclusions | — |
| edge_cases | — |
| decision_required | 純売上かgrossか、category owner、セット按分 |
| effective_from | — |
| version | 1.0-draft |

## 店販売上 (`retail_sales`)

| field | value |
|---|---|
| term_id | sales.retail_sales |
| technical_key | retail_sales |
| japanese_name | 店販売上 |
| display_name | 店販売上 |
| category | sales |
| definition | 承認済みretail product categoryに分類された売上。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | 商品売上 / 物販売上 |
| exclusions | — |
| edge_cases | — |
| decision_required | MID/EC/返品/セット按分の扱い |
| effective_from | — |
| version | 1.0-draft |

## MID売上 (`mid_sales`)

| field | value |
|---|---|
| term_id | sales.mid_sales |
| technical_key | mid_sales |
| japanese_name | MID売上 |
| display_name | MID売上 |
| category | sales |
| definition | 現行表記のMIDに該当する売上。MIDの正式意味とsource項目は未確認。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Unknown |
| aliases | ミルボンID売上 |
| exclusions | — |
| edge_cases | — |
| decision_required | MIDの正式名称、重複関係、sourceを確認 |
| effective_from | — |
| version | 1.0-draft |

## MID除外店販売上 (`retail_sales_excluding_mid`)

| field | value |
|---|---|
| term_id | sales.retail_sales_excluding_mid |
| technical_key | retail_sales_excluding_mid |
| japanese_name | MID除外店販売上 |
| display_name | MID除外店販売上 |
| category | sales |
| definition | 店販売上からMIDとして定義された金額を除いた候補値。 |
| formula | retail_sales - mid_sales（候補） |
| numerator | retail_sales - mid_sales |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Unknown |
| aliases | 商品売上（MID抜き） |
| exclusions | — |
| edge_cases | — |
| decision_required | MIDが店販売上に内包されるか確認 |
| effective_from | — |
| version | 1.0-draft |

## 指名売上 (`nominated_sales`)

| field | value |
|---|---|
| term_id | sales.nominated_sales |
| technical_key | nominated_sales |
| japanese_name | 指名売上 |
| display_name | 指名売上 |
| category | sales |
| definition | 指名区分が承認条件を満たす売上。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 指名判定時点と複数担当按分 |
| effective_from | — |
| version | 1.0-draft |

## 指名外売上 (`non_nominated_sales`)

| field | value |
|---|---|
| term_id | sales.non_nominated_sales |
| technical_key | non_nominated_sales |
| japanese_name | 指名外売上 |
| display_name | 指名外売上 |
| category | sales |
| definition | 指名売上に該当しない対象技術売上。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | フリー売上 |
| exclusions | — |
| edge_cases | — |
| decision_required | 対象売上と除外区分 |
| effective_from | — |
| version | 1.0-draft |

## 新規売上 (`new_customer_sales`)

| field | value |
|---|---|
| term_id | sales.new_customer_sales |
| technical_key | new_customer_sales |
| japanese_name | 新規売上 |
| display_name | 新規売上 |
| category | sales |
| definition | 承認済み新規客定義に該当する来店の売上。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 新規客定義と顧客ID欠損 |
| effective_from | — |
| version | 1.0-draft |

## 既存売上 (`existing_customer_sales`)

| field | value |
|---|---|
| term_id | sales.existing_customer_sales |
| technical_key | existing_customer_sales |
| japanese_name | 既存売上 |
| display_name | 既存売上 |
| category | sales |
| definition | 承認済み既存客定義に該当する来店の売上。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 再来/固定/失客復帰の包含 |
| effective_from | — |
| version | 1.0-draft |

## 値引き (`discount`)

| field | value |
|---|---|
| term_id | sales.discount |
| technical_key | discount |
| japanese_name | 値引き |
| display_name | 値引き |
| category | sales |
| definition | 原取引に関連付く価格減額。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 売上区分への按分と税 |
| effective_from | — |
| version | 1.0-draft |

## 返品 (`return_amount`)

| field | value |
|---|---|
| term_id | sales.return_amount |
| technical_key | return_amount |
| japanese_name | 返品 |
| display_name | 返品 |
| category | sales |
| definition | 商品またはサービスの返却に関連する調整イベントまたは金額。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | 返品額 |
| exclusions | — |
| edge_cases | — |
| decision_required | 返品日/原売上日の計上 |
| effective_from | — |
| version | 1.0-draft |

## 返金 (`refund_amount`)

| field | value |
|---|---|
| term_id | sales.refund_amount |
| technical_key | refund_amount |
| japanese_name | 返金 |
| display_name | 返金 |
| category | sales |
| definition | 顧客へ返した金額。返品・取消と別イベントで保持する。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 現金/決済返金と売上減額の関係 |
| effective_from | — |
| version | 1.0-draft |

## キャンセル (`cancellation_amount`)

| field | value |
|---|---|
| term_id | sales.cancellation_amount |
| technical_key | cancellation_amount |
| japanese_name | キャンセル |
| display_name | キャンセル |
| category | sales |
| definition | 成立済み取引または予約の取消。売上イベントと予約イベントを区別する。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 売上計上済み取消のみ金額対象とするか |
| effective_from | — |
| version | 1.0-draft |

## 純売上 (`net_sales`)

| field | value |
|---|---|
| term_id | sales.net_sales |
| technical_key | net_sales |
| japanese_name | 純売上 |
| display_name | 純売上 |
| category | sales |
| definition | 承認済み税基準の売上から値引・取消・返品等を適用した売上。 |
| formula | approved_sales - discounts - cancellations - returns（候補） |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | approved_salesの税基準と返金・訂正の扱い |
| effective_from | — |
| version | 1.0-draft |

## 売上計上日 (`sales_recognition_date`)

| field | value |
|---|---|
| term_id | sales.sales_recognition_date |
| technical_key | sales_recognition_date |
| japanese_name | 売上計上日 |
| display_name | 売上計上日 |
| category | sales |
| definition | 売上を報告期間へ帰属させる承認済み日付。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | date |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 施術日/決済日/締め日/訂正日の優先 |
| effective_from | — |
| version | 1.0-draft |

## 売上月 (`sales_month`)

| field | value |
|---|---|
| term_id | sales.sales_month |
| technical_key | sales_month |
| japanese_name | 売上月 |
| display_name | 売上月 |
| category | sales |
| definition | 売上計上日または営業日から導出するYYYY-MMの月次期間。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | monthly / store |
| unit | month |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Proposed |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | — |
| effective_from | — |
| version | 1.0-draft |

## 仮売上 (`provisional_sales`)

| field | value |
|---|---|
| term_id | sales.provisional_sales |
| technical_key | provisional_sales |
| japanese_name | 仮売上 |
| display_name | 仮売上 |
| category | sales |
| definition | close前または検証未完了の売上version。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 仮売上をランキングに含めるか |
| effective_from | — |
| version | 1.0-draft |

## 確定売上 (`confirmed_sales`)

| field | value |
|---|---|
| term_id | sales.confirmed_sales |
| technical_key | confirmed_sales |
| japanese_name | 確定売上 |
| display_name | 確定売上 |
| category | sales |
| definition | source検証・close・承認条件を満たしたimmutable versionの売上。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 承認者と確定条件 |
| effective_from | — |
| version | 1.0-draft |

## 修正売上 (`corrected_sales`)

| field | value |
|---|---|
| term_id | sales.corrected_sales |
| technical_key | corrected_sales |
| japanese_name | 修正売上 |
| display_name | 修正売上 |
| category | sales |
| definition | 確定後の訂正を新versionとして反映した売上。 |
| formula | — |
| numerator | — |
| denominator | — |
| grain | transaction / daily / monthly / store / employee |
| unit | JPY |
| timezone | Asia/Tokyo |
| source_of_truth | Unknown（店舗売上原本候補） |
| update_frequency | 日次・月次close後 |
| owner | 営業部 / 経理 |
| consumers | 店舗営業管理 / 法人経営管理 |
| access_level | role × corporation/store scope |
| status | Needs Business Decision |
| aliases | — |
| exclusions | — |
| edge_cases | — |
| decision_required | 再open、承認、原version参照 |
| effective_from | — |
| version | 1.0-draft |
