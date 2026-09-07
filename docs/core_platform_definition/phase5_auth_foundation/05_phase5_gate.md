# Phase 5 Gate

| Gate | Evidence | 判定 |
|---|---|---|
| handoff verifier実装可能か | 必須claim、署名、時刻、nonce/replay、app、identity整合を実装 | Go |
| actor resolver実装可能か | employee/terminal/service分離とfail-closed状態判定 | Go |
| authorization evaluator実装可能か | 六軸入力、主要role、越境・差替え・state deny | Go |
| negative testsが全件通るか | 40 tests、40 pass、0 fail | Go |
| production依存なしで検証できたか | Node標準module、synthetic fixture、network/Secret/DBなし | Go |
| 店舗営業管理Phase 0を継続できるか | auth foundationのsandbox検証に限定 | Conditional Go |

## 総合

**Conditional Go**

Phase 0で継続できるのは、共通verifier/resolver/evaluator/adapter/auditのsandbox hardeningと接続contract検証まで。売上画面・売上DB・KPI・業務機能、本番read/write、本番deployは別Gateが解除されるまでNo-Go。

## 残Blocker

1. Firebase UID欠損を含むlive Identity Mapping是正と一意性運用。
2. 非対称署名、鍵rotation、issuer運用、分散one-time store。
3. live Core Read AdapterとDB側scope二重防御。
4. service role/GRANT/SECURITY DEFINER remediation。
5. 永続監査、retention、monitoring、incident response。
6. sandbox/stagingでのbrowser、CSRF、concurrency、revocation、rollback検証。
