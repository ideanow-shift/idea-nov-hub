# Sandbox Reuse Readiness

## Final determination

# Reuse possible

`idea-nov-shift-status-sandbox` can be reused as the future Store Operations-only Staging project because the verified management-plane inventory shows no deployed Functions and no registered Secret names to inherit. This is a project reuse decision, not permission to activate or deploy it.

## Why reuse is possible

| Requirement | Evidence | Readiness |
| --- | --- | --- |
| Production separation | Sandbox is a separate project identity from the active Core candidate in the management inventory | possible, but identity and routes must be attested during reactivation |
| Store Operations dedicated workload | no deployed Functions exist | clean Function namespace available |
| Store Sales validation only | no Store Sales endpoint exists today | no legacy endpoint needs coexistence or replacement |
| Secret isolation | 0 registered Secret names | clean secret namespace available |
| Read-only design | Store Sales API source contract is server-side and read-only by design | source-ready, not provisioned |
| Synthetic runtime exclusion | source review proves the legacy Staging runtime is synthetic-only | safe only when that runtime is not deployed |

## Required gates before use

Reuse remains unavailable for runtime traffic until all six items are complete in separate approved work:

1. Sandbox reactivation with named Platform and rollback owners.
2. Catalog-only database inventory for tables, RLS, policies, RPCs, grants, and extensions.
3. Explicit non-Production identity and outbound-route attestation.
4. Creation of new least-privilege read-only Store Master and Accounting ports; no credential reuse.
5. Protected GitHub `store-sales-staging` environment with deployment reviewer and branch policy.
6. One approved deploy/E2E window with Production URLs, credentials, and synthetic fallback rejected.

## Deny-by-default during the gap

Before these gates, the Sandbox must remain inactive, no endpoint may be treated as Store Sales, and Store Operations must continue to show an unconnected/preparing state. No fallback may use the active Core project, Production, mock data, or the synthetic legacy runtime.

