# Unit Price Inventory

| UI項目 | technical_key | 必要原本 | 現在の取得元 | 判定 | 加工方法 | 更新頻度 | 信頼度 | 未確定事項 |
|---|---|---|---|---|---|---|---|---|
| 総単価 | average_spend | 総売上＋総客数 | 月次sales/customer CSV contract | Derivable | 総売上÷総客数。0分母はNULL | 月次 | Medium-Low | 既存定義との一致・税込基準 |
| 技術単価 | technical_average_spend | 技術売上＋技術客数 | 月次sales/visit cohort CSV contract | Derivable | 技術売上÷技術客数。0分母はNULL | 月次 | Medium-Low | 既存定義との一致 |
| 店販単価 | retail_average_spend | 店販売上＋店販購入客数 | 店販購入客数なし | Unavailable | 購入客数sourceが必要 | 月次 | High | 総客数を分母にする別定義との区別 |

候補式は総単価=税込総売上÷総客数、技術単価=税込技術売上÷技術客数。既存業務定義の承認前に固定しない。分母0は0円ではなく算定不可とする。店販単価は店販購入客数がないためVersion1から除外する。
