# Store Operations Sandbox Inventory

## Scope and non-change boundary

Target: existing inactive Sandbox project, referred to below only as `idea-nov-shift-status-sandbox`.

This inventory used management-plane metadata and repository source review on 2026-08-01. It did not create, reactivate, link, deploy, delete, alter, or connect to the project. No SQL was executed. Secret values were not requested, read, or recorded.

## Verified management-plane inventory

| Area | Verified fact | Evidence strength | Result |
| --- | --- | --- | --- |
| Project lifecycle | project is `INACTIVE` | Strong | cannot serve HTTPS traffic until a separately approved reactivation |
| Deployed Functions | `0` | Strong | no existing deployed Function to remove or inherit |
| Registered Secret names | `0` | Strong | no existing registered secret name to remove or rotate |
| Store Sales endpoint | absent | Strong | no deployed Store Sales API or synthetic runtime is inherited |
| GitHub environment | `store-sales-staging` exists but has no protection rule or branch policy | Medium | must be protected before deployment |

The Function and Secret inventories were obtained using the Supabase management CLI against the masked Sandbox project identity. The CLI response contained empty lists. Secret values were never returned by the command or included in this document.

## Database inventory boundary

| Requested inventory | Current evidence | Status |
| --- | --- | --- |
| Existing tables and views | no approved Sandbox read-only catalog port exists | **not verified** |
| RLS enabled state and policies | no approved Sandbox read-only catalog port exists | **not verified** |
| Database functions / RPCs | no approved Sandbox read-only catalog port exists | **not verified** |
| Existing database secrets or extensions | no approved Sandbox read-only catalog port exists | **not verified** |

`INACTIVE` is not evidence that a database is empty. These items must be checked through a separately approved least-privilege, catalog-only read after the project is reactivated. They must not be inferred from the absence of deployed Edge Functions or secrets.

## Repository candidates that must not be inherited

These are source files in the repository, not evidence of a deployed Sandbox workload.

| Source candidate | Reuse decision | Reason |
| --- | --- | --- |
| `supabase/functions/store-sales-projection/` | exclude | its environment contract requires synthetic data in Staging; it cannot be used for real-data validation |
| `supabase/functions/store-sales-staging-api/` | retain as source candidate only | separate read-only Store Sales contract; no deployment or binding exists |
| `supabase/functions/nov-hub-api/` and other application functions | exclude | unrelated application workloads; no Sandbox deployment evidence |
| local SQL and proposed migrations | exclude | source review material only; no migration is authorized for Sandbox reuse |

## Initial Store Operations target state

The future target is a dedicated Sandbox-only Store Sales API with server-side session verification and least-privilege read-only ports. It must not use Production credentials, browser-held service credentials, a synthetic fallback, or an unverified legacy function.

