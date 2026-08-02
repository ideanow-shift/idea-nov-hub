# Metric Mapping

The fixture-only allowlist maps `技術売上高`, `商品売上高`, `ECサイト商品売上高`,
`売上高合計`, `売上原価`, `売上総損益金額`, `販売管理費計`, and `営業損益金額` to
bounded metric codes. The four consumer metrics are monthly sales, monthly profit,
monthly EC sales, and monthly product sales. Missing, duplicate, or unknown account
labels fail closed. FC `monthly_profit` is emitted as `null` with `unavailable`.
