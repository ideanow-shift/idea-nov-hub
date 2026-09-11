# Feature Flag and Rollback

## 必須flag

- global: `auth_handoff_v2_enabled=false`
- per app: allowlist、既定false
- per environment: productionは別承認
- synthetic/canary principal allowlist
- kill switch: issuerとexchangeを同時停止

現行sourceにこの共通flag contractは確認できないため、新規設計項目です。

## Rollout

1. local/staging、syntheticのみ。
2. `hub-context-test`だけON。
3. deny/audit/concurrency/browser testを完了。
4. read-onlyかつ低感度appを一つ追加。
5. 高感度・write appは別Gate。

## Rollback

flagをOFFにし、同じcard clickを既存launch関数へ戻します。DB rollbackやアプリ再deployを要求しない構成にします。発行済みcode/sessionはrevokeし、新issuerを停止します。legacy経路の削除は全app移行と観測期間の後に別承認とします。

## Owner未確定

flag owner、security incident owner、session revoke owner、audit on-call、production rollback ownerはDecision Itemです。
