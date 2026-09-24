# Implementation Scope

## In scope

| Component | Sandbox implementation |
|---|---|
| Handoff verifier | 必須claim、署名、issuer、audience、iat/exp、nonce、jti、app、UID/employee整合 |
| Code exchange | 60秒既定、opaque code、Mapからdelete-firstで一回消費 |
| App session | `__Host-` Cookie contract、idle/absolute timeout、app isolation、revoke、状態再確認 |
| Actor resolver | employee、terminal、serviceの分離と状態・role・scope解決 |
| Authorization | default denyの六軸判定、request actor/store差替え拒否 |
| Core Read Adapter | 7 read operationのfixture projection |
| Audit | allow/deny共通event、許可フィールドのみ出力 |
| Fixture/tests | 実在値を含まない固定UUID・`.test` UID・架空組織 |

## Out of scope

- 店舗営業管理の画面、売上、Snapshot、KPI、締め等の業務機能
- Supabase/Firebase/production network、production Secret、service role
- DB、migration、RLS、GRANT、SECURITY DEFINER、Edge Function
- 本番鍵管理、分散store、永続audit、production deploy

コードは`sandbox/auth-foundation/`に隔離し、既存productionコードからimportしない。外部packageを追加せずNode.js標準moduleのみ使用する。
