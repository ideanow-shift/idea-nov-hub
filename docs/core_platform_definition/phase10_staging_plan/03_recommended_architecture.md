# Recommended Architecture

## 案A

- HUB URL候補: `https://idea-nov-os-stg.web.app/`
- Canary endpoint候補: `https://<staging-ref>.supabase.co/functions/v1/hub-context-test`
- Hosting: Firebase Hosting staging site。初期はprovider subdomainでDNS変更不要。
- Firebase: `idea-nov-os-stg`候補、Spark、Google sign-in、synthetic usersのみ。
- Supabase: `idea-nov-os-stg`候補、Free PoCまたはPro継続運用。
- Schema: `staging_core`, `staging_auth`, `staging_audit`。`public`への業務table複製は禁止。
- Edge: issuer、exchange、session、logout、healthをcanary専用functionに限定。
- One-time store: Postgres function内のatomic `DELETE ... RETURNING`または状態付きrow lock、TTL index。
- Audit: append-only table、token/PIIなし、hash chain候補。
- Cookie: `__Secure-nov_canary_session`、Secure、HttpOnly、SameSite=Lax、canary path。serverでもapp/audience binding。
- Flags: server-side global/environment/app/allowlist/kill switch、production値を参照しない。
- Secrets: Supabase project secrets + GitHub `staging-canary` environment、値の重複禁止。
- Key rotation: active/previous `kid`、private key issuer限定、grace後破棄。
- Branch: `docs/core-platform-definition`からPhase 11 branch、PR必須、main直接merge禁止。
- Approval: test → security review → environment approval → manual deploy。
- Owner: Executive sponsor、Platform owner、Security reviewer、Firebase owner、Supabase owner、rollback owner。

Supabase default domain上でEdgeがHTML frontendをhostする前提にはしません。診断UIはFirebase Hosting、session診断APIはEdge originで行います。
