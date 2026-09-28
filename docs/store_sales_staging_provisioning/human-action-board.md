# Human Action Board

| Step | Responsible owner | Where | Minimum input | Completion evidence |
| --- | --- | --- | --- | --- |
| 1. Select/create Staging project | Platform Owner + Security Owner | Supabase Dashboard / organization console | project name, region, Staging environment label | masked identity fingerprint, ACTIVE status, two-owner approval |
| 2. Approve project identity | Security Owner | approval record | masked ref fingerprint, environment, owner, rollback owner | exact Staging identity attestation |
| 3. Create read-only Store Master role/port | Core DB Owner | Staging database administration | allowlisted `public.stores` projection, read-only identity, expiry | grant review and negative write test; no BYPASSRLS |
| 4. Create read-only Accounting port | Accounting Owner | Accounting Staging service/DB administration | confirmed tax-exclusive projection contract, expiry | read-shape receipt and negative write test |
| 5. Bind HUB session verifier | HUB Security Owner | Staging function secret/config screen | issuer, audience, key reference | expiry and Production audience rejection receipt |
| 6. Protect GitHub Environment | DevOps Owner | GitHub Settings > Environments > `store-sales-staging` | required reviewers, branch policy, protected config/secret names | protection rule visible; values never exported |
| 7. Approve and execute one deploy/E2E window | Deploy Owner + Sales Owner | GitHub Actions / Staging observability | artifact SHA, bounded time window, test actor categories | deploy receipt, E2E report, rollback readiness |

No person should paste a connection URI, secret, token, raw UUID, or accounting amount into chat, source, workflow logs, or a report.
