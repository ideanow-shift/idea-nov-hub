# Handoff Gap Analysis

| Contract | 現在 | Phase 6目標 | Gap |
|---|---|---|---|
| handoff artifact | IDEA LINKのみopaque code | 全flag対象app | 共通issuer interfaceなし |
| TTL / one-time | 60秒、条件付きconsume | 分散atomic | adapter・競合証跡が不足 |
| signature | HUB/app session HS256 | EdDSA/ES256 | `kid`、rotation、alg固定なし |
| app binding | IDEA LINK audience | 全app | registryとのbindingが必要 |
| session | JS bearer | HttpOnly Cookie | backend exchange endpointが必要 |
| actor | employee ID / email / UID | UID canonical、default deny | 解決順とduplicate deny |
| authorization | app visibility中心 | role×scope×action×… | evaluator未接続 |
| audit | access log | durable structured audit | deny/replay/fail-closed不足 |
| rollback | IDEA LINK固有 | app単位即時legacy復帰 | feature flag未確認 |

IDEA LINKのコード生成、hash保存、expiry、audience binding、未consume条件付きPATCHは再利用価値があります。ただし既存IDEA LINK経路を直接改造せず、共通interfaceのreferenceとして扱います。
