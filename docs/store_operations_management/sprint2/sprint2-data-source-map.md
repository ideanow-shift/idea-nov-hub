# Sprint 2 Data Source Map

```text
Store Operations UI
  -> Store Sales Runtime
  -> read-only Projection Adapter
  -> GET Store Sales API v1
  -> server Scope Resolver
  -> Synthetic Directory / published Accounting fixture / active KPI fixture
```

| Projection | Sprint 2 source |
|---|---|
| 店舗 | 公式表示名20件を持つSynthetic Directory |
| 売上 | Synthetic published sales projection |
| 利益 | Synthetic Accounting published state。未確定値はnull |
| 顧客/KPI | Synthetic active KPI projection |
| 状態/Action | 既存server projection rules |

`public.stores`、`core.stores`、実会計データには接続・変更していない。正式Staging Data Sourceは接続情報未確定のため未接続。
