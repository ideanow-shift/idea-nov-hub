# Department to Store Mapping Options

## Design criteria

The future model must preserve department, role, position, and individual
assignment as separate concepts. It must support default deny, effective dates,
auditable approvals, independently controlled data and action scopes, and safe
reorganization without rewriting historic approvals.

## Option A: `department_store_assignments`

One effective-dated row binds a department to one store.

| Strengths | Limits |
| --- | --- |
| Exact store-level audit trail and simple effective-date queries | A 20-store department creates many rows and does not itself model data/action scope |
| Clear legacy history when a store moves between groups | Requires a separate resolver and approval/audit rules |
| Useful as a derived implementation detail | Group changes can become operationally noisy |

This is viable as a derived table after an approved scope model exists. Alone it
does not express enterprise, direct-only, FC-only, or business-unit intent.

## Option B: `department_scopes`

One effective-dated row declares an approved department target and scope class.
Candidate fields are `scope_id`, `department_id`, `target_type`, `target_ref`,
`data_scope`, `action_scope`, `effective_from`, `effective_to`, approval fields,
and audit fields. `target_type` may be a store, approved store group,
corporation, business unit, or enterprise only when an owner has approved it.

| Strengths | Limits |
| --- | --- |
| Represents direct-only, FC-only, enterprise, and no-store outcomes without implicit expansion | Requires an exact server-side resolver and RLS/API review |
| Separates data visibility from permitted actions | Target-group definitions need their own source-of-truth contract |
| Supports approval and future reorganization using effective periods | Must not use wildcard targets before formal owner approval |

## Option C: static API configuration

Mapping lives in source configuration and is checked by an API handler.

| Strengths | Limits |
| --- | --- |
| Small initial code change | Weak auditability and no durable effective-date history |
| No new database table at first | Requires redeploy for organizational changes and risks drift from RLS |
| Can be useful only as a temporary read-only prototype | Not suitable as a production source of truth |

## Recommendation

Recommend **Option B: `department_scopes`** as the future authoritative
department-scope model, with a separately reviewed server-side resolver. Option
A may be introduced later as a materialized or derived store-level projection
only if a use case requires it. Option C is not recommended for production.

No table, resolver, policy, API route, or Runtime behavior is created in this
sprint. Future implementation must evaluate: approved department scope, actor
role and position, individual assignment, data classification, requested action,
effective period, and default deny. The browser must never provide an effective
store scope as authority.

## Reorganization behavior

An approved change closes the prior scope with `effective_to` and creates a new
approved scope with a later `effective_from`. Historical reports retain the
scope effective on the report date. No retroactive expansion or automatic
reassignment is allowed.
