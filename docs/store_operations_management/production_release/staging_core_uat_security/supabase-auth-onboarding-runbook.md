# Retired Store Operations Auth Onboarding Runbook

Store Operations-specific Supabase Auth onboarding is retired and must not be executed.

- Auth user creation: prohibited
- Email OTP / Magic Link delivery: prohibited
- Password or custom JWT: prohibited
- Store Operations login/callback route: prohibited
- Native Supabase access token as NOV HUB session: prohibited

UAT users enter through the normal NOV HUB login only. Cross-origin hosted UAT remains blocked until a separately approved, existing-pattern NOV HUB application-session handoff is available. No email delivery action or Auth mutation is part of the recovery procedure.

Previously created Staging-only Auth records are not authorization evidence for Store Operations. Any revoke or cleanup is a separately approved Staging operation; this change performs no Auth or database write.
