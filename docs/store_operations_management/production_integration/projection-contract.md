# Projection Contract

Contract version: store-sales-projection-v1

ProjectionはDashboard、Store List、Store Detailを同じserver-resolved actor scopeで返す。

## Required domains

- 売上: 税込総売上、予算比、前年比、技術、商品、MID、EC配賦
- 利益: profit state、確定期間、店舗営業利益、営業利益率、経常利益
- 集客: 総客数、新規、既存、前年比
- 単価: 総単価、技術単価、前年比
- 商品: 店販売上、購買率、MID
- EC: 全社EC、目標比、前年比、稼働店舗数
- 推移: current/previous year、6か月、12か月
- 店舗: status、各KPI、担当AM、今月重点

値はavailable時だけ表示可能。collecting、preparing、unavailable、validation_errorではvalue/display valueをnullとする。欠損を0へ変換しない。

禁止consumer fields、重複store ID、優先順位不整合、scope逸脱、invalid periodをContract Errorとして拒否する。
