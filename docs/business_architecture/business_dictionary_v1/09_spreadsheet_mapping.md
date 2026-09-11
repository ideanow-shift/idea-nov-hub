# 営業部Spreadsheet mapping

対象名: 「直営店舗 月別店舗比較（2026年）」

原本状態: repository内では未確認。現行管理画面の表示・式を参考evidenceとして使用した。

| 現行表示名 | 推奨正式名称 | technical_key | 定義確認状況 | 推奨計算式 | 未確定事項 |
|---|---|---|---|---|---|
| 総売上 | 総売上 | gross_sales | Needs Business Decision | 承認済み総売上定義 | 税込/税抜、値引・取消・返品前後 |
| 技術売上 | 技術売上 | technical_sales | Needs Business Decision | 承認済み技術category売上 | 純売上か、セット按分 |
| 商品売上 | 店販売上 | retail_sales | Needs Business Decision | 承認済みretail category売上 | MID/EC/返品の扱い |
| 商品売上（MID抜き） | MID除外店販売上 | retail_sales_excluding_mid | Unknown | retail_sales - mid_sales（候補） | MIDの意味と内包関係 |
| 総客数 | 総客数 | total_customer_count | Needs Business Decision | 重複排除済み対象客数 | visit/customer/account単位 |
| 技術客数 | 技術客数 | technical_customer_count | Needs Business Decision | 技術service対象客数 | 同日複数技術の重複 |
| 総単価 | 客単価 | average_spend | Needs Business Decision | approved_sales / total_customer_count | 分子売上と分母客数 |
| 技術単価 | 技術単価 | technical_average_spend | Needs Business Decision | technical_sales / technical_customer_count | 税込/純売上 |
| スタッフ数 | 稼働人数（候補） | staff_count | Needs Business Decision | 画面ごとに在籍/稼働/FTEへ分解 | 月中異動・休職・応援 |
| 総生産性 | 総生産性 | total_productivity | Needs Business Decision | approved_total_sales / approved_workforce_denominator | 分子と分母 |
| 技術生産性 | 技術生産性 | technical_productivity | Needs Business Decision | technical_sales / approved_workforce_denominator | 稼働人数/FTE/時間 |
| 新規客数 | 新規客数 | new_customer_count | Needs Business Decision | 承認済み新規客のCOUNT DISTINCT | 全社/店舗初回、lookback |
| リピート率 | リピート率 | repeat_rate | Needs Business Decision | repeat_customer_count / eligible_cohort_count | 対象期間、cohort、顧客ID |
| 店販購買客数 | 店販購入客数 | retail_purchasing_customer_count | Needs Business Decision | 承認済み購入客COUNT DISTINCT | 会計/顧客単位 |
| 購買率 | 店販購買率 | retail_purchase_rate | Needs Business Decision | retail_purchasing_customer_count / approved_customer_denominator | 総客/技術客/来店数 |
| 実労働売上高 | 実労働売上高 | actual_labor_sales_per_hour | Needs Business Decision | approved_sales / confirmed_actual_labor_hours | 実労働時間source |
| 人時売上高 | 人時売上高 | sales_per_labor_hour | Needs Business Decision | approved_sales / approved_labor_hours | 実労働との違い、休憩 |
| 稼働率 | 稼働率 | utilization_rate | Needs Business Decision | actual_utilized_amount / available_amount | 人員/時間/予約枠 |
| 予算比 | 予算達成率 | budget_achievement_rate | Needs Business Decision | actual_sales / approved_budget | 予算versionと実績定義 |
| 前年比 | 前年比 | year_over_year_rate | Needs Business Decision | current_period_value / prior_year_comparable_value | 比較可能店、0分母 |

## 現行画面で確認した参考式

- 技術生産性 = 技術売上 ÷ 稼働人数
- 総生産性 = (技術売上 + 商品売上) ÷ 稼働人数
- 技術単価 = 技術売上 ÷ 技術客数
- 総単価 = (技術売上 + 商品売上) ÷ 総来店数
- リピート率 = (2回目 + 3回目 + 固定) ÷ 総来店数
- EC売上は上記生産性・単価から除外する現行preview
- MID/ミルボンIDは商品売上との重複可能性から合算しない現行preview

これらはlocal previewの式で、本番保存・承認・再計算が無効な画面由来である。正式式ではない。
