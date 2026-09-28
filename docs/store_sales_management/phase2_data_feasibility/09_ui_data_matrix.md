# Executive Dashboard UI Data Matrix

判定母数はExecutive Dashboardの表示・状態・rule入力を含む93項目。Availableは確認できたfield/path、Derivableは確認済み入力から明示式で作れるもの、Unavailableは必要grainが存在しないもの、Unknownはsource/file/valueを確認できないもの。

| UI項目 | technical_key | 必要原本 | 現在の取得元 | 判定 | 加工方法 | 更新頻度 | 信頼度 | 未確定事項 |
|---|---|---|---|---|---|---|---|---|
| 総売上 | gross_sales_tax_inclusive | 店舗売上原本 | 店舗月次CSV contractのみ。実ファイル・永続保存なし | Unknown | 税込、MID含有、EC按分後の承認式 | 月次 | Low | 正式source・税/調整ルール・実データ |
| 技術売上 | technical_sales_tax_inclusive | 店舗売上原本の技術区分 | 月次CSV列technical_salesのみ | Unknown | 承認categoryを税込集計 | 月次 | Low | source categoryと按分 |
| 通常店販売上 | retail_sales_excluding_mid | 店舗売上原本の店販区分 | product_sales列とMID列のcontractのみ | Unknown | 店販売上からMIDを分離。二重計上禁止 | 月次 | Low | product_salesがMID込みか不明 |
| MID売上 | mid_sales | MID原本 | milbon_id_sales列。値がなければNOT_IN_SOURCE | Unknown | 総売上には含め、店販分析では分離 | 月次 | Low | MIDの正式source・重複関係 |
| EC売上 | ec_sales_allocated | EC売上原本＋店舗按分表 | ec_sales列contractのみ。按分処理なし | Unknown | 承認済み配賦keyで担当店舗へ按分 | 月次 | Low | EC原本・按分owner・未配賦処理 |
| 売上予算 | approved_sales_budget | 承認予算 | store-monthly-budget local CSV contract。正式file/保存先なし | Unknown | 当初/修正/承認versionからas-of選択 | 月次 | Low | 正式version・承認・source |
| 前年同月売上 | prior_year_same_month_sales | 月次確定売上 | 月次CSV/P&L parserは複数月を扱える | Derivable | 同一store_id・定義versionの12か月前を取得 | 月次 | Medium-Low | 13か月分実データと比較可能店規則 |
| 年間累計売上 | sales_ytd | 月次確定売上 | 月次periodを扱うlocal parser | Derivable | 会計年度開始月から対象月までSUM | 月次 | Medium-Low | 年度開始月・月欠損・速報混在 |
| 前年年間累計売上 | prior_year_sales_ytd | 前年月次確定売上 | 月次periodを扱うlocal parser | Derivable | 前年同一cutoffまでSUM | 月次 | Medium-Low | 前年履歴・比較可能店 |
| 店舗別月次損益表 | store_monthly_pl | 経理月次P/L | Yayoi/normalized P/L local parserと店舗候補sheet。実ファイル・正式mappingなし | Unknown | Core store_id mapping後に月次正規化 | 翌月15日前後 | Medium-Low | 正式file、店舗sheet、科目mapping |
| 法人別月次損益表 | corporation_monthly_pl | 経理月次P/L | finance_monthly_corporate_pl read model | Available | 承認済み法人月次rowをread-only取得 | 翌月15日前後 | Medium | live row completenessは今回未接続 |
| 店舗別利益 | store_profit | 店舗別月次P/L | local store candidateにprofit/ordinary profit候補 | Unknown | 利益種別を承認後にstore_idで取得 | 翌月15日前後 | Low | 経常/営業/貢献利益のどれか |
| 店舗別利益率 | store_profit_rate | 店舗売上＋店舗利益 | 候補CSVに売上・profit列 | Derivable | approved store profit / approved store sales | 翌月15日前後 | Low | 利益種別と分母売上 |
| 利益予算 | approved_profit_budget | 承認予算 | store monthly budget CSVにprofit_plan任意列 | Unknown | 承認versionをas-of選択 | 月次 | Low | 正式予算file・承認workflow |
| 前年同月利益 | prior_year_same_month_profit | 店舗月次P/L | 複数月P/L parser | Derivable | 前年同月の同一利益定義versionを取得 | 月次 | Low | store P/L履歴・比較可能店 |
| 年間累計利益 | profit_ytd | 店舗月次P/L | 複数月P/L parser | Derivable | 年度開始から対象月までSUM | 月次 | Low | 店舗P/L実データ・欠損月 |
| 店舗直接費 | store_direct_cost | 店舗別月次P/L | 標準科目としての定義・mappingなし | Unknown | 承認科目集合をSUM | 月次 | Low | 含有費目 |
| 人件費 | store_labor_cost | 店舗別月次P/L | 法人/部署P/L列はあるが店舗粒度未確認 | Unknown | 店舗科目mapping後にSUM | 月次 | Low | 給与・法定福利・応援配賦 |
| 材料費 | store_material_cost | 店舗別月次P/L | 法人/部署P/L列はあるが店舗粒度未確認 | Unknown | 店舗科目mapping後にSUM | 月次 | Low | 技術材料/消耗品の範囲 |
| 商品原価 | retail_cost_of_goods | 店舗別月次P/L/商品原価補助簿 | 専用列・正式mappingなし | Unknown | 承認科目または補助簿からSUM | 月次 | Low | 材料費との分離 |
| 家賃 | store_rent | 店舗別月次P/L | P/L parser必須科目に地代家賃あり。店舗file未確認 | Unknown | 地代家賃mapping後に店舗SUM | 月次 | Medium-Low | 賃借料mapping・共通費配賦 |
| 水道光熱費 | store_utilities | 店舗補助残高 | UTILITY_SUBLEDGER contractのみ | Unknown | 店舗/月/科目で照合 | 月次 | Low | 実file・正本・店舗mapping |
| 広告費 | store_advertising_cost | 店舗別月次P/L | P/L parser必須科目に広告宣伝費あり。店舗file未確認 | Unknown | 広告宣伝費を店舗SUM | 月次 | Medium-Low | 本部施策配賦 |
| 決済手数料 | payment_processing_fee | 決済/P&L補助簿 | 専用contract・mappingなし | Unknown | 承認科目を店舗へ帰属 | 月次 | Low | 科目名・POS/決済照合 |
| 本部配賦 | head_office_allocation | 配賦rule＋法人P/L | FC rule contractはあるが本部配賦contractなし | Unknown | version付き配賦ruleで計算 | 月次 | Low | 配賦基準・対象費用・FC扱い |
| 減価償却 | depreciation | 店舗別月次P/L/固定資産 | 必須科目・専用mappingなし | Unknown | 店舗科目または固定資産台帳からSUM | 月次 | Low | 店舗帰属・共通資産 |
| 売上総利益 | corporation_gross_profit | 法人月次P/L | finance_monthly_corporate_pl.gross_profit_yen | Available | 法人月次rowを取得 | 翌月15日前後 | Medium | 店舗粒度は未確認 |
| 店舗貢献利益 | store_contribution_profit | 店舗売上－店舗変動費 | 定義・保存列・配賦ruleなし | Unavailable | Business Contractと変動費分類が必要 | 月次 | High | 正式定義がない |
| 店舗営業利益 | store_operating_profit | 店舗別月次P/L | 店舗候補P/Lはあるが正式file/mappingなし | Unknown | 店舗営業損益科目を取得 | 翌月15日前後 | Low | 店舗P/L粒度・本部配賦 |
| 法人営業利益 | corporation_operating_profit | 法人月次P/L | finance_monthly_corporate_pl.operating_profit_yen | Available | 法人月次rowを取得 | 翌月15日前後 | Medium | live completeness |
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
| 総リピート率 | total_repeat_rate | 来店区分aggregate | repeat/visit cohort local CSVから候補式あり | Derivable | (2回目+3回目+固定)/総来店数の暫定式 | 月次 | Medium-Low | 既存正式期間・準固定の扱い |
| 新規リピート率 | new_customer_repeat_rate | 新規cohortの次回来店 | 顧客ID・cohort履歴なし | Unavailable | 新規cohort visit historyが必要 | cohort月次 | High | 判定期間 |
| 再来リピート率 | returning_customer_repeat_rate | 再来cohortの次回来店 | 顧客ID・cohort履歴なし | Unavailable | 再来cohort visit historyが必要 | cohort月次 | High | 母集団・期間 |
| 固定リピート率 | fixed_customer_repeat_rate | 固定cohortの次回来店 | 顧客ID・cohort履歴なし | Unavailable | 固定cohort visit historyが必要 | cohort月次 | High | 固定定義・期間 |
| 総単価 | average_spend | 総売上＋総客数 | 月次sales/customer CSV contract | Derivable | 総売上÷総客数。0分母はNULL | 月次 | Medium-Low | 既存定義との一致・税込基準 |
| 技術単価 | technical_average_spend | 技術売上＋技術客数 | 月次sales/visit cohort CSV contract | Derivable | 技術売上÷技術客数。0分母はNULL | 月次 | Medium-Low | 既存定義との一致 |
| 店販単価 | retail_average_spend | 店販売上＋店販購入客数 | 店販購入客数なし | Unavailable | 購入客数sourceが必要 | 月次 | High | 総客数を分母にする別定義との区別 |
| 在籍社員数 | resident_headcount | Core employee/assignment | employeesとmonthly workforce CSV contract | Available | as-of在籍ruleでCOUNT DISTINCT | 月次 | Medium | NULL corporation/storeとinactive assignment品質 |
| 月平均社員数 | average_monthly_headcount | 入退社日＋配属期間 | joined_on/retired_on/assignment history | Derivable | 各営業日の在籍人数平均 | 月次 | Medium-Low | 休職・応援・月中異動の扱い |
| 勤務時間 | actual_labor_hours | 勤怠原本 | 店舗営業用勤怠factなし | Unavailable | 確定勤怠sourceが必要 | 月次 | High | 実労働・休憩・残業 |
| 所定労働時間 | standard_labor_hours | 雇用契約/勤務制度 | 標準時間masterなし | Unavailable | 契約別標準時間が必要 | 月次 | High | 月/人別基準 |
| 時短勤務 | short_time_work | 雇用契約/勤務制度 | 明示fieldを確認できず | Unknown | 契約またはscheduleから判定 | 随時 | Low | 保存先・有効期間 |
| 休職 | leave_period | 社員master | leave_start_date/leave_end_date | Available | 対象月との期間overlap | 随時 | Medium | データ完全性 |
| 月中入社 | mid_month_join | 社員master | joined_on | Available | 対象月内の日付で判定 | 月次 | Medium | 予定日と実入社日の区別 |
| 月中退職 | mid_month_retirement | 社員master | retired_on | Available | 対象月内の日付で判定 | 月次 | Medium | 最終勤務日との区別 |
| 月中異動 | mid_month_transfer | assignment history | employee_assignment_histories effective dates | Derivable | 対象月内のstore変更を抽出 | 月次 | Medium-Low | 履歴完全性 |
| 兼務 | concurrent_assignment | store assignments | employee_store_assignmentsの複数有効row | Derivable | 期間overlapとassignment typeで判定 | 月次 | Medium-Low | 按分rule |
| 応援勤務 | support_assignment | store assignments/勤怠 | support type候補はあるが実勤務時間なし | Derivable | assignment存在までは判定、FTE按分は不可 | 月次 | Low | 実勤務日/時間 |
| FTE | fte | 実労働時間＋標準労働時間 | 双方のcanonical月次dataなし | Unavailable | 実労働時間÷標準労働時間 | 月次 | High | 時短・休職・応援・按分 |
| 総生産性 | total_productivity_fte | 総売上＋FTE | FTE不可 | Unavailable | 税込総売上÷FTE | 月次 | High | FTEとEC按分 |
| 技術生産性 | technical_productivity_fte | 技術売上＋FTE | FTE不可 | Unavailable | 税込技術売上÷FTE | 月次 | High | FTE帰属 |
| store_id | store_id | Core Store | public.stores.id | Available | Core Read Adapterで取得 | 随時 | High | なし |
| corporation_id | corporation_id | Core Corporation | public.stores.corporation_id/public.corporations.id | Available | Core Read Adapterで取得 | 随時 | High | NULL/不整合品質 |
| 店舗名 | store_name | Core Store | public.stores.store_name | Available | store_idに紐づけ表示 | 随時 | High | 改名履歴 |
| 直営・FC | store_ownership_type | Core Store | stores.store_type列候補。値・正式判定未確認 | Unknown | ownership ruleで分類 | 随時 | Low | 所有/運営/集計法人 |
| 営業中・閉店 | store_active_status | Core Store | public.stores.is_active | Available | is_activeで現状態。過去はeffective historyが必要 | 随時 | Medium-High | 閉店日・休業区分 |
| エリア | area_id | Area master/assignment | stores.area文字列候補のみ | Unknown | 構造化area IDへmapping | 随時 | Low | area master・有効期間 |
| 担当営業 | sales_owner_employee_id | 担当関係 | 明示的relationshipなし | Unavailable | effective-dated owner assignmentが必要 | 随時 | High | roleと担当scope |
| FCオーナー | fc_owner_principal_id | FC ownership relation | roleは候補だがstore relationなし | Unavailable | principal-store-corporation relationが必要 | 随時 | High | employee/外部principal |
| 月中の所属変更 | assignment_change_in_month | assignment history | employee_assignment_histories | Derivable | effective datesを対象月で差分抽出 | 月次 | Medium-Low | 履歴欠損・inactive assignment |
| 対象月 | target_month | source period | 各monthly CSV/P&Lにperiod/monthあり | Available | YYYY-MMへ正規化 | 月次 | High | 営業月境界 |
| 入力済み店舗数 | submitted_store_count | import batch＋expected stores | local validator row receipts。永続batchなし | Derivable | valid unique store_idをCOUNT | 取込時 | Medium-Low | 名称matchingをCore IDへ置換 |
| 未入力店舗数 | missing_store_count | active store set＋batch | active storesとlocal rows | Derivable | expected active store_id MINUS submitted | 取込時 | Medium-Low | 対象20店舗の正式集合 |
| 検証済み店舗数 | validated_store_count | validation result | local validatorsのvalid rows | Derivable | 全required datasetを通過したstore_idをCOUNT | 検証時 | Medium-Low | required dataset集合 |
| エラー店舗数 | error_store_count | validation result | validator error categoriesあり | Derivable | validation時にstore_id付きerror resultを保持してCOUNT | 検証時 | Medium-Low | 現状receiptはerror時rowsを捨てるため直接取得不可 |
| 最終更新日時 | last_updated_at | persistent import/audit | finance source documentsにimported_at、店舗local receiptにはtimestampなし | Unknown | dataset別MAX(imported_at) | 随時 | Low | 店舗売上の永続batch |
| 速報 | flash_status | record state | 店舗売上のpersistent stateなし | Unavailable | state machineが必要 | 随時 | High | 速報条件 |
| 暫定 | provisional_status | record state | 店舗売上のpersistent stateなし | Unavailable | state machineが必要 | 随時 | High | 速報との差 |
| 検証済み | validated_status | validation result | local validator categories | Derivable | required validationsの合格を集約 | 検証時 | Medium | 永続化と承認分離 |
| 確定 | confirmed_status | 経理/営業承認 | 法人financeにlatestClosedMonth候補、店舗状態なし | Unknown | 承認versionを参照 | 月次 | Low | store close/承認source |
| 締め済み | closed_status | monthly close record | 店舗close tableなし | Unknown | store×period close recordが必要 | 月次 | Low | close owner・再open |
| 再修正 | revised_status | correction version | local correction contractのみ。永続versionなし | Unavailable | correction lineageと新versionが必要 | 随時 | High | 承認・再締め |
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
| 店舗状態 | store_performance_state | 承認済みmetric snapshot | 現行placeholder warningのみ。正式分類ruleなし | Derivable | version付きthresholdで好調/安定/改善中/要対応を分類 | 月次 | Low | 指標、weight、threshold、利益確定前挙動 |

## Counts

Available 13 / Derivable 25 / Unavailable 23 / Unknown 32
