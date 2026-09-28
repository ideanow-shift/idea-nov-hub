# One-Time Store Validation

## Adapter

`FileAtomicOneTimeStore`は、登録時のexclusive createをSET NX相当、code単位のatomic directory lockをtransaction boundary、active fileのatomic renameをconsumeとして使用する。

| Validation | Result |
|---|---|
| exclusive registration | Pass |
| TTL / expiry | Pass |
| atomic consume | Pass |
| second consume deny | Pass |
| issuer/app binding | Pass |
| revoke | Pass |
| same-process 100 concurrent exchange | 1 success / 99 denied |
| 12-process exchange | 1 success / 11 denied |
| stable deny reason | `code_invalid_or_consumed` |

Windowsでlock取得中の一時`EPERM`を競合としてretryする必要があることを初回testで発見し修正した。本番ではfilesystemを採用せず、Redis Lua/GETDELまたはtransactional DBで同じinterfaceを実装し、複数host・障害注入を再検証する。
