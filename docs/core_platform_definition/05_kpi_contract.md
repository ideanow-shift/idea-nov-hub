# KPI Contract

すべて `Asia/Tokyo`、営業日境界、税区分、単位、丸め、source version、確定状態を記録する。以下はProposedであり、営業・経理の承認が必要。

| KPI | 計算式 | 粒度/期間 | 確定 | 調整 | 主source | 未確定 |
| --- | --- | --- | --- | --- | --- | --- |
| 総売上 | approved sales + tax rule - discounts - cancellations - returns | store/day/month | 月次close | 原取引参照の調整行 | 店舗売上原本 | 税込/税抜 |
| 技術売上 | 純売上のservice分類合計 | store/employee/period | 同上 | category再分類version | 店舗売上 | category owner |
| 店販売上 | 純売上のretail分類合計 | 同上 | 同上 | 同上 | 店舗売上 | セット按分 |
| 客数 | 重複排除済みvisit数 | store/day | 日次close | visit訂正 | POS/予約候補 | 匿名客 |
| 客単価 | 純売上 ÷ 客数 | store/period | source確定後 | 分母0はNULL | 上記 | 対象売上 |
| 生産性 | 純売上 ÷ 確定労働時間 | store/employee/period | 売上・勤怠双方close後 | 過月は新version | 売上+勤怠 | 採用分母 |
| 人件費率 | 確定人件費 ÷ 純売上 | store/period | 給与/配賦確定後 | 会計調整別保持 | 給与/会計+売上 | 含有費目 |
| 新規客数 | ルール上初回来店のcustomer数 | store/period | 月次close | 顧客統合version | 顧客/売上 | 初回範囲 |
| 新規来店率 | 新規客数 ÷ 客数 | store/period | 同上 | 分母0はNULL | 上記 | 匿名客 |
| 既存来店率 | 既存客数 ÷ 客数 | store/period | 同上 | 分母0はNULL | 上記 | 再来区分 |
| 指名比率 | 指名客数または指名売上 ÷ 対応分母 | store/employee | 月次close | 担当訂正 | 売上/予約 | 採用定義 |
| 店販比率 | 店販売上 ÷ 純売上 | store/period | 月次close | 同上 | 売上 | 分母 |
| 予算達成率 | 純売上 ÷ 承認予算version | store/period | 予算lock後 | 予算改定は新version | 売上+予算 | 改定規則 |
| 前年同月比 | 当月確定値 ÷ 比較可能な前年同月確定値 | same store/month | 月次close | 店舗改廃注記 | snapshot | 比較可能店 |
| 前月比 | 当月確定値 ÷ 前月確定値 | store/month | 月次close | 同上 | snapshot | 季節性 |
| 営業利益率 | 法人/店舗配賦後営業利益 ÷ 売上 | corp/store/month | 経理close | 経理側調整 | 法人経営 | 配賦 |
| 自己資本比率 | 自己資本 ÷ 総資産 | corporation/month | 経理close | 会計訂正version | B/S | 科目mapping |
| 現預金保有月数 | 現預金 ÷ 採用月次固定支出 | corporation/month | 経理close | 同上 | B/S/CF | 分母 |

## 生産性の判断事項

`技術売上÷在籍人数`、`技術売上÷稼働人数`、`総売上÷稼働人数`、`総売上÷FTE` は別KPIとして並記し、経営判断で主KPIを選ぶ。推奨主KPIは時間差を扱える `純売上÷確定労働時間`、補助KPIは `純売上÷FTE` である。

丸めは表示時のみ、計算途中は高精度、0除算は0ではなくNULL、訂正は上書きせずversionを上げる。
