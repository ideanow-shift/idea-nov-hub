# Test Plan

## Regression

- Firebase Google、email/PIN、logout。
- app cardの表示順、filter、URL、same/new tab。
- flag OFFの全13 appが現行経路と一致。

## Handoff / Session

- missing/invalid signature、issuer、audience、expiry、iat、nonce、jti、app。
- unknown `kid`、wrong alg、rotation grace。
- code TTL、一回consume、同時100交換、revoke、app binding。
- HttpOnly、Secure、SameSite、CSRF、Origin。
- URL、history、referrer、localStorageにtokenが残らない。

## Actor / Authorization

- unknown/duplicate UID、inactive、retired、login disabled。
- request actor/store差し替え。
- roleなし、他店舗、他法人、closed record。
- terminal→employee、service→user昇格拒否。
- revoked role/assignment、stale cache、adapter timeout。

## Audit / Failure

- allow/deny/replay/actor mismatch/scope violation。
- request/correlation ID、masking、tamper検出。
- 高感度操作のaudit failureはfail closed。
- flag OFF rollbackと発行済みsession revoke。

Phase 5の40件とPhase 6追加testを維持し、NOV HUB固有のcard/launch regressionを追加します。
