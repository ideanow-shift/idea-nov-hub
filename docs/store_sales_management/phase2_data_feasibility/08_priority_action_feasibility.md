# Priority Action Feasibility

AIは使わず、metric version、対象月、threshold version、reason codeを持つrule-based判定を前提とする。

| UI項目 | technical_key | 必要原本 | 現在の取得元 | 判定 | 加工方法 | 更新頻度 | 信頼度 | 未確定事項 |
|---|---|---|---|---|---|---|---|---|
| 予算達成率が基準以下 | action_budget_underperformance | 売上＋承認予算 | 両local contractあり | Derivable | gross_sales/approved_budgetをthreshold比較 | 月次 | Medium-Low | 実data・threshold・予算version |
| 前年同月比が基準以下 | action_yoy_underperformance | 13か月月次売上 | 複数月parser | Derivable | current/prior-yearをthreshold比較 | 月次 | Medium-Low | 履歴・比較可能店 |
| 3か月連続低下 | action_three_month_decline | 4か月以上の月次KPI | 複数月parser | Derivable | 連続3回のmonth-over-month低下 | 月次 | Medium-Low | 対象KPI・欠損月 |
| 新規リピート率低下 | action_new_repeat_decline | 新規cohort履歴 | 履歴なし | Unavailable | cohort factが必要 | cohort月次 | High | 期間・threshold |
| 総単価低下 | action_average_spend_decline | 売上＋客数history | aggregate contractあり | Derivable | 総単価を基準月/thresholdと比較 | 月次 | Medium-Low | 実data・比較基準 |
| 技術生産性低下 | action_technical_productivity_decline | 技術売上＋FTE | FTE不可 | Unavailable | FTE sourceが必要 | 月次 | High | threshold |
| 店販購買率低下 | action_retail_purchase_decline | 店販購入客数＋客数 | 購入客数なし | Unavailable | 購入客aggregateが必要 | 月次 | High | 分母・threshold |
| 利益率低下 | action_profit_rate_decline | 店舗P/L history | 店舗P/L正式source未確認 | Unknown | store operating profit rateを比較 | 翌月15日前後 | Low | 利益種別・実file・threshold |
| データ未入力 | action_missing_data | expected stores＋batch | Core storesとlocal receipt | Derivable | 対象store setとの差分 | 取込時 | Medium | 対象20店舗の正式集合 |
| validation error | action_validation_error | validator result | 複数local validatorsにerror category | Available | blocking errorを優先度順に列挙 | 検証時 | Medium-High | persistent batch/audit |

## Store state

| UI項目 | technical_key | 必要原本 | 現在の取得元 | 判定 | 加工方法 | 更新頻度 | 信頼度 | 未確定事項 |
|---|---|---|---|---|---|---|---|---|
| 店舗状態 | store_performance_state | 承認済みmetric snapshot | 現行placeholder warningのみ。正式分類ruleなし | Derivable | version付きthresholdで好調/安定/改善中/要対応を分類 | 月次 | Low | 指標、weight、threshold、利益確定前挙動 |

Version1で直ちに確実に出せるalertはlocal validation error。データ未入力は対象20店舗の正式store_id集合を承認後に算出できる。KPI系alertはbase dataが準備中ならalertを出さず、data unavailableを優先表示する。
