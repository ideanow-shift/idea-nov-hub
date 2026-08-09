# Store Operations Consumer Enablement: Canonical Master Population and Assignment Preparation

## Decision

**CONDITIONAL PASS - planning complete; no population, onboarding, access
binding, API change, or Production operation has been performed.**

This package prepares the only acceptable path for connecting Store Operations
V1 to the Accounting consumer port in `idea-nov-staging`:

```text
idea-nov-core Canonical Master
  -> approved, masked source snapshot and manifest
  -> immutable Canonical Master population in idea-nov-staging
  -> approved Canonical Assignment population
  -> approved Staging Auth onboarding and HUB identity exchange
  -> separately approved M019 access-contract binding
  -> Store Operations server-side consumer boundary
```

The first four arrows are prerequisites. They do not authorize the fifth
arrow. In particular, this document does not authorize an M019 contract row,
an Auth user, a source snapshot, a grant, or an application release.

## Scope and non-execution

This plan covers the V1 Consumer population prerequisites for:

- representative;
- vice president;
- sales department head, if and only if source evidence identifies one;
- area managers; and
- one store-manager candidate per official store.

The only requested V1 Accounting scenarios are `actual` and `budget`.
`forecast` receives no grant, no binding, and no fallback treatment.

The following remain out of scope: M019 changes, DBF changes, Store Operations
UI or API changes, Accounting fact loading, Production changes, source
extraction, Canonical Master population, Auth onboarding, and access-contract
binding.

## Evidence used for this preparation

| Evidence | Result | Use in this plan |
|---|---|---|
| Read-only aggregate check of `idea-nov-staging` | `core.corporations`, `core.store_identities`, `core.stores`, `core.employee_identities`, `core.employees`, `core.employee_store_assignments`, `auth.users`, and `accounting.consumer_access_contracts` are all `0`; M019 is present. | Confirms why binding must remain fail-closed. |
| M004, M005, and M006 source | Canonical Master supports effective-dated employees, assignments, corporation-store relations, 20/13/7 population gates, immutable versions, and source crosswalks. | Defines the target data model. |
| M019 source and release package | Every access decision requires an authenticated subject, Canonical Employee, active Canonical Assignment, Corporation/Store/Department scope, and a scenario. | Defines the binding prerequisites. |
| Existing `nov-hub-api` source | HUB session verification is server-side; current role lookup is from the existing HUB role directory. | Defines an Auth dependency, not a Staging role population. |
| Owner-provided baseline | Six corporations; 20 physical stores; 13 direct and 7 franchise; active HQ is outside the official twenty. | Becomes a snapshot validation target, not a replacement for source evidence. |

No Production connection or Production read was performed while creating this
plan. Therefore every source-person, role, position, and assignment claim
marked **unattested** must be confirmed by the approved source snapshot
preflight before any write is allowed.

## Canonical source and population boundary

`idea-nov-core` is the sole source for the Canonical Master. Staging must not
invent employees, stores, corporations, roles, store assignments, or UUID
relations.

The population package has exactly these Core Master manifests:

1. corporations;
2. stores;
3. departments;
4. employees; and
5. employee-store assignments.

Each snapshot must carry a nonblank source version, source-as-of timestamp,
content digest, mapping-contract version, masking-policy version, record
counts, and the existing approval reference. Activation requires five passed
manifests, 25 passed validation results, and four approved owner classes. A
zero count is recorded explicitly, never inferred from an omitted manifest.

The population input must be masked to the M004 employee minimum: a display
alias, status, primary department relation, effective dates, source digest, and
Canonical identity lineage. Production names, email addresses, addresses,
payroll, tax, credentials, and Production Auth identifiers must not be copied.

### Store population conditions

The source snapshot must prove all of the following as-of its declared date:

| Check | Required result |
|---|---:|
| Active official physical stores | 20 |
| Direct official stores | 13 |
| Franchise official stores | 7 |
| Approved active corporation records | 6 |
| HQ/administrative row | classified outside official Store Operations population |
| Legacy, closed, virtual, or unresolved rows | separately classified; never silently merged into the 20 |

The six corporation names supplied by the Owner are the preflight baseline:
IDEA NOV, ALBERO, BIOEL, FILM, LUA, and UNO. Their source identifiers are
never printed in Consumer artifacts. A mismatch in corporation count, official
store count, operating model, or HQ classification rejects the candidate
snapshot; it does not trigger repair or inference.

### Identity preservation and the Tokorozawa legacy relation

The population must preserve stable Canonical identity relations rather than
re-numbering them per snapshot. The source-profile approval chooses one of two
explicit modes:

1. **Source Canonical ID is portable.** Reuse the approved Canonical identity
   value in the Staging Canonical registry.
2. **Source ID is nonportable or legacy.** Create one Staging Canonical identity
   once, then retain the source relation only in
   `governance.source_entity_crosswalks` with source version, effective period,
   mapping/masking contract versions, source digest, and approval lineage.

The choice must be made from the source identity profile, not from ID shape.
Raw source UUIDs are never returned to Store Operations. The Tokorozawa legacy
relation remains a restricted Core Master crosswalk with its effective period
and audit lineage; it must not become a Store Operations-owned table and must
not result in a UUID replacement.

## Assignment and scope contract

`core.employee_store_assignments` is the sole Store Scope source. Its current
effective-date predicate is:

```text
effective_from <= authorization_date
and (effective_to is null or authorization_date < effective_to)
```

Only active, source-backed assignments within that interval may resolve Store
Operations scope. `legacy employee_roles.scope_type = all`, browser role keys,
URL parameters, preview fixtures, support work, and temporary work must not
expand scope.

The current M005 schema recognizes `primary`, `secondary`, `temporary`, and
`support`. For V1:

| Assignment kind | Store Operations scope effect |
|---|---|
| `primary` | eligible if active and source-backed |
| `secondary` | eligible if active and source-backed |
| `temporary` | not eligible |
| `support` | not eligible |

`third` is not a valid M005 assignment kind. The previously proposed third
assignment category is therefore a **contract gap**, not a value to insert. It
requires a separately approved Core Master change if business policy still
needs it.

### Consumer population candidates

| Consumer group | Current planning result | Population rule | Scope result |
|---|---|---|---|
| Representative | identity not named in this package | source snapshot must attest active employee, HUB eligibility, and Owner selection | all 20 only after approved corporation anchors |
| Vice president | identity not named in this package | same as representative | all 20 only after approved corporation anchors |
| Sales department head | **UNRESOLVED** | must prove active employee, canonical HUB role `department_manager`, active Sales Department relation, and approved Store Operations bundle | all 20 only after all proofs and anchors exist |
| Area manager A | source assertion supplied: `area_manager`; current known scope is one store | source snapshot must attest every eligible assignment; no expansion from title | only attested `primary`/`secondary` stores |
| Area manager B | source assertion supplied: `area_manager`; current known scope is one store | same as area manager A | only attested `primary`/`secondary` stores |
| Store manager | Owner baseline says one candidate for each official store | source snapshot must prove one active qualifying assignment per official store, or register an exception | only the manager's attested store(s) |
| General staff | V1 excluded | no population for Consumer binding | 403 |

The two named area managers are not repeated here because this artifact does
not carry employee personal data. The source preflight records non-public
employee references only. Until it attests an assignment, the result is an
empty scope and `403`, not a guessed store list.

### Cross-corporation scope for representative, vice president, and sales head

M019 has no `all` scope. A corporation-scoped access contract requires an
active Canonical employee-store assignment whose store has an active
`relationship_type='accounting'` relation to that corporation. Therefore a full
20-store view across six corporations needs one valid anchor per
employee/corporation, plus one M019 grant for each allowed scenario.

The resolution order is deliberately narrow:

1. Reuse an existing source-backed active assignment that meets the M019
   corporation check.
2. If none exists, create no grant. Prepare an Owner-approved
   **cross-corporation consumer-anchor assignment** decision for a later
   population run.
3. The decision may use the existing `secondary` kind only if the Data Owner
   approves a reserved `assignment_role_code`, an explicit purpose of
   `store_operations_consumer_anchor`, a zero operational allocation, an
   effective interval, a per-corporation anchor store, and an audit reference.
   The resolver must treat it only as a corporation-read anchor and never as
   work-location, payroll, staffing, or a cross-application Store Scope.
4. If that semantic isolation cannot be guaranteed, stop and seek a separate
   schema/contract approval. Do not overload a normal employment assignment.

This is a data/contract decision, not a migration constant. No employee UUID,
role name, or anchor store is hard-coded in a migration. It creates no access
contract in this sprint.

For each approved executive-level subject, the later binding count is
`6 corporations x 2 scenarios = 12` immutable M019 grant decisions. The
representative and vice president together would require 24 decisions; a
confirmed sales department head would add 12. Store and AM decisions are
calculated only from the attested assignment set. `forecast` count remains 0.

## Role and permission boundary

The static HUB implementation verifies a signed HUB session server-side and
resolves its employee through the existing HUB directory. It then reads active
role relationships from the existing `employee_roles` and `roles` source, plus
department and position relations. This is evidence of current HUB behavior
only.

PR001 Canonical Master intentionally has no `core.roles`, `core.positions`, or
Permission Bundle table. It must not receive a duplicate role directory by
assumption. Accordingly:

- `Role` in this plan is a versioned HUB Auth attestation, not a sixth Core
  Master manifest or a new table.
- `store_operations.access`, `store_operations.kpi.view`, and
  `store_operations.profit.view` remain the Owner-approved contract names.
  No existing Staging implementation of those keys/bundles was established by
  this preparation.
- M019 validates identity, assignment, organization scope, and scenario; it
  does **not** replace the Store Operations application-permission or data-scope
  gate.
- The future Store Operations server boundary must verify the canonical HUB
  role/bundle/data-scope decision before calling the M019 read port.

This separates application access, KPI access, profit access, and Store Scope.
`stores.view` alone is not sufficient.

## Auth onboarding plan

### Current constraint

The existing HUB session is an HMAC-verified server-side session whose subject
is the current HUB employee identifier. M019, by contrast, reads a Supabase
`authenticated` JWT subject (`request.jwt.claims.sub`) as `auth_subject_id`.
The Staging aggregate check found `auth.users = 0`.

There is no verified evidence in this sprint of a supported HUB-session to
Staging Supabase-Auth bearer exchange. A browser must never translate the
session itself; an Edge Function must not use a service role to bypass M019.
This is **AUTH-01, a blocking contract gap**.

### Required onboarding sequence after a separate approval

1. Platform/HUB Owner identifies and approves the existing server-side HUB
   verifier and its supported Staging exchange or session-issuance path.
2. The verifier confirms signature, audience, expiry, revocation/validity, and
   active source employee. It returns no raw token, source UUID, or employee
   details to the browser.
3. A source-approved crosswalk proves `HUB employee subject -> Canonical
   Employee`. Matching by email, display name, or client input is forbidden.
4. A new `idea-nov-staging` Auth subject is created or linked only through the
   approved mechanism. Production Auth subjects are not copied or reused.
5. The onboarding evidence binds exactly one Staging Auth subject to exactly
   one active Canonical Employee; ambiguity, expiry, inactive employee, or a
   changed source version stops onboarding.
6. Only after the preceding items and the source snapshot have been approved
   may a separately authorized M019 grant bind that subject to the Canonical
   Employee and Assignment.

If the existing HUB contract already has a durable, auditable subject-to-
Canonical-Employee relation, it may be reused after an attestation of its
columns, uniqueness, lifecycle, and revocation behavior. If it does not,
design a Staging-only onboarding registry in a separate change package. This
document neither creates that registry nor assumes its schema.

### Onboarding candidate limit

The candidate envelope is at most 25 people: representative, vice president,
one unresolved sales head, two area managers, and twenty store managers. The
actual onboarding list is the intersection of an active source employee, a
source-backed eligible role/assignment, a current snapshot, and an approved
HUB Auth onboarding proof. The list may be smaller; no missing person is
substituted.

## Population execution plan

### P0 - source snapshot approval and sealed preflight

- Use the approved read-only source mechanism for `idea-nov-core`; no browser
  or Staging-to-Production connection.
- Fix the source identity profile, extraction manifest, query list, result
  schema, snapshot version, and evidence-retention location before opening a
  connection.
- Attest corporation, store, department, employee, assignment, and HUB
  role/position evidence separately. Do not include raw personal values in
  artifacts.
- Stop on any missing mapping, identifier ambiguity, leaked personal field,
  stale source version, or 20/13/7 mismatch.

### P1 - candidate snapshot and validation

- Produce one immutable candidate snapshot with the five Master manifests.
- Validate hash, count, schema, masking policy, and mapping contract for every
  Master type; record all 25 results.
- Validate 6 corporations, the 20/13/7 official population, HQ separation,
  effective periods, source/canonical crosswalks, and assignment uniqueness.
- Keep Sales Department Head and any unproven AM store as unresolved; never
  repair them by title, primary store, or role alias.

### P2 - approved Staging population

- Requires a dedicated Owner approval. No schema migration is required by this
  plan because M001-M010 already provide the target structures.
- Populate Canonical registry, version registry, Core Master rows,
  corporation-store relations, and population version in dependency order.
- Activate only after existing snapshot, 20/13/7, publication, immutability,
  RLS, and grant gates pass. Do not bulk copy raw source IDs or PII.

### P3 - assignment decision population

- Populate only source-backed `primary` and `secondary` assignments.
- Record approved cross-corporation consumer anchors separately from normal
  operational assignments, if required and approved.
- Reject overlapping primary assignments, wrong corporation relations,
  unresolved store references, expired relations, and unsupported assignment
  kind values.

### P4 - Staging Auth onboarding

- Requires resolution of AUTH-01 and a separate Owner approval.
- Onboard only exact, server-verified candidates. Every onboarding record must
  have source snapshot/version, Canonical Employee, Staging Auth subject,
  approval reference, validity/revocation status, and immutable audit evidence.
- Test missing session, expired session, changed employee status, duplicate
  subject, duplicate employee, and browser-supplied identity rejection.

### P5 - future Consumer binding

- This is a separate Owner authorization, not part of population.
- Re-run source/hash/preflight and confirm active Canonical rows.
- Bind only `actual` and `budget`; pin a valid assignment version for every
  M019 access key. `forecast` stays absent.
- Validate M019 append-only behavior, subject lock, scope denial, revoked
  contract denial, direct raw-table denial, and Store Operations permission
  gate before any UI becomes available.

## Ordered work packages after approval

| Order | Owner | Deliverable and acceptance criteria |
|---:|---|---|
| 1 | Core DB / Master steward | Sealed source-snapshot preflight. It proves the five Master manifests, 6 corporations, 20/13/7 official population, HQ classification, effective periods, and source/canonical crosswalks without outputting PII or raw UUIDs. |
| 2 | Core DB / Assignment steward | Candidate assignment review. It proves the active Store Manager and AM assignment sets, keeps every unproven scope empty, and prepares any executive consumer-anchor decision for Owner review. |
| 3 | HUB Core / Security | AUTH-01 attestation. It identifies a supported server-side HUB-session-to-Staging-Auth exchange, proves signature/audience/expiry/revocation handling, and rejects browser-supplied identity. |
| 4 | Core DB / Auth operator | Separate, approved Master population and Auth onboarding runs. Each is idempotent, auditable, non-PII in its artifacts, and stops before any M019 binding. |
| 5 | Finance / Accounting steward | M019 binding preflight for `actual` and `budget` only. It checks assignment/corporation anchors and calculates contract rows from the approved candidate set. |
| 6 | Store Operations | Server-side Consumer adapter plan. It applies application permission, KPI/profit data scope, returned-store filtering, FC-profit unavailability, and 401/403/503 failure behavior before invoking M019. |
| 7 | E2E / Security review | Staging-only end-to-end tests: invalid/expired session, no permission, no scope, cross-store URL, actual/budget allow, forecast deny, FC-profit unavailable, direct raw-table deny, and revoked binding deny. |

No work package may skip an earlier gate or perform the next package's write.

## Rollback principles

No physical deletion is a rollback strategy.

| Stage | Safe rollback |
|---|---|
| Source preflight/candidate snapshot | reject candidate; retain safe evidence; issue a new snapshot after correction |
| Canonical population before activation | stop before activation; retain immutable audit; do not publish |
| Activated Master version | supersede with a later approved version; do not overwrite rows or crosswalks |
| Auth onboarding | revoke/disable the Staging subject and its session according to the approved HUB Auth lifecycle; do not reuse the subject for another employee |
| M019 Consumer binding | append a `revoke` decision; never update/delete a grant |

## Required Owner decisions

1. Approve the sealed source-snapshot preflight and the source identity profile
   for all five Master types.
2. Confirm the 6-corporation, official 20/13/7, and HQ/legacy classification
   results from that snapshot.
3. Approve the source mapping for each Consumer candidate, especially the
   representative, vice president, sales department head, AMs, and manager
   assignments.
4. Decide whether cross-corporation consumer-anchor assignments are permitted;
   if yes, approve their non-operational semantics and resolver isolation.
5. Approve the exact HUB Role/Permission Bundle/Data Scope mapping and confirm
   the Sales Department Head only when source evidence identifies one.
6. Resolve AUTH-01 by attesting the existing HUB-to-Staging Auth exchange or
   approving a separate Staging-only onboarding change package.
7. Approve the population run, then a distinct Auth onboarding run, then a
   distinct M019 binding run. These approvals must not be combined.

## Acceptance criteria for the next authorization

The next authorization may approve **Master Population execution** only when:

- the source snapshot package is approved and current;
- five manifests, 25 validations, and four approvals pass;
- Canonical Store population is exactly 20 official, 13 direct, and 7 franchise;
- HQ/legacy rows are classified but not leaked to official projection;
- no raw Production ID, Auth subject, secret, or employee PII is in the
  artifact;
- all planned assignments are source-backed and effective-dated;
- every needed cross-corporation anchor is either source-backed or approved as
  an isolated consumer-anchor decision; and
- no `scope_type=all`, `temporary`, `support`, or guessed scope is used.

The next authorization may approve **Auth Onboarding execution** only after
the Master population is active and AUTH-01 is resolved. It may not approve
Consumer Binding until the application permission/data-scope gate, M019
preflight, and server-side Store Operations API verification all pass.

## Readiness verdict

| Gate | Result | Reason |
|---|---|---|
| Canonical Source | CONFIRMED POLICY / source data unattested in this sprint | `idea-nov-core` is fixed as source; no new Production read occurred. |
| Corporation six / Store twenty | BASELINE CONFIRMED / snapshot attestation pending | 6 and 20/13/7 are preflight assertions, not Staging facts yet. |
| Representative and vice-president scope | DESIGN READY | requires exact active source candidates plus six anchor proofs each. |
| Sales department head | UNRESOLVED | no source-attested employee/role/department proof. |
| AM scope | UNRESOLVED BEYOND KNOWN SOURCE ASSERTION | only source-backed eligible assignments may be populated. |
| Store-manager assignment | SNAPSHOT ATTESTATION REQUIRED | 20 candidates must be proven against official stores. |
| Canonical Master population | **CONDITIONAL READY** | execution awaits source snapshot and Owner approval. |
| Auth onboarding | **NOT READY** | AUTH-01 HUB-to-Staging bearer-exchange contract is unproven. |
| Consumer binding | **NOT READY** | needs populated Master, onboarded subject, approved permission/data scope, and separate M019 approval. |

The next safe action is not a binding attempt. It is a request for the
approved, sealed `idea-nov-core` source-snapshot preflight and an Owner decision
on the cross-corporation anchor policy. Until then Store Operations remains
deny-by-default.
