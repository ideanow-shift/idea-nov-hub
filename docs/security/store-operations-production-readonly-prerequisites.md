# Store Operations Production Read-only Prerequisites

## Decision

**BLOCKED for Production read-only connection.** This source-only assessment
identifies a safe implementation direction, but the authoritative Store Master,
Tokorozawa UUID, 20-store roster, finance confirmation state, and common
permission facts are not yet approved or verified through a controlled
read-only evidence gate. No Production connection, query, update, migration,
RLS change, API creation, deployment, or main merge was performed.

## Scope and evidence boundary

This report uses repository source and prior owner-provided organizational
baseline only. It does not claim live database state. Existing source can show
an intended route or candidate table, but it cannot establish a Production
source of truth, current row membership, UUID fact, live RLS policy, or finance
period closure without a separately authorized read-only audit.

## 1. Core DB workstream

### Current source facts

| Topic | Source evidence | Assessment |
| --- | --- | --- |
| Current Store API candidate | `management_readonly_candidate.ts` reads `stores` through the default public REST profile | `public.stores` is the current source-code integration candidate |
| Formal Store SSoT | `public.stores` and `core.stores` coexist in repository audits | Not decided; a code path is not an approved SSoT declaration |
| Tokorozawa UUID | No Production row read occurred in this assessment | Not decided; no canonical or legacy UUID may be assigned |
| Direct / FC roster | 13 direct and 7 FC is owner-provided baseline | Not verified against an authoritative store/corporation relationship |
| Store history | Store business profile source has dates, but no approved operation-history authority for this purpose | Effective-period and operating-entity history remain implementation-gated |

### Required Core DB decision package

1. Run one separately approved read-only catalog and row-reference audit for
   `public.stores` and `core.stores`, including live dependencies, FK use,
   views, API routes, timestamps, and current application references.
2. Perform the Tokorozawa UUID fact verification against both candidate rows and
   their live references. Do not change UUIDs during verification.
3. Reconcile the 20-store roster, direct/FC classification, operating entity,
   aliases, and effective periods from an approved business owner source.
4. Record an ADR selecting a Store Master SSoT. Only after the ADR may a
   canonical/legacy UUID crosswalk design move to a separate approval gate.

### Current conclusion

`public.stores` is a **runtime integration candidate**, not the formal Store
Master SSoT. Tokorozawa canonical UUID is **unresolved**. Canonical, legacy,
crosswalk, alias, and effective-period data must remain unavailable to the
future Store Sales read path until their evidence gate passes.

## 2. HUB Core workstream

### Existing source route

The inspected handler defines `managementStoresSummary` mapped to
`stores.summary`. It verifies a HUB session server-side, resolves an employee,
resolves role keys and a store scope, and reads through a server-side read-only
gateway. The Runtime is not designed to call the database directly.

However, the current `stores.summary` response reads active stores and returns
zeroed Store Sales values with `salonanswer_csv_waiting`. It is a store-list and
readiness candidate, **not a formal Store Sales API**. The handler also passes
`assignedScopeEnabled: false`; its department-manager permissions are empty and
it has no approved department-to-store resolver. Therefore a broad role key or
screen visibility must not be treated as production authorization.

### Required HUB Core decision package

1. Freeze one formal read-only action name, response envelope, version, resource
   predicate category, and minimum projection for Store Sales.
2. Confirm the HUB session validation flow, employee linkage source, token
   freshness and revocation behavior, and server-side failure categories.
3. Integrate the common six-layer Permission Model only after its human
   decisions and the Department to Store Mapping approvals are completed.
4. Require server-side Store Scope evaluation for every request. Reject mock,
   local CSV, fallback-zero, and browser-supplied store authority in the
   Production route.
5. Keep direct UI-to-database access prohibited. The UI receives a bounded API
   projection only after API authorization and database enforcement.

### Current conclusion

The future formal endpoint is **not yet approved**. The source candidate is
`managementStoresSummary` to `stores.summary`, but it cannot be declared the
formal Store Sales API until its data source, contract, permission resolver,
and Production-mock rejection behavior are approved.

## 3. Accounting Core workstream

### Existing source facts

The finance summary candidate reads `finance_monthly_corporate_pl` and projects
`operating_profit_yen` plus `operating_profit_rate`. This supports the table as
a **source-code candidate** for corporate P/L output. It does not prove that it
is the official accounting source, that values are confirmed, or that the rate
is computed from a governed formula.

The inspected source emits `latestClosedMonth` from the selected or latest
available row. It does not show an independent `confirmed_through_period`, a
monthly close approval state, nor an authoritative formula definition. A label
called closed must not be used as accounting confirmation evidence.

### Required Accounting Core decision package

1. Name the official operating-profit source table/view/RPC and the accountable
   accounting owner.
2. Approve the operating-profit formula, numerator, denominator, rounding,
   zero-sales behavior, period/calendar definition, and restatement treatment.
3. Define an authoritative `confirmed_through_period` and monthly state model
   such as draft, review, confirmed, superseded, and unavailable.
4. Define display rules: unconfirmed values show an explicit pending state and
   cannot be presented as finalized profit or margin.
5. Approve data and action visibility per role through the common Permission
   Model, including a separate rule for finance export and approval.

### Current conclusion

Official operating-profit source, formula, and confirmed-through period are
**unresolved**. The existing finance candidate is insufficient for a Production
Store Sales or profitability display.

## Integrated target architecture after approvals

`HUB session -> server employee resolution -> six-layer permission evaluation -> approved Store Master resolver -> approved Accounting read contract -> bounded API projection -> UI`

Each arrow is server-controlled. The UI never selects an effective store scope,
never queries Core DB directly, and never substitutes local mock/CSV values for
an approved Production response. RLS is the final row enforcement layer after
the server has resolved the same permission facts.

## Unresolved items

| ID | Blocking item | Owner |
| --- | --- | --- |
| B01 | Formal Store Master SSoT between public and core | Core DB owner and Architecture owner |
| B02 | Tokorozawa UUID fact and canonical/legacy decision | Core DB owner |
| B03 | Authoritative direct 13 / FC 7 / total 20 roster and history | Store governance owner |
| B04 | Store Sales API contract and Production-mock rejection contract | HUB Core owner |
| B05 | Server-side common permission resolver and approved department scopes | Security, HUB Core, and department owners |
| B06 | Official operating-profit source, formula, and confirmation state | Accounting Core owner |
| B07 | Live RLS, grants, and service-boundary evidence | Security and Core DB owners |

## Next instructions by workstream

### Core DB 담당

Prepare a read-only fact-verification pack only. Include exact catalog queries
for a separately approved session, evidence schema, masked UUID handling,
dependency counts, store/corporation roster reconciliation, and a decision
matrix. Do not propose a migration, crosswalk row, or update.

### HUB Core 담당

Prepare a source-only Store Sales API contract pack. Define request allowlist,
response envelope, fixed unavailable categories, no-mock rule, HUB session to
employee linkage, server-side six-layer resolver input/output, and UI direct-DB
prohibition. Do not wire an endpoint or change Runtime.

### Accounting Core 담당

Prepare a source-only accounting-read contract pack. Identify candidate source
lineage, required confirmation metadata, formula attestation fields, role/data
projection matrix, and unconfirmed display categories. Do not query, modify, or
recalculate accounting data.

## Change declaration

This report is architecture and source analysis only. Production connection,
database access, database mutation, migration, RLS/JWT/API change, UUID change,
staging, deployment, and main merge count are all zero.
