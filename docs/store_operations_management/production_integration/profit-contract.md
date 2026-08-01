# Profit Contract

代表承認済みD01〜D05をProjection境界で固定する。

| Decision | Contract |
|---|---|
| D01 | profit_definition=store_operating_profit |
| D02 | operating_margin_definition=operating_profit_over_sales_net |
| D03 | 未確定利益はvalue/display valueともnull |
| D04 | head_office_allocation_included=false |
| D05 | 営業部RoleのFC利益は非表示 |

Required metadata:

- profit_state
- confirmed_through_period
- profit_definition
- operating_margin_definition
- head_office_allocation_included

profit_state=confirmedではconfirmed_through_period必須。未確定時にoperating profit、margin、ordinary profitがavailableまたは0円ならContract Errorとする。
