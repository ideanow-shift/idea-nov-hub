# Store Master Decision Options

## Decision guardrail

The current audit decision is `unresolved`. These options are decision support,
not an authorization to change a database, migrate data, generate UUIDs, or
create a crosswalk.

## Option A: retain public.stores as the formal SSoT

| Dimension | Assessment |
| --- | --- |
| Benefits | Matches the currently documented schema, assignment, profile, and bootstrap contracts. |
| Drawbacks | May conflict with an undiscovered core-schema architecture record. |
| Migration cost | Low immediately; no table switch. |
| UUID impact | Preserve existing public UUIDs; do not change them. |
| Existing app impact | Lowest because current source contracts reference public stores. |
| RLS impact | Existing policies and grants still require a production audit. |
| API impact | Existing bootstrap and context contracts remain stable. |
| Migration impact | No migration is justified by this option alone. |
| Recommendation | Interim operational preference only. |
| Required before production | Confirm core table status and actual UUID dependencies. |

## Option B: move formal SSoT to core.stores

| Dimension | Assessment |
| --- | --- |
| Benefits | Could support a future schema boundary if an approved core design exists. |
| Drawbacks | No source evidence currently proves the table, contract, or migration purpose. |
| Migration cost | Unknown and potentially high. |
| UUID impact | Must be explicitly designed; no carry-forward rule exists. |
| Existing app impact | Requires contract, RPC, and dependency review. |
| RLS impact | Requires a complete policy and ownership design. |
| API impact | Requires a compatible versioned Store API. |
| Migration impact | Requires expand, verify, switch, and rollback plans. |
| Recommendation | Not recommended before evidence collection. |
| Required before production | Core schema proof, approved ADR, UUID plan, dependency inventory, and staging rehearsal. |

## Option C: public.stores now and core.stores in the future

| Dimension | Assessment |
| --- | --- |
| Benefits | Separates stable current operations from a deliberate future migration. |
| Drawbacks | Future target is unproven in the audited source history. |
| Migration cost | Medium to high once target facts are known. |
| UUID impact | Requires an approved preservation or crosswalk policy. |
| Existing app impact | Current applications can remain stable until a controlled switch. |
| RLS impact | Requires dual-read or compatibility rules during transition. |
| API impact | Requires versioned compatibility and consumer migration. |
| Migration impact | Requires a complete no-loss rehearsal and rollback. |
| Recommendation | Plausible only after confirming core intent. |
| Required before production | All Option B evidence plus approved cutover ownership. |

## Option D: retire core.stores and abstract public.stores through Core Access Port

| Dimension | Assessment |
| --- | --- |
| Benefits | Retains current data contract while isolating future applications from table layout. |
| Drawbacks | Cannot retire an object whose status and dependencies are unverified. |
| Migration cost | Low to medium for API abstraction; unknown for retirement. |
| UUID impact | Preserve existing public UUIDs behind the access contract. |
| Existing app impact | Consumers can move gradually to a stable API contract. |
| RLS impact | Centralizes authorization design at the access layer. |
| API impact | Requires a defined read contract and consumer rollout. |
| Migration impact | No drop or rename before catalog and dependency proof. |
| Recommendation | Preferred architecture direction only if core is proven unused or abandoned. |
| Required before production | Core-object catalog proof, dependency proof, API contract review, and retirement approval. |

## Current recommendation

Use Option A only as the interim operational posture: retain `public.stores` for
current contracts and make no SSoT-finalization claim. The human decision is
whether to authorize the read-only evidence collection needed to choose among
Options A through D.
