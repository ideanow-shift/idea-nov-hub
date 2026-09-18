# Sales Data Inventory

## Evidence

- `financial-data-intake.js`にperiod/corporation/store/total_sales/technical_sales/product_sales/milbon_id_sales/ec_sales/profitのlocal CSV contractがある。
- MID/ECは根拠がなければ`NOT_IN_SOURCE`とし、product_salesへ加算しない現行安全境界がある。
- `store-monthly-budget-csv.js`に月次売上・利益予算のlocal contractがある。
- すべてbrowser local previewで、`productionImportEnabled: false`、mutation/upload 0。
- 正式売上source、実file、canonical保存先は確認できない。

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

## Confirmed business requirements impact

税込表示、MIDを総売上へ含める、通常店販とMIDを分離する、ECを担当店舗へ按分する要件は、現行contractだけでは満たせない。source列の意味とEC allocation tableを先に確定する。
