# `store-sales-staging` Protection Specification

## Approved direction

The `store-sales-staging` GitHub Environment must require an explicit human approval. It must never be used by an automatic deployment trigger.

## Required settings for the repository administrator

| GitHub Environment setting | Required value | Why |
| --- | --- | --- |
| Environment | `store-sales-staging` | approved environment name |
| Required reviewers | one named Release Owner or Platform Owner | every deploy requires a human decision |
| Wait timer | 0 minutes | approval, not an arbitrary delay, is the control |
| Deployment branch policy | custom branch policy | prevent unrelated branches from using the environment |
| Permitted branch during this sprint | `feature/store-sales-api-staging` | isolates the reviewed Staging candidate; it is not a Production promotion rule |
| Production environment access | denied | avoids cross-environment deployment |

The named GitHub reviewer is deliberately not guessed in this repository. A repository administrator must select the actual accountable human in GitHub.

## Pre-deploy checklist

1. Confirm the candidate branch and immutable commit SHA.
2. Confirm snapshot manifest validation succeeds and its source is approved.
3. Confirm the verifier has a separately approved non-Production issuer and actor/scope resolver.
4. Confirm no runtime route reaches Production and no browser receives credentials.
5. Approve one deployment and one E2E execution window.

## Rejection conditions

Reject the deployment if any required reviewer, branch policy, Snapshot approval, canonical verifier binding, or fail-closed test is absent. No fallback deployment route is permitted.
