# Store Operations Staging Deployment Checklist

## Status

All deployment controls below are required before a Staging deploy. This checklist performs no operation.

| # | Required control | Owner | Evidence required | Current state |
| ---: | --- | --- | --- | --- |
| 1 | Confirm Sandbox project identity and non-Production routing | Platform Owner | approved masked identity profile and outbound-route review | pending |
| 2 | Approve a Staging-only Store Master replica or access port | Core DB Owner | least-privilege read-only contract; 20 / 13 / 7 validation | pending |
| 3 | Approve a Staging-only Accounting projection access port | Accounting Owner | confirmed operating-profit contract; null/unavailable rules | pending |
| 4 | Provision a server-side HUB Session verifier | HUB Security Owner | token verification, expiry rejection, role and Store Scope resolution | pending |
| 5 | Register new Sandbox-only runtime secrets | Security Owner | names, owners, expiry, rotation and revocation records; values never recorded | pending |
| 6 | Protect GitHub `store-sales-staging` | Repository Admin | required reviewer and deployment branch policy | pending |
| 7 | Build/deploy immutable Store Sales API artifact | Release Owner | source review, tests, function identity, no synthetic fallback | pending |
| 8 | Execute one approved E2E window | Platform, Core DB, Accounting, Security | request count, role result, 20-store proof, console result | pending |
| 9 | Record disabled-endpoint rollback | Release Owner | tested disable route and named rollback owner | pending |

## Non-negotiable deploy rejection conditions

- either data port resolves to Production;
- Store Master total is not exactly 20 or Direct / FC split is not 13 / 7;
- HUB Session verifier cannot resolve the server-side actor and scope;
- AM assignment is absent but access is granted;
- Accounting value is unconfirmed but rendered as a value;
- Function has a synthetic fallback or browser-held database credential;
- GitHub Environment has no deployment reviewer or branch policy.

## Expected E2E assertions after all gates

| Actor | Expected outcome |
| --- | --- |
| Representative | exactly 20 current stores |
| Sales Director | exactly 13 Direct stores |
| Area Manager without approved assignment | 403 / unassigned |
| Store Manager | own approved Store Scope only |
| General employee | 403 |
| FC profit | unavailable |
| unconfirmed accounting period | null / preparing |

