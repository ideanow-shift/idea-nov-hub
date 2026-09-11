# Architecture Review: Snapshot vs Production Read-only

## Scope

This is an architecture comparison only. It creates no connection, credential, database role, query, Snapshot, deployment, or runtime change.

## Options

- **A. Snapshot:** a bounded, approved, sanitized aggregate artifact moves one-way from an approved Production read-only process to the Sandbox. Store Operations reads the Sandbox only.
- **B. Production Read-only:** a server-side Store Operations API calls a narrowly scoped Production read-only port for each request. Browser-to-Production access remains prohibited.

## Comparison

| Criterion | A. Snapshot | B. Production Read-only |
| --- | --- | --- |
| Real-time behavior | Delayed by approved refresh frequency. Correctness is explicit through generated/expiry/confirmed period. | Near-real-time if the port and source are available. A confirmed period can still be delayed by accounting close. |
| Security | Strong environment separation at request time; limited aggregate dataset reduces blast radius. | Can be safe only with strict port, network, role, RLS, query, and credential controls. Every request creates a Production dependency. |
| Operational workload | Requires controlled extraction, approval, hash, freshness, retention, and Sandbox-intake lifecycle. | Requires permanent cross-environment access, credential rotation, request auditing, network restrictions, and incident response. |
| Implementation difficulty | Moderate: extractor plus artifact validation and version activation. | High: secure Production port, actor/scope propagation, real-time capacity and failure controls. |
| Maintainability | Stable contract; source changes are detected at refresh validation. Easy to reproduce using a specific version. | More coupled to live schemas, RLS, APIs, credentials, availability, and latency. Changes can affect every request. |
| Failure behavior | Fail closed as stale/unavailable; prior approved unexpired version may be restored. | Fail closed on Production/network/role/RLS failure; a Production incident also removes Store Operations reads. |
| Cost | Storage and scheduled controlled execution; low request-time Production cost. | Ongoing Production query and connection capacity, monitoring, security operations, and potential scaling cost. |
| Sales department usability | Excellent for daily/monthly store management when freshness is clearly displayed. Users get stable figures for review meetings. | Useful only where intraday decisions genuinely require live values; creates variable response time and outage exposure. |

## Decision factors

1. Store Operations V1 uses confirmed sales, operating profit, and monthly KPI. These are not made more authoritative by a live connection before their official confirmation status changes.
2. Current Store Scope and canonical HUB Session Sandbox bindings are not yet available. A live Production read-only port would add cross-environment identity and authorization risk before those controls are proven.
3. The 20-store / Direct 13 / FC 7 baseline and Tokorozawa legacy crosswalk require an immutable, auditable result for operational review and rollback.
4. A Snapshot can omit personal data and raw detail by construction. A live port must enforce equivalent minimization on every request and during every future change.

## Final recommendation

**Adopt A. Snapshot as the IDEA NOV Platform default for Store Operations, Finance aggregate views, and Talent/People aggregate dashboards.**

Use a Production Read-only port only as a separately approved exception when all of the following are demonstrated:

- a specific business decision has a documented intraday freshness requirement that Snapshot cannot meet;
- a server-side canonical session, actor, Role, Store Scope, and Data Scope path is production-proven;
- an exact read-only projection port, RLS behavior, query budget, and request audit are approved;
- a Production capacity and incident owner accepts the request-time dependency;
- the endpoint still returns no personal data or unapproved detail.

The exception is not a fallback route. Snapshot failure must not cause Store Operations to switch to Production Read-only automatically.

## Platform operating model

| Platform area | Default data delivery | Live-read exception |
| --- | --- | --- |
| Store Operations | approved Snapshot | narrowly approved intraday operational metric only |
| Accounting / Finance dashboards | confirmed Snapshot | accounting owner-approved close monitoring only |
| Talent / People dashboards | sanitized aggregate Snapshot | no default live exception; privacy review required |
| NOV HUB | application-owned data contracts | only its existing canonical server-side paths |

## Review outcome

**CONDITIONAL PASS.** Snapshot is the recommended default. The specific Snapshot extraction gate and Sandbox session foundation remain separate approvals; this comparison does not approve either implementation.
