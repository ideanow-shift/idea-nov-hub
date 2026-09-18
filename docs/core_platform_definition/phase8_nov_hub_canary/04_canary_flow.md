# Canary Flow

```text
synthetic HUB session
  -> flags / allowlist / kill switch
  -> app + actor + redirect validation
  -> 256-bit opaque code (TTL 60 seconds)
  -> code hash lookup and destructive consume
  -> app / audience / redirect / CSRF validation
  -> synthetic actor re-resolution
  -> app-scoped session
  -> HttpOnly; Secure; SameSite=Lax Cookie contract
  -> safe diagnostic result + audit
```

URLへ出せるのはopaque codeだけです。token、Firebase token、employee ID、email、実store/corporation、role detailはpayload・画面・auditへ出しません。診断画面はqueryを直ちに除去します。

issuer、exchange、sessionはinterface境界で分離され、将来memory adapterをstaging resourceへ置換できます。
