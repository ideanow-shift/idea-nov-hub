# Security Boundary

- GCP/Firebase project、Supabase organization/project、Secret、keys、usersをproductionと分離。
- production database export/cloneは禁止。
- production Firebase UID、email、employee/store/corporation IDをfixtureへ入れない。
- staging issuerはproduction audienceを発行できない。
- production verifierはstaging `iss`/`kid`を信用しない。
- service roleはEdge runtimeだけ。browser、GitHub artifact、logへ出さない。
- GitHub environment approval前はSecretをjobへ渡さない。
- egress allowlistをstaging Supabase/Firebaseだけに限定。
- canary CookieはSecure/HttpOnly/SameSite、app binding、idle/absolute timeout。
- auditはdenyを含めappend-only、Secret/token/email/UID生値なし。
- flagsはdefault deny。kill switchはcacheを迂回できる緊急経路を持つ。

最大リスクは、環境変数やauthorized domainの誤配線でstaging frontendがproduction Firebase/Supabaseへ接続することです。CIでproject ref、issuer、audience、hostnameのproduction denylistを必須検査します。
