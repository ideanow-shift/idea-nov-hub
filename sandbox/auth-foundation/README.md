# Auth Foundation Sandbox

Phase 5専用の、production非依存・メモリ内・synthetic data限定の参照実装です。

```powershell
node --test sandbox/auth-foundation/auth-foundation.test.mjs
```

- 外部network、環境変数、Firebase、Supabase、service role、DB、migrationを使用しない。
- `sandboxSigningKey`はテストが注入する架空値であり、本番Secretではない。
- HMACはverifier interfaceの検証用mock。本番署名方式や鍵管理を確定する実装ではない。
- opaque code、session、replay、idempotencyはプロセスメモリでのみ再現する。
