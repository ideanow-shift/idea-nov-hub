# Staging Environment Inventory

## Inventory method and boundary

Supabase management metadata and GitHub Environment metadata were inspected on 2026-08-01. No database connection, SQL, project secret value, deployment, or Production endpoint was used.

## Supabase project inventory

| Project label | Project ref | Status | Environment evidence | Decision |
| --- | --- | --- | --- | --- |
| `idea-nov-core` | masked (`nkmx…reyo`) | ACTIVE_HEALTHY | no Development/Staging/Production label in repository or management metadata | not selectable by inference |
| `idea-nov-shift-status-sandbox` | masked (`zgko…hrom`) | INACTIVE | name says sandbox; no approved Staging identity and not active | not usable as Staging |

No existing project can be certified as the Store Sales Staging target. The active Core project must not be assumed to be Staging or Production.

## Function and secret inventory

- existing Store Sales Staging function is a source candidate only; no deployed real-data endpoint was identified;
- existing local Staging runtime is synthetic-only and excluded from real-data activation;
- repository configuration contains a project reference but no environment label and no password;
- no environment variable named `STAGING_*`, `STORE_SALES_*`, or `SUPABASE_*` is configured in the local process;
- no Staging secret names were returned for GitHub Environment `store-sales-staging`.

## GitHub Environment inventory

| Environment | Protection rules | Branch policy | Suitability |
| --- | ---: | --- | --- |
| `github-pages` | 1 | custom branch policy | unrelated to Store Sales API |
| `store-sales-staging` | 0 | none | exists but needs approver protection and secret/config registration |

## Rollback target

No deployed real-data Staging endpoint exists. The rollback target is therefore **disabled endpoint / no runtime binding** until the first approved Staging deployment creates a versioned artifact.
