# Staging Secret and Protected Configuration Inventory

No value is generated, displayed, read, or registered by this sprint.

## Sensitive secrets: 3

| Name | Purpose | Creator / registration place | Readers | Lifetime / rotation / revocation |
| --- | --- | --- | --- | --- |
| `STAGING_SESSION_VERIFIER_SECRET` | validates the Staging HUB session verifier, when symmetric verification is selected | HUB Security Owner; Staging function secret store | function runtime only | 24 hours initial maximum; rotate before every production-like rehearsal; revoke by deleting/replacing secret and disabling function |
| `STAGING_STORE_MASTER_ACCESS` | least-privilege Store Master port credential or workload identity | Core DB Owner; Staging secret store | Store Sales function runtime only | 24 hours initial maximum; rotate per E2E window; revoke port identity |
| `STAGING_ACCOUNTING_ACCESS` | least-privilege Accounting Projection port credential or workload identity | Accounting Owner; Staging secret store | Store Sales function runtime only | 24 hours initial maximum; rotate per E2E window; revoke port identity |

## Protected configuration and approval entries: 4

| Name | Purpose | Registration place | Readers | Expiry / revocation |
| --- | --- | --- | --- | --- |
| `STAGING_PROJECT_REF` | project identity comparison, not a secret | protected environment variable | deploy workflow and deploy owner | changes only with new identity approval |
| `STAGING_API_URL` | Staging function target, not a secret | protected environment variable | runtime configuration and deploy owner | remove to disable route |
| `STAGING_SESSION_AUDIENCE` | fixed non-Production token audience | protected environment variable | verifier and deploy workflow | rotate with verifier contract |
| `STAGING_DEPLOY_APPROVAL` | one-time deployment approval marker | protected environment variable plus GitHub Environment approval | deploy workflow only | delete after the approved execution window |

GitHub Environment `store-sales-staging` currently has no listed secret names and no protection rule. Registration must happen only after project identity approval.
