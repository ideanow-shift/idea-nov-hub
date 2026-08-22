# Security Findings

## 満たしたcontract

- flagはdefault deny、production deny、kill switch優先。
- codeは256-bit opaque、60秒、hash保存、一回consume。
- request actor、app、audience、redirect差し替えをdeny。
- synthetic actorを交換時に再解決。
- app sessionはapp間再利用不可、idle/absolute expiry、revoke可能。
- Cookie文字列はHttpOnly、Secure、SameSite=Lax、`__Host-` prefix。
- diagnostic UIは`textContent`を使い、queryを除去。
- auditにSecret、token、UID、email、role detailを入れない。

## 残るrisk

- memory storeは単一processであり、distributed atomicを証明しない。
- Cookieはcontract testのみで、HTTPS browser挙動は未検証。
- CSRFはboolean contractで、実Origin/CSRF token middlewareではない。
- auditはmemoryで永続化・tamper evidenceがない。
- issuerはsynthetic HUB session objectを受けるmockで、現行HUB bearer検証に未接続。
