# RLS and Grant Impact

## Policy Domains

| Domain | Allowed server behavior | Denied behavior |
|---|---|---|
| Accounting command lifecycle | Accounting actor may issue fixed upload/dry-run/validate/import/review/publish commands. | Browser table writes, arbitrary SQL/RPC, self-granted publication state. |
| Rollback approval | Accounting and Representative create distinct append-only approvals. | One actor satisfying both roles, automatic rollback, approval update/delete. |
| Core Master scope | Server reads active `public.stores`, effective assignments, and approved crosswalk. | Client-selected role/store scope, assignment/crosswalk UI mutation. |
| Published projection | Representative/Accounting 20, Sales Director direct 13, AM effective assignments, Store Manager own store. | Draft/unconfirmed facts, unassigned AM, General Employee access. |

## Grant Principles

- Browser principals receive no direct lifecycle-table access.
- No `BYPASSRLS`, browser `service_role`, inherited broad owner role, or anonymous write.
- The future import writer and projection reader must be separate least-privilege server principals where the platform supports it.
- Every RLS predicate derives actor, role, and scope from the canonical HUB server-side session resolver.

No RLS or grant statement is created in this audit. Existing production/staging policy state is unknown until catalog attestation.
