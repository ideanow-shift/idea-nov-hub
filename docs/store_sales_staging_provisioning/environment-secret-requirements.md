# Store Sales Staging Environment Secret Requirements

## Decision

**Required GitHub Environment Secrets now: 0**

The current Store Sales API source candidate has no runtime environment-variable read, and the current `store-sales-staging` workflow contains no Supabase deploy step. There is therefore no Secret that can be truthfully identified as required for the present code path.

Registering a guessed database credential, session secret, access token, or project value now would create an unmanaged secret without a consuming implementation. It is prohibited by this inventory.

## Verified current consumers

| Consumer | Environment Secret read | Current result |
| --- | --- | --- |
| `supabase/functions/store-sales-staging-api/` | none | no runtime Secret is defined or consumed |
| `.github/workflows/store-sales-staging-deploy.yml` | none | dry-run only; does not call Supabase deploy |
| `.github/workflows/store-sales-staging-check.yml` | none | quality checks and approval boundary only |
| GitHub Environment `store-sales-staging` | no listed Secret names | no Secret is registered |

## Deferred candidates, not registration instructions

The following names appeared in earlier architecture material. They are **not required today** because their exact transport and consuming adapter have not been approved or implemented.

| Candidate name | Potential source | Why it is not registerable yet | Required decision first |
| --- | --- | --- | --- |
| `STAGING_SESSION_VERIFIER_SECRET` | manual generation by HUB Security Owner, only for an approved symmetric verifier | verifier algorithm and runtime adapter are absent; asymmetric verification may not need this secret | HUB verifier architecture and issuer/audience contract |
| `STAGING_STORE_MASTER_ACCESS` | Core DB Owner, only after an approved non-Production read-only port exists | port credential type, endpoint identity, and consuming adapter are absent | Store Master Staging replica / port contract |
| `STAGING_ACCOUNTING_ACCESS` | Accounting Owner, only after an approved non-Production read-only port exists | port credential type, endpoint identity, and consuming adapter are absent | Accounting Projection Staging port contract |
| Supabase deployment credential | Supabase access-control owner, only if a reviewed CI deploy workflow needs one | the present workflow has no deploy command; no credential is needed | immutable deployment workflow and least-privilege token design |

## Registration target after a future approval

Runtime credentials belong in the Supabase Sandbox Function secret store, not in browser code. A GitHub Environment Secret is permitted only where a reviewed GitHub Actions deploy workflow demonstrably consumes it. Project identity, endpoint URL, audience, and approval markers are protected configuration values, not Secrets, and must still be approved separately.

## Verification rule

Before any registration, the implementation owner must show all of the following without displaying a value:

1. the exact runtime consumer and exact environment-variable name;
2. the approved non-Production source identity and read-only scope;
3. the Secret creator, expiry, rotation, and revocation owner;
4. a test proving the function fails closed when the value is absent;
5. a scan proving no browser, committed file, log, or report can expose the value.

