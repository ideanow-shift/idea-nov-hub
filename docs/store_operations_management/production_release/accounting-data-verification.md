# Accounting Data Verification

## 判定

BLOCKED。

営業利益、営業利益率、経常利益の正式確定値Sourceと\`confirmed_through_period\`をProductionでread-only取得できる証跡がない。

実金額の取得・ログ出力・成果物記載は行っていない。未確定値を0円、仮利益、推計利益、予想利益として扱っていない。

再開にはAccounting Owner承認済みのtable/view/API、period key、確定状態、freshness、actor scope、read grantが必要。
