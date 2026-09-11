# Customer and Repeat Inventory

## Current aggregate assets

- customer summary CSVは総来店件数等7列を受けるが、normalized outputはvisitCountだけを保持し、売上・平均客単価を破棄する。
- visit cohort CSVはtechnical/total/new/second/third/fixed countsを保持し、合計一致を検証する。
- repeat summary CSVは再来/固定/新規/準固定の売上・客数を保持し、候補repeat rateを計算する。
- いずれも月次aggregate・local-onlyで、customer IDやvisit historyはない。

| UI項目 | technical_key | 必要原本 | 現在の取得元 | 判定 | 加工方法 | 更新頻度 | 信頼度 | 未確定事項 |
|---|---|---|---|---|---|---|---|---|
| 総客数 | total_customer_count | 店舗月次客数原本 | customer/visit cohort local CSV contract。実fileなし | Unknown | 承認visit単位で集計 | 月次 | Low | 会計/visit/customerの単位 |
| 技術客数 | technical_customer_count | 店舗月次客数原本 | visit cohort CSV列あり。実fileなし | Unknown | 重複排除して集計 | 月次 | Low | 同日複数施術 |
| 新規客数 | new_customer_count | 来店区分集計 | visit cohort/repeat CSV列あり。実fileなし | Unknown | 既存業務ruleによるaggregateを採用 | 月次 | Low | 新規定義・判定期間 |
| 再来客数 | returning_customer_count | 来店区分集計 | repeat CSVに再来、visit cohortに2/3回目 | Unknown | 既存categoryを承認後に集計 | 月次 | Low | 再来と2/3回目の対応 |
| 固定客数 | fixed_customer_count | 来店区分集計 | repeat/visit cohort CSV列あり。実fileなし | Unknown | 既存業務ruleのaggregateを採用 | 月次 | Low | 固定判定期間 |
| 店販購入客数 | retail_purchasing_customer_count | 会計/顧客集計 | 対応validator・保存先なし | Unavailable | 新たなaggregate sourceが必要 | 月次 | High | 会計単位かcustomer単位か |
| 顧客ID | customer_id | 顧客master | repository内に店舗売上用customer masterなし | Unavailable | PII境界を持つcustomer identityが必要 | 随時 | High | sourceとprivacy |
| 来店履歴 | visit_history | 予約/POS visit event | transaction/visit履歴なし。月次aggregateのみ | Unavailable | visit factが必要 | 日次 | High | source、重複排除、訂正 |
| 初回来店日・次回来店日 | customer_visit_dates | 来店履歴 | 履歴なし | Unavailable | customer_id単位の時系列が必要 | 日次 | High | 店舗横断identity |
| 店舗間顧客重複 | cross_store_customer_duplicate | 顧客ID＋来店履歴 | 顧客IDなし | Unavailable | privacy-preserving identity resolutionが必要 | 月次 | High | 統合ルール |

## Repeat rates

| UI項目 | technical_key | 必要原本 | 現在の取得元 | 判定 | 加工方法 | 更新頻度 | 信頼度 | 未確定事項 |
|---|---|---|---|---|---|---|---|---|
| 総リピート率 | total_repeat_rate | 来店区分aggregate | repeat/visit cohort local CSVから候補式あり | Derivable | (2回目+3回目+固定)/総来店数の暫定式 | 月次 | Medium-Low | 既存正式期間・準固定の扱い |
| 新規リピート率 | new_customer_repeat_rate | 新規cohortの次回来店 | 顧客ID・cohort履歴なし | Unavailable | 新規cohort visit historyが必要 | cohort月次 | High | 判定期間 |
| 再来リピート率 | returning_customer_repeat_rate | 再来cohortの次回来店 | 顧客ID・cohort履歴なし | Unavailable | 再来cohort visit historyが必要 | cohort月次 | High | 母集団・期間 |
| 固定リピート率 | fixed_customer_repeat_rate | 固定cohortの次回来店 | 顧客ID・cohort履歴なし | Unavailable | 固定cohort visit historyが必要 | cohort月次 | High | 固定定義・期間 |

既存集計値を表示する方式は、正式Spreadsheet/fileと判定期間を確認した後に限り採用できる。将来自動算出にはcustomer identity、visit fact、cohort version、privacy boundaryが必要。
