# Profit Data Inventory

## 粒度

- 法人月次: `finance_monthly_corporate_pl`のread modelがあり、gross/operating/ordinary profit、人件費、材料費、家賃等の列を確認。
- 部署月次: `finance_monthly_department_pl`にsales、labor、material、other cost、department profitを確認。
- 店舗月次: Yayoi/normalized P/L parserが店舗候補sheetを扱えるが、正式file、mapping、persistent tableを確認できない。

名称だけで利益を同一視しない。売上総利益、店舗貢献利益、店舗営業利益、法人営業利益を分離する。

| UI項目 | technical_key | 必要原本 | 現在の取得元 | 判定 | 加工方法 | 更新頻度 | 信頼度 | 未確定事項 |
|---|---|---|---|---|---|---|---|---|
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

## 表示状態

- 法人P/L rowあり: 確定値候補
- 翌月15日前で未確定: 集計中
- 店舗P/L source/mapping未整備: 準備中
- 欠損を0円として表示しない。
