# Sprint 2 Contract Alignment

## Phase 2B判定

PASS。versionは `store-sales-projection-v1` のまま維持した。

- UIはRuntimeだけを参照し、DB、Accounting、KPIへ直接接続しない。
- Projection metadataへ安全な `actor_role` を追加し、Staging UIのRoleをserver-resolved identityに同期した。
- 必須period、metric data state、nullable value、scope key、重複ID、priority順を既存validatorで検証する。
- unknown fieldはv1 consumerで無視し、consumer禁止fieldは拒否する。
- non-available利益はvalue/display_valueともnullでなければvalidation errorとする。
- 実UUIDは表示せずSynthetic IDを内部キーとして使用する。

停止条件となるContract破壊は検出されなかった。
