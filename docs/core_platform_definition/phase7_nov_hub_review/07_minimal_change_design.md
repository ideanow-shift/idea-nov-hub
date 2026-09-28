# Minimal Change Design

## 原則

既存ログイン、bootstrap、カード表示、legacy `openApp`を変更対象の中心にしません。アプリ起動直前に一つの分岐を追加します。

```text
card click
  -> flag(app_id) OFF -> existing launch path
  -> flag(app_id) ON
       -> server resolves actor again
       -> authorize app:launch
       -> issue opaque one-time code
       -> target backend exchanges atomically
       -> app-scoped HttpOnly session cookie
       -> Core Read Adapter / evaluator / audit
```

## 新しい境界

- `HandoffIssuer`: app、issuer、audience、nonce、jti、expiryをbinding。
- `OneTimeCodeStore`: TTL、atomic consume、revoke。
- `CoreActorResolver`: UID canonical、duplicate/unresolved/default deny。
- `AuthorizationEvaluator`: role × scope × action × sensitivity × record state × principal type。
- `AppSessionIssuer`: Secure、HttpOnly、SameSite、app固有cookie。
- `AuditSink`: allow/deny/replay/scope violation。高感度時の保存失敗はfail closed。

## Compatibility

flag OFFでは生成URL、tab動作、storage、既存APIを完全に維持します。flag ONでもカードsourceは変えず、対象appのlaunch adapterだけを差し替えます。
