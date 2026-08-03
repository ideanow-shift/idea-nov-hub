# Shared Staging Strategy

## Operating Model

Operate `idea-nov-shift-status-sandbox` as **idea-nov-staging**, a single shared non-production environment. It is not a Production replica and must never fall back to `idea-nov-core` for data, secrets, session verification, or endpoint calls.

## Domain Separation

| Domain | Database boundary | Runtime boundary | Dataset boundary |
| --- | --- | --- |
| HUB | Core-owned schema/contracts only | `hub-*` function namespace | synthetic or approved masked identity fixtures |
| Store Operations | Store / Accounting contracts only | `store-sales-*` namespace | synthetic, masked, or approved snapshot only |
| NOV Talent | Talent-owned schema/contracts only | `nov-talent-*` namespace | synthetic or masked workforce data only |
| Finance | Accounting-owned schema/contracts only | `accounting-*` namespace | synthetic or approved masked financial fixtures only |

No runtime may read another domain's raw staging dataset unless an explicit server-side contract identifies the source, purpose, allowed fields, and authorization owner.

## Shared Release Discipline

1. One approved change window at a time for schema-affecting work.
2. A migration manifest identifies domain owner, dependency, forward action, validation, and rollback before any staging application.
3. Per-domain smoke tests run after deployment; cross-domain E2E runs only after all affected owners approve.
4. A failed migration or security test freezes further shared-Staging promotion until the owner restores the prior approved state.

## Readiness Gate

The shared environment is usable only after its remote inventory is reconfirmed and the four domain boundary manifests are approved. This does not authorize deployment.
