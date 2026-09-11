# Asymmetric Key Validation

| Item | Result | Evidence |
|---|---|---|
| EdDSA | Pass | Node `ed25519`生成・署名・検証 |
| issuer only private key | Pass | private keyなしissuer生成拒否 |
| app public key verification | Pass | public keyだけをtrust |
| `kid` | Pass | header選択 |
| rotation | Pass | new key即時検証 |
| old key grace | Pass | grace内許可 |
| old key expiry | Pass | `key_grace_expired` |
| unknown key | Pass | `unknown_kid` |
| fixed algorithm | Pass | `EdDSA`固定 |
| algorithm confusion | Pass | `HS256`改変を`algorithm_denied` |
| app audience | Pass | wrong appを`invalid_audience` |

鍵materialはGit、fixture、logへ保存していない。本番JWKS配信、HSM/KMS、rotation owner、緊急revoke、cache max-ageは未実装Blocker。
