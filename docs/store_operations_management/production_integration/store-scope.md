# Store Scope

| Role | Server-resolved scope |
|---|---|
| representative | 全店 / 直営 / FC |
| sales_manager | 直営13店舗 |
| area_manager | 担当店舗 |
| store_manager | 自店舗 |
| general employee | 403 |

DashboardとStore Detailの両方でscopeを検証する。Store ID改ざんは403、存在しないIDはscope確認後に404とする。

Contractはsales_manager ProjectionへのFC混入を拒否する。sales_manager/area_managerへFC店舗が含まれる場合、V1の利益フィールドはnullでなければならない。カード表示制御だけをPermission保証として扱わない。
