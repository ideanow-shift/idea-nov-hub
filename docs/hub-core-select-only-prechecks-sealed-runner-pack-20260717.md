# HUB Core SELECT-only prechecks sealed runner pack 2026-07-17

## Scope

This source-only runner prepares two production catalog checks without executing them:

- LINE WORKS employee destination table/RPC/RLS boundary inventory
- Data Intake employee/store/corporation/audit catalog readiness inventory

The SQL reads catalog metadata only. It does not read employee rows, destination IDs, CSV contents, or business records.

## Runner

`tools/run_hub_core_select_only_prechecks_20260717.ps1`

Contracts:

- `line-works`
- `data-intake`

Default invocation is validation-only. Production execution requires all of the following:

1. `-Execute`
2. a fresh one-time approval marker in process environment
3. an explicitly supplied linked-project directory
4. exact production project-ref SHA match
5. exact Supabase CLI version
6. exact SQL SHA match
7. the existing static validator to pass

The runner captures CLI stdout/stderr in temporary files, returns only fixed booleans/counts, removes the temporary files, and never prints the project ref or raw CLI response.

## Fixed SQL identities

- LINE WORKS normalized SHA-256: `992E37261B93810C0C4B8F55D3FEF94A8BCF19E8ADEEDB9F5C2BA80432259F0E`
- Data Intake normalized SHA-256: `85E433A97A6CA24BF3048B9D82E6BBB8C57DB8C670606C1579F79DEA3CFBBBDF`

## Stop boundary

No production SELECT was run while creating this pack. Production DB mutation, DDL, RLS, RPC, GRANT, Secret, Edge deploy, notification, and frontend publish remain prohibited. Each production SELECT-only contract still requires fresh explicit approval.
