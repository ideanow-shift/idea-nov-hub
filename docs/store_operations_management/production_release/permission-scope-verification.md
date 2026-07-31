# Permission Scope Verification

## Source上の期待値

| Role | Scope |
|---|---|
| representative | 全店 / 直営 / FC |
| sales_manager | 直営13 |
| area_manager | 担当店舗 |
| store_manager | 自店舗 |
| general employee | カード非表示、直接URL 403 |

Preview/HUB統合のテストは存在するが、Production API境界でのsession検証、server-side scope解決、期限切れ、403は未接続のため未検証。

Mock IdentityはProduction adapterで拒否される設計を維持し、Production遮断は解除していない。UIだけのscope制御をProduction保証として扱わない。
