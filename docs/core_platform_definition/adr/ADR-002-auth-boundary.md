# ADR-002 Firebase AuthとSupabaseの認証境界

- Status: Proposed
- Date: 2026-07-28

## Proposed decision

Firebaseは本人認証、IDEA NOV OS Gatewayはemployee解決と業務認可、SupabaseはRLS/DB enforcementを担う。Firebase UIDを第一linkとし、email fallbackは移行限定。service roleはserver内に隔離し認可を迂回しない。

## Consequences

アプリ別の認証重複を減らせる。共通Gatewayの可用性とaudience管理が重要になる。ライブtoken検証方式とRLS/GRANT確認までは本番採用を確定しない。
