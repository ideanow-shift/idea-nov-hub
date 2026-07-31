# Sprint 2 Runtime Adapter

## Phase 2C判定

PASS（Local Integration Fixture）。

- preview/mock: localhost Mock Adapter
- integration: version付きread-only Projection Adapter
- staging: 同じAdapterをstagingEndpointへ接続
- production: blocked
- Feature Flag未指定: production扱いとなり接続拒否

AdapterはGET、Bearer session、`X-Contract-Version`、no-store、timeoutだけを使用する。INSERT、UPDATE、DELETE、UPSERT、RPC、DB clientは存在しない。HTTP/errorをRuntimeのempty、unauthorized、forbidden、validation_error、timeout、offline、maintenanceへ変換する。
