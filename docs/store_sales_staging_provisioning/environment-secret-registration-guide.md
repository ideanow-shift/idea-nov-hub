# Store Sales Staging Human Secret Registration Guide

## Current instruction

**Do not register a GitHub or Supabase secret now.**

The verified required Secret count is zero. The current action is to preserve the empty `store-sales-staging` Environment until the runtime consumer and data-port contracts are approved.

## Future human procedure, only after the required approvals

| Step | Who performs it | Where | Input | Completion evidence |
| ---: | --- | --- | --- | --- |
| 1 | HUB Security Owner | architecture approval record | verifier method, issuer, audience, server-side actor source | signed verifier contract; no key value in the record |
| 2 | Core DB Owner | Staging access-port approval record | non-Production Store Master source and least-privilege read scope | approved port identity and revoke owner |
| 3 | Accounting Owner | Staging access-port approval record | non-Production Accounting projection source and confirmed-period scope | approved port identity and revoke owner |
| 4 | Security Owner | Supabase Sandbox Dashboard, Function Secrets | only the exact approved runtime Secret name and value | name appears in dashboard; value is not copied into tickets, chat, or GitHub |
| 5 | Repository Admin | GitHub repository Environment `store-sales-staging` | only a reviewed CI deploy credential, if the workflow consumes one | Environment shows the name only; reviewer and branch policy are enabled |
| 6 | Release Owner | CI quality run and approved E2E window | no secret input | fail-closed missing-secret test, deployment identity check, and sanitized run receipt pass |
| 7 | Secret owner | owner-controlled credential system | revoke / rotate on window close | old credential rejected; no value recorded |

## Hard rules

- Do not copy a Production secret, project token, database URI, or service role into Sandbox or GitHub.
- Do not create a Secret merely because a document lists a candidate name.
- Do not store runtime secrets in repository variables, workflow YAML, browser assets, `.env` examples with a value, tickets, chat, or reports.
- A GitHub Environment reviewer and deployment branch policy must be set before any workflow is permitted to deploy.
- Registration and deployment are separate approvals. Registering a Secret does not authorize a deploy.

## Current human action

No secret-registration operation is pending. The next required action is approval of the three runtime contracts: HUB Session verifier, Store Master read-only port, and Accounting read-only port.

