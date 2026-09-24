# Staging Secret and Protected Configuration Inventory

No value is generated, displayed, read, or registered by this sprint.

## Required secrets now: 0

The current source candidate and workflows consume no Environment Secret. The previously proposed three names are deferred architecture candidates, not secrets that may be registered before their port/verifier contracts and runtime consumers are approved. See `environment-secret-requirements.md` for the evidence.

## Protected configuration and approval entries: 4

| Name | Purpose | Registration place | Readers | Expiry / revocation |
| --- | --- | --- | --- | --- |
| `STAGING_PROJECT_REF` | project identity comparison, not a secret | protected environment variable | deploy workflow and deploy owner | changes only with new identity approval |
| `STAGING_API_URL` | Staging function target, not a secret | protected environment variable | runtime configuration and deploy owner | remove to disable route |
| `STAGING_SESSION_AUDIENCE` | fixed non-Production token audience | protected environment variable | verifier and deploy workflow | rotate with verifier contract |
| `STAGING_DEPLOY_APPROVAL` | one-time deployment approval marker | protected environment variable plus GitHub Environment approval | deploy workflow only | delete after the approved execution window |

GitHub Environment `store-sales-staging` currently has no listed secret names and no protection rule. Registration must happen only after the exact runtime consumer and data-port/verifier contracts are approved.
