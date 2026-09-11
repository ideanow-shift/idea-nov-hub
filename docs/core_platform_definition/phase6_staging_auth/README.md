# Phase 6 Staging Auth

Phase 5 mockを本番に近い境界で検証した、production非依存のローカルstaging成果物。

## Results

- 75 checks: 72 success / 0 failure / 3 unverified
- Node: 61/61
- Browser: 11 pass / 3 unverified

## Code

`staging/auth-foundation/`にEd25519、atomic store、Core Adapter、audit persistence、browser server、concurrency/security testを分離配置した。

```powershell
node --test sandbox/auth-foundation/auth-foundation.test.mjs staging/auth-foundation/phase6-staging.test.mjs
node staging/auth-foundation/browser-session-server.mjs
```

本成果物はproduction接続、Firebase/Supabase変更、DB権限変更、外部deploy、店舗営業管理業務実装を含まない。
