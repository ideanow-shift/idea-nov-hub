# Store Operations Consumer Enablement: Owner Decision Gate

**Status:** Decision material only. No database, Auth, M019, consumer binding, master population, or application connection has been executed.

**Decision scope:**

1. Whether to adopt a purpose-separated cross-corporation consumer-anchor assignment for the Representative and Vice President.
2. Which AUTH-01 identity-bridge direction will safely connect an existing HUB Session to a Staging subject accepted by M019.

This document is based on static source and migration review plus the already-attested Staging aggregate state. It is not a new Production or Staging inspection and does not assert any unverified live identity or assignment.

## 1. Decision Context

Store Operations V1 needs a future consumer read path for these people:

| Consumer group | Required Store Operations scope | Scenario scope |
|---|---|---|
| Representative | All official 20 stores across six corporations | `actual`, `budget` |
| Vice President | All official 20 stores across six corporations | `actual`, `budget` |
| Sales Department Head | All official 20 stores, only after an owner-attested employee and department relation exist | `actual`, `budget` |
| Area Manager | Only effective, source-backed assigned stores | `actual`, `budget` |
| Store Manager | Only effective primary or approved concurrent stores | `actual`, `budget` |
| General employee | No Store Operations V1 access | None |

`forecast` is outside V1 and must not receive a grant. The official store baseline remains 20 stores, Direct 13 and Franchise 7, across IDEA NOV, ALBERO, BIOEL, FILM, LUA, and UNO. That baseline must be re-attested by a sealed source snapshot before a population or access-binding operation.

The current Staging aggregate evidence is zero canonical corporations, stores, employees, assignments, Auth users, and consumer-access-contract rows. Therefore neither decision authorizes a write; both decisions describe only the safe future route.

## 2. Static Contract Facts

### 2.1 Existing HUB Session

The inspected `nov-hub-api` source establishes the following existing, server-side contract:

| Item | Static evidence | Result |
|---|---|---|
| Session issuer | HUB API server issues a signed compact session after successful HUB authentication | Confirmed in source |
| Session audience | Fixed HUB audience, `nov_hub` | Confirmed in source |
| Subject | The signed session `sub` is the existing HUB employee identifier | Confirmed in source |
| Server verification | Signature, audience, UUID shape, issued-at, and expiry are checked by the HUB API before it resolves the employee | Confirmed in source |
| Session lifetime | Fifteen-minute expiry is encoded by the existing issuer | Confirmed in source |
| Current role lookup | Existing HUB employee roles and role records are resolved server-side | Confirmed in source |
| Firebase relation | Existing Firebase verification is server-side; the legacy directory can resolve a Firebase UID and has an email fallback in a legacy branch | Confirmed as legacy behavior; email fallback is not eligible for AUTH-01 |
| Browser transport | Existing app calls use an Authorization bearer header to the HUB API | Confirmed in source |

The session signing material remains function-held. It is not a browser secret, is not included here, and must never be reused as a client-side token-generation mechanism.

### 2.2 Existing Canonical Identity and Staging Auth Relation

| Question | Evidence result | Decision consequence |
|---|---|---|
| Existing HUB employee ID to PR001 canonical employee crosswalk | Not attested | A source-backed crosswalk must be created or populated only through the later approved snapshot/onboarding workflow. |
| Existing HUB Session to Staging Supabase Auth subject exchange | No reusable, attested exchange was found in the inspected source and migration set | Do not assume one exists or create a substitute ad hoc. |
| Existing Staging Auth subject | Earlier Staging aggregate attestation reported `auth.users = 0` | Auth onboarding is a later gated operation. |
| M019 request identity | M019 validates `request.jwt.claims.sub` and requires `role = authenticated` for its consumer read port | A valid Staging Auth identity is required by the current M019 path. |
| HUB opaque handoff pattern | An existing IDEA LINK handoff uses an opaque, server-managed code and a different HUB session audience | It is a technical precedent only, not a verified M019-compatible identity bridge. |

**Non-negotiable AUTH-01 rule:** neither email equality, display-name equality, manual UUID entry, an unverified frontend role key, nor an existing Production Auth subject is an identity binding proof.

### 2.3 M019 Access Contract Boundary

The current M019 contract has three material constraints:

1. It uses `accounting.consumer_access_contracts`, linked to canonical employee and canonical employee-store-assignment versions.
2. It permits corporation, store, and department scopes, but has no global or `all` store-scope type.
3. A corporation-scoped contract requires a current canonical assignment that is connected to that corporation through the accounting relationship. The read port is executed only for a valid Staging `authenticated` subject.

M019 does not treat legacy `employee_roles.scope_type = all` as a Store Scope source. This remains prohibited for Store Operations V1.

## 3. Decision 1: Cross-Corporation Consumer-Anchor Assignment

### 3.1 Problem Being Solved

The Representative and Vice President require Store Operations visibility across all six corporations and the official 20-store set. A normal HR assignment describes operational employment or working responsibility. Treating a cross-corporation read entitlement as if it were a normal job assignment would blur HR truth and consumer authorization.

The proposed **cross-corporation consumer-anchor assignment** is a purpose-limited canonical relation used only to establish an internal-consumer authorization anchor. It is not a payroll, staffing, attendance, productivity, reporting-line, or operational store assignment.

### 3.2 Required Contract for the Recommended Form

The following describes the future contract only. It does not create a table, record, role, or grant.

| Contract field or rule | Required future behavior |
|---|---|
| Purpose | Explicit `internal_consumer_anchor` purpose, distinct from HR affiliation and work assignment |
| Subject | Canonical employee selected through an approved source snapshot; no UUID hardcoding in migration or application source |
| Organization scope | One explicit corporation relation per approved corporation; no global implicit scope |
| Store anchor | A valid official store anchor for the corporation, only where M019's accounting-relation prerequisite is satisfied |
| Effective interval | `effective_from <= authorization_at < effective_to`; a null `effective_to` means continuing |
| Scope | Stores derived only through the later Consumer Access contract; no Finance or other application scope is implied |
| Lifecycle | Append decision and revocation evidence; close or revoke through effective dating, never silently overwrite history |
| Audit | Approval reference, source snapshot/version reference, purpose, corporation, effective period, approval actor reference, and revocation reason/reference |
| Operational isolation | It must be excluded from HR staffing, attendance, labor allocation, sales attribution, productivity, and normal manager reporting |
| Reuse | Other internal consumers may request a separately approved consumer purpose. No automatic cross-application propagation is allowed. |

### 3.3 Six-Corporation Form

For each approved person, the safe form is six distinct organization-scoped anchor relations, one per corporation:

| Corporation | Future anchor requirement |
|---|---|
| IDEA NOV | One effective consumer anchor with a valid official Store Operations / accounting relation |
| ALBERO | One effective consumer anchor with a valid official Store Operations / accounting relation |
| BIOEL | One effective consumer anchor with a valid official Store Operations / accounting relation |
| FILM | One effective consumer anchor with a valid official Store Operations / accounting relation |
| LUA | One effective consumer anchor with a valid official Store Operations / accounting relation |
| UNO | One effective consumer anchor with a valid official Store Operations / accounting relation |

This is deliberately not one unrestricted cross-corporation row. It permits review and revocation by corporation and keeps the M019 organization relationship explicit.

For a future Representative or Vice President binding, each approved anchor would later allow a separately reviewed Store Operations consumer access contract for `actual` and `budget`. No grants, rows, or people are selected by this document.

### 3.4 Existing Assignment Model Impact

The currently reviewed canonical assignment model supports `primary`, `secondary`, `temporary`, and `support` assignment kinds. It does not establish a separate, purpose-bearing consumer-anchor type. M019 currently references canonical employee-store assignments directly.

| Alternative | Advantages | Material risks | M019 impact |
|---|---|---|---|
| Reuse `secondary` with a reserved role code | Could minimize the initial schema surface | Misstates a consumer entitlement as an HR-style assignment; current model cannot prove the intended purpose; exposes staffing/reporting confusion | Could fit M019 without a change, but fails the required semantic separation |
| Create 20 ordinary store assignments | Uses existing relation shape | Creates false HR/operational assignments; high audit and revocation burden | Technically possible in theory, but unacceptable |
| Add a purpose-separated consumer-anchor relation | Preserves HR truth, permits effective dating and audit, supports per-corporation revocation | Requires an approved later data-model and M019 alignment change | M019 must be amended to recognize the relation or a governed derived assignment contract |
| Use an executive/global role scope | Small data-model change | Violates role-plus-scope design, creates broad implicit authority, M019 has no global scope | Requires an M019 redesign; not recommended |

### 3.5 Benefits and Risks

| Dimension | Purpose-separated consumer-anchor assignment |
|---|---|
| Benefits | Keeps HR affiliation distinct from application access, keeps six-corporation scope explicit, supports effective dating and auditable revocation, avoids employee/role hardcoding, and preserves deny-by-default. |
| Drawbacks | Requires a later controlled schema and M019 alignment package; adds governance objects and review work. |
| HR-confusion risk | Low only if the relation has an explicit purpose and is excluded from HR and operational projections. High if `secondary` is overloaded. |
| Auditability | High when the approval reference, source snapshot, corporation, interval, purpose, revoke reason, and current/revoked state are immutable evidence. |
| Revocation | Future access is removed by ending/revoking the corporation-specific anchor and appending the related Consumer Access revoke event. Historical evidence remains. |
| Finance impact | None by default. Finance must request its own app-scoped authorization contract and Owner approval. |
| Other Consumer reuse | Possible only through an explicit allowlisted purpose and a separate app-level access decision. It is not a blanket executive permission. |

### 3.6 Recommendation

**RECOMMEND: ADOPT, using the `MODIFY AND ADOPT` option below.**

Adopt the concept only as a **purpose-separated** consumer-anchor relation. Do **not** overload `primary`, `secondary`, `temporary`, or `support`, and do not manufacture ordinary work assignments for authorization. The required consequence is a future, separately approved M019 alignment package; no such change is authorized now.

### 3.7 Owner Selection

#### Decision 1: cross-corporation consumer-anchor assignment

```text
[ ] ADOPT
[ ] DO NOT ADOPT
[ ] MODIFY AND ADOPT

Recommended selection: MODIFY AND ADOPT
Reason: Adopt a purpose-separated, per-corporation consumer-anchor contract;
        do not overload ordinary HR assignments. Require a separately approved
        M019 alignment package before it can be used.
```

**If DO NOT ADOPT:** Representative and Vice President all-20-store access remains blocked until an alternative source-backed scope model is approved. No role-only or `all`-scope fallback is permitted.

## 4. Decision 2: AUTH-01 Identity Bridge

### 4.1 Objective

AUTH-01 must let a person who has an existing valid HUB Session reach the M019 Consumer Access Port as a safely resolved Staging subject. The bridge must preserve environment separation and must not make the browser responsible for identity creation or authorization decisions.

### 4.2 Alternatives

| Alternative | Flow | Security and compatibility assessment |
|---|---|---|
| A. Direct server-side consumer access | Existing HUB Session -> HUB server-side verification -> canonical employee -> server-side Consumer Access | The existing HUB verification portion is established. However, the current M019 port requires a valid Staging `authenticated` subject. A direct call is not M019-compatible unless a distinct future access port or an M019 change is separately approved. Do not adopt it for the current M019 route. |
| B. Trusted Staging Identity Bridge | Existing HUB Session -> HUB server-side verification -> approved HUB-to-canonical employee crosswalk -> short-lived Staging credential/subject -> M019 Access Port | Compatible with M019 if the resulting credential is a normal Staging Auth subject and the bridge is server-controlled. No existing reusable exchange has been attested, so this is a new integration contract using existing HUB and Staging Auth foundations, not a new client-side auth system. |
| C. Existing IDEA NOV OS handoff pattern | Existing HUB Session -> existing opaque handoff mechanism -> Consumer Access | An opaque handoff exists for IDEA LINK with a different audience and behavior. It is a precedent, not a verified Staging Supabase Auth exchange. It cannot be adopted unchanged for M019. |

### 4.3 Comparative Evaluation

| Criterion | A. Direct server-side access | B. Trusted Identity Bridge | C. Existing handoff unchanged |
|---|---|---|---|
| M019 compatibility | No, without a separate approved change | Yes, if it results in a valid Staging `authenticated` subject | Not proven |
| Browser secret exposure | Low if entirely server-side | Low only if issuance, exchange, and refresh are server-controlled; no client token signing | Unknown for this use |
| Replay control | Must be newly designed | Short expiry, audience binding, one-time exchange or nonce, and server-side session validation can be designed | Existing pattern is for another audience; no reuse assumption |
| Expiry and revocation | Needs a new contract | Can inherit HUB expiry checks and add short Staging expiry/revocation checks | Not attested for M019 |
| Environment separation | Weak unless carefully designed | Strong: bridge is explicitly Staging-only and rejects Production | Not established |
| Implementation complexity | Medium, but incompatible with current M019 | Medium to high, with a clear boundary | Low apparent effort but high unverified risk |
| Operational complexity | Medium | Medium: onboarding, bridge monitoring, revocation | High support risk if used outside its intended contract |
| Reuse for internal apps | Limited and would create competing access ports | Good when application, audience, and data scope remain explicit | Not reusable without a new formal contract |
| Supabase Auth dependence | Avoids it only by bypassing/redesigning M019 | Uses the existing M019-required Staging Auth boundary | Does not establish required Auth relation |
| HUB modification scope | Needs a new Consumer Access route | Bounded server-side bridge/verification integration | Would require unproven reuse changes |
| M019 change required | Yes | No, provided the bridge yields a legitimate Staging authenticated subject | Yes or uncertain |

### 4.4 Required Safety Contract for Alternative B

If the Owner selects Alternative B, the subsequent design package must prove all of the following before implementation:

1. HUB verifies the existing session server-side before any bridge action.
2. The HUB employee to canonical employee mapping is source-backed and versioned; no email, display-name, or manual-ID matching is allowed.
3. The bridge operates only for `idea-nov-staging`, with an explicit audience and environment fail-closed guard.
4. A Staging subject is onboarded through an approved process before it can receive access. Production Auth subjects are never copied or reused.
5. Any issued Staging credential is short-lived, audience-bound, and issued only by trusted server-side components. No service-role credential, signing material, or client-side JWT generation reaches the browser.
6. Replay controls, revocation behavior, and session expiration are explicit and testable.
7. M019 continues to resolve `request.jwt.claims.sub` as the Staging subject and re-evaluates its own Consumer Access and scope contracts.
8. Authentication success never implies application permission, data scope, store scope, or `forecast` access.

### 4.5 Recommendation

**RECOMMEND: Identity Bridge new design, using Alternative B.**

This does not replace existing HUB authentication and does not create a new general-purpose identity provider. It defines the missing, server-side integration between the existing verified HUB Session and the Staging Auth subject required by M019. Alternative A cannot be used without changing M019 or adding another access port. Alternative C is not currently an Auth contract for this purpose.

### 4.6 Owner Selection

#### Decision 2: AUTH-01

```text
[ ] ADOPT EXISTING CONTRACT
[ ] IDENTITY BRIDGE NEW DESIGN
[ ] OTHER

Recommended selection: IDENTITY BRIDGE NEW DESIGN
Reason: Existing HUB session verification is reusable, but no attested HUB-to-
        Staging Supabase Auth exchange exists. A Staging-only, server-side
        bridge is required to satisfy M019 without weakening its JWT boundary.
```

**If EXISTING CONTRACT is selected:** the Owner must provide an attested, existing HUB-to-Staging Auth exchange contract. Without that evidence, AUTH-01 remains blocked; no new mechanism may be guessed.

## 5. Decision Consequences

| Topic | If Decision 1 recommended option is approved | If Decision 2 recommended option is approved |
|---|---|---|
| Master population | Still requires sealed source snapshot preflight, manifest/hash verification, masking policy, idempotency, audit, and explicit write approval | Still requires the same population preflight |
| Auth onboarding | No execution until a purpose-separated contract and canonical employee population exist | Requires a separate approved onboarding and bridge design package |
| M019 | Requires a future M019 alignment amendment for a purpose-separated anchor relation | No M019 change required if the bridge supplies a normal valid Staging Auth subject |
| Store Operations | Remains unconnected until population, onboarding, binding, and consumer validation pass | Remains unconnected until population, onboarding, binding, and consumer validation pass |
| Production | No Production change, connection, identity reuse, or direct access is authorized | No Production change, connection, identity reuse, or direct access is authorized |

## 6. Remaining Owner Decisions After This Gate

1. Select Decision 1 and Decision 2 above.
2. Approve the sealed source snapshot preflight and population manifest scope for corporations, stores, employees, roles, and assignments.
3. Approve which source-backed people may receive Representative, Vice President, Sales Department Head, Area Manager, and Store Manager consideration. The Sales Department Head remains unresolved until source attestation.
4. Approve the purpose-separated anchor schema and M019 alignment package, if Decision 1 is selected as recommended.
5. Approve the Staging Auth onboarding and AUTH-01 bridge package, if Decision 2 is selected as recommended.
6. Approve M019 binding only after the preceding gates have passed. Each binding remains app-specific and scenario-limited to `actual` and `budget`.

## 7. Ordered Next Steps After Owner Decision

No step below is authorized by this document alone.

1. Sealed source snapshot preflight.
2. Owner-approved Staging Canonical Master population.
3. Owner-approved Auth onboarding and AUTH-01 bridge implementation.
4. Owner-approved M019 alignment, only if Decision 1 selects the purpose-separated consumer-anchor design.
5. Owner-approved M019 consumer binding for Store Operations V1.
6. Store Operations server-side consumer connection and staged acceptance testing.

## 8. Final Readiness

| Readiness item | Status |
|---|---|
| Decision 1 materials | Ready |
| Decision 2 materials | Ready |
| Existing HUB server-side session verification | Confirmed by static source review |
| Existing HUB-to-Staging Auth identity bridge | Not attested; decision and later design required |
| M019 change now | Not authorized; future change required only for the recommended purpose-separated anchor relation |
| Master population | Not executed |
| Auth onboarding | Not executed |
| M019 binding | Not executed |
| Store Operations connection | Not executed |

**Overall result: OWNER DECISION READY.**

## Evidence References

- `supabase/functions/nov-hub-api/index.ts`: HUB server-side session issuance, verification, existing employee and role resolution, and IDEA LINK handoff precedent.
- `supabase/migrations/20260808211137_m019_bdf_accounting_consumer_release_security.sql`: M019 Consumer Access subject, assignment, scope, and JWT-bound read-port contract.
- `docs/architecture/44_store_operations_consumer_enablement_population_preparation.md`: current zero-population state, source population guardrails, and prior consumer enablement preparation.
