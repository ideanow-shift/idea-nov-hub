# Staging First Development Policy

## Decision

IDEA NOV OS uses `idea-nov-staging` as the sole completion environment for new Core Business Data Foundation work. Existing Production web applications remain operationally unchanged. Production is a final, separately approved, one-time cutover destination, not a development or rehearsal environment.

## Protected Production Applications

The currently operating NOV HUB, NOV Talent, Thanks Coin, and other live applications are maintained in their current Production state. New Core Business Data Foundation, Store Operations, Finance, Management Platform, and Digital Signage work must not change their Production schemas, functions, secrets, API contracts, runtime configuration, or deployed behavior.

## Staging-First Scope

| Domain | Completion environment | Production rule |
| --- | --- | --- |
| Core Business Data Foundation | `idea-nov-staging` | no Production-first architecture, migration, or data work |
| Store Operations | `idea-nov-staging` | no impact on the published Store Operations preview or other live apps |
| Finance | `idea-nov-staging` | no Production financial schema or API work during development |
| Management Platform | `idea-nov-staging` | no Production integration until final cutover approval |
| Digital Signage | `idea-nov-staging` | no Production dataset or runtime integration until final cutover approval |

## Data Boundary

Existing Production employee, store, corporation, and other masters remain authoritative. Staging may use only an approved minimal snapshot or masked synchronization. It must not receive Production credentials, direct cross-project database access, unmasked personal data, secrets, or unrestricted history. A staging copy is an integration dataset, never a competing system of record.

## Delivery Rules

1. Design, implementation, migration rehearsal, authorization verification, data-contract validation, and E2E evidence occur in Staging first.
2. Production-oriented architecture or migration design is prohibited during normal development. Production cutover planning begins only after Staging acceptance is complete and an Owner opens a separate cutover gate.
3. Every staging change is domain-owned, protected by an explicit human approval, and has a verification and rollback record.
4. No automatic promotion or fallback from Staging to Production is permitted.
5. The final Production cutover may occur once only after all required Staging evidence, data-quality approval, security review, operational review, rollback readiness, and Owner approval are complete.

## Non-Authorization

This policy does not authorize a Production connection, data extraction, schema change, migration, RLS/grant change, Function deployment, Secret registration, or cutover. It changes development governance only.
