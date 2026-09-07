# Phase 4 Summary

基準日: 2026-07-28。システムポートフォリオ31件、Core Platform Definition、Phase 3ライブ検証、既存Edge/HUB実装を統合した設計標準である。実装・DB・権限・Secret・deploy変更は行っていない。

## 結論

- 最大リスク: service roleがRLSを迂回し、広いGRANTと84件のSECURITY DEFINER実行権限を持つ一方、APIごとのactor/scope品質が一様でない。
- 目標: `Firebase/HUB principal → one-time handoff → app session → Core actor resolution → role×scope×action×sensitivity×state → API/RPC → audit`。
- 採用: NOV HUBを唯一の社員入口、Firebase Auth、署名済みHUB session、Shiftのserver-side actor/scope、Expense/HRのpayload actor拒否を標準化候補とする。
- 移行: PIN、店舗共有credential、query token、shared API token、GAS/Google session、アプリ独自sessionを一括廃止せずwrap→shadow→cutover→retireする。
- Blocker: active 184人のUID欠損、active 104人のemail系欠損、terminal principal未決定、handoff issuer/audience/失効基盤、共通permission registry、audit retention、service role remediation優先順位。

## Phase 3優先ルール

ポートフォリオの「ライブ未確認」に対し、Phase 3でRLS/Policy/GRANT、SECURITY DEFINER 98件、Storage 3 bucket、ACTIVE Edge 21件を確認済み。これらはPhase 3を優先する。Firebase Console、勤怠/GAS/別repoの本番commit、31システム全ての実セッションは未確認のまま。

## Gate

Phase 4設計標準: **Conditional Go**。新規アプリの認証・認可foundation実装準備は可能。店舗営業管理Phase 0は共通verifier/adapter/auditのsandbox実装に限りConditional Go、業務機能・本番writeはNo-Go。
