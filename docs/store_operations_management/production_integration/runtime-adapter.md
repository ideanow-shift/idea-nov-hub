# Runtime Adapter

Store Operations RuntimeはUI唯一のデータ入口を維持する。UIはAdapter、Accounting、Core DBを直接参照しない。

| Environment | Adapter mode | Source |
|---|---|---|
| preview | mock | Synthetic fixture |
| integration | integration | Local Integration Fixture API |
| staging | staging | Approved HTTPS read-only API |
| production | production | Approved HTTPS Store Sales API |

RuntimeはHUB Sessionの有効性を確認し、Bearer tokenだけをAdapterへ渡す。Role、Store Scope、employee ID、store listはリクエストへ付加しない。API失敗時にSyntheticへfallbackしない。

ProductionはproductionReadOnlyEnabled=true、HTTPS endpoint、syntheticData=falseがすべて揃うまでfail closedする。現設定はfalseであり未接続。
