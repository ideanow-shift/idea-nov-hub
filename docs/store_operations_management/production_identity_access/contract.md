# Production AUTH-01 / M019 Contract Alignment V1

Status: implementation candidate; Production **NOT APPLIED**. No release approval is implied.

- Base: `406e3e97dc6a74d9e32fd88ead0504c86f58a1d0`.
- Lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`.
- Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1` (unchanged).
- Owner approved implementation, disposable tests and Draft PR only, 2026-09-05.
- Migration: `20260905020641_production_identity_access_auth01_m019_v1.sql`, generated with Supabase CLI 2.116.0 `migration new`.
- Related: [write manifest](owner-write-manifest.md), [inventory](inventory.md), [verification and rollback](verification.md).

## Trust boundary

Existing NOV HUB authentication → server-verified native NOV HUB session → AUTH-01 binding →
canonical employee → existing Production role → M019 scope → consumer access → canonical stores → formal DBF read.

The external subject in this port is the **native NOV HUB session subject**, not a Firebase UID
and not a Supabase Auth UUID. The existing HUB issuer signs the immutable `public.employees.id`
as `sub`. The existing HMAC verifier checks signature/audience/expiry first. The Production
resolver requires `authType=hub_session`, `audience=nov_hub`, valid session ID and unexpired session.
Only then it computes SHA-256 of the lowercase subject UUID for the service-only RPC.

Binding keys: provider `nov_hub`, issuer `nov_hub_production`, audience `nov_hub`, subject digest,
canonical employee UUID, existing `auth.users.id`, evidence reference. Raw credentials and
Google/Firebase subjects are not persisted or logged by this module. Digest is an index, **not**
a password or proof: browser invocation of the RPC is forbidden even if someone knows the digest.

The binding author must establish the existing Auth anchor separately, using an approved
source crosswalk/identity ownership evidence, not email equality. The active signed HUB subject
must exactly match the bound canonical employee; the trigger enforces that digest equality.
The Auth UUID is a live active-identity anchor, never substituted for the HUB/Firebase subject.
No Auth user is created by this contract. Existing HUB sign-in is unchanged; this PR neither
introduces a new login method nor broadens its trust. Direct Firebase tokens are not accepted
by this Store Operations read action.

`identity_access.auth01_binding_decisions` is grant/revoke append-only. A latest unexpired grant
is unique by subject, employee **and** Auth anchor. A revoked binding no longer resolves; expired,
deleted, anonymous, unverified or banned Auth users fail closed. Current employee status, employment
dates and enabled/unlocked HUB login credentials are checked on every resolution.

## Canonical identities and store namespaces

`canonical_employee_v1` is a security-invoker view of `public.employees`; no second employee
master and no replacement UUIDs. It exposes stable identity, source employee code, current own store;
inactive/not-employed/retired/future-join rows are excluded. `core.employees` is not repopulated.

`canonical_store_v1` is a security-invoker view of public stores, active corporations and operating
profiles. Public store UUID is the canonical Store Operations UUID, public `store_id` is the public
display key. Operating periods are `[opened_on, closed_on)`; null means unspecified. HQ, inactive,
closed/future and non-operating rows are excluded. Resolution requires exactly 20 unique store
keys and UUIDs, direct 13, FC 7, nonblank names. Any population drift fails closed, not partial access.

`store_identity_mapping_v1` explicitly namespaces IDs:

| Namespace | Source → canonical | Authority |
| --- | --- | --- |
| `nov_hub_public` | existing public store UUID → same UUID | zero-row view over official source |
| `legacy_core` | existing legacy Core UUID → public UUID | optional approved `store_alias_decisions` |
| `bdf` | distinct BDF UUID → public UUID | optional approved `store_alias_decisions` |

External aliases are initially **empty**, append-only grant/revoke, 1:1 within each namespace.
No name/code heuristic silently binds aliases, and no existing UUID is updated. Evidence must
prove source and target refer to the same official store before a separately approved alias grant.
The existing formal Store Monthly RPC uses public/canonical UUIDs. It does **not** implicitly read
legacy Core or reinterpret foreign-namespace facts. Any future DBF population using another ID
namespace must resolve its approved alias at the ingestion/read boundary before release; never
copy or relabel facts as part of identity configuration. No aliases are required for the Owner's
20-store authorization configuration.

## Role, M019 and consumer contract

Role source stays `public.employee_roles JOIN public.roles`; both active flags are rechecked.
Executive and super_admin collapse to one `executive` capability only for source all/global
grants with null scope ID. Other role combinations are rejected if more than one of the three
operational roles remains. Role revocation uses the existing source; this port never creates roles.
The legacy role source has active flags, not a separate temporal role-grant model; dated access
is enforced by M019 and consumer records and live source assignments.

| Existing role | M019 assignment_type / scope_type | Source relation and output |
| --- | --- | --- |
| executive / super_admin | global / all | one grant; official active 20; zero per-store assignments |
| area_manager | delegated / assigned | each grant anchors a current source employee_store_assignment; only assigned stores |
| store_manager | primary / own | current employee own-store relation; exactly one operating store |

M019 records include employee, scope ID, source assignment ID when assigned, effective dates,
grant/revoke, timestamps and approval/evidence reference. This is a reusable source-model port
of M019 scope semantics in `identity_access`, not a new employee/store/role authority and not a
copy of incompatible BDF schemas. Dated grants use `[effective_from,effective_to)`; the existing
source assignment's inclusive end-date is intentionally retained when evaluating that source.
Both periods must allow access **today**, never at the selected historical report month.

Area/Store role grants must also permit the resolved store (source global/all/null, or source
store/assigned/own with that exact store ID). Changing source own-store/assignment/role invalidates
the old scope immediately. Conflicting overlapping scope grants and duplicate store scope grants
are rejected. Multiple distinct assigned stores are allowed for real future Area Managers.

`consumer_access_decisions` grants `store_operations_v1` per employee with effective dates.
Latest active consumer authorization is required in addition to Role and M019. All three control
layers can be revoked separately. No browser mutation endpoint exists.

## API integration and public serialization

The existing `storeMonthlyActualProjectionV1` action chooses this resolver only for the exact
Production project. It does not fall back to `findEmployeeForAuth`, email matching or legacy
client-dependent role resolution when this contract is missing or denied. Missing migration,
empty bindings, inactive identity, unknown subject and ambiguous results return a generic denial.

The browser may provide selectedMonth, scopeMode as a **narrowing request**, responseProfile,
and hub_session authType. Extra employeeId/subject/email/role/scope/storeId/target claims are
rejected before resolution. Broader scopeMode is denied by the existing management projection.
Signed UAT markers (snake_case and camelCase) are denied before any technical-assumption RPC.
No Staging object, project reference, bridge, challenge or enrollment is part of this port.

RPC `public.store_operations_production_access_v1(text)` returns internal employee, role, scope,
and canonical masters only to service_role. Backend caches this per request for the unchanged
management projection. The final consumer response has scoped official public store keys, no
employee UUID, raw store UUID, binding data or masters bundle. Formal fact reads use only the
resolved scope. Missing facts stay preparing; no zeros, budgets, synthetic facts or actions are added.

The existing rollout gate is still applied **after canonical resolution**. Defaults remain
DISABLED. OWNER_PILOT still requires the server-configured canonical Owner UUID; this PR does not
set environment flags or enable GENERAL.

## Security and audit

All four decision ledgers: RLS ENABLE + FORCE RLS, browser SELECT/write 0; service_role SELECT/INSERT
only, no UPDATE/DELETE/TRUNCATE. Views are security invoker. RPC/trigger routines use fixed empty
search_path, security invoker, no PUBLIC/anon/authenticated EXECUTE. Existing masters/ACLs/RLS
are untouched. Migration population DML = 0.

Each decision has a unique key, monotonic sequence, grant/revoke, granted/revoked/recorded timestamps
and constrained evidence reference. `recorded_by` is stamped from the active database role, not
client text; the evidence reference identifies the approved human decision separately. Only a grant followed by immutable append-only revoke is legal;
regrant requires a fresh decision key. The trigger stamps revoke and recorded timestamps, rejects
future grant timestamps and preserves revocation even after identity deactivation. A transaction
advisory lock plus READ COMMITTED requirement serializes administrative writes; real concurrent
connection tests verify uniqueness. Full ledgers remain available for authorized audit after revoke.

Evidence references point to restricted approval records; do not put email, names, raw subjects,
tokens, secrets or arbitrary request payloads in them. No audit rows claim technical UAT actors
are real employees. Technical assumption support is excluded from the Production contract.

## Release boundary

Production migration, identity records, Auth, master data, secrets, IAM, Edge/Pages/Cloud Run
deploys, DBF writes, business writes and rollout changes are all **0 in this PR**.
Do not merge or apply automatically. Real User UAT for Area/Store remains
`DEFERRED_UNTIL_POST_DEVELOPMENT_REAL_USER_ACCEPTANCE`; configuration readiness is not Production readiness.
