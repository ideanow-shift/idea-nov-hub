# Store Operations Monthly Data Implementation Plan

## Purpose and fixed V1 boundary

This plan decomposes the approved V1 design into implementation-sized work. It is
not authorization to change a database, run a migration, deploy, connect to
Production, import a real Workbook, change UI, or modify PR #21.

V1 accepts one Yayoi `残高試算表（年間推移）` Workbook. It selects Direct 13
store P/L sheets, FC 7 store P/L sheets, and only approved required P/L items from
headquarters and the EC business. It normalizes monthly sales, operating profit,
EC sales, and product sales. B/S, half-year/cumulative/closing columns, comparison
and reference material, unselected P/L, daily/weekly analysis, POS integration,
and customer-level data are excluded.

The projection uses canonical `store_id`, `corporation_id`, the fixed effective
sheet mapping, and the importer employee number in audit metadata only. It shows
only the latest explicitly published compatible version. `preparing` is displayed
as `集計中`; it is never a zero amount.

## Reuse candidates and implementation boundary

| Candidate | Intended reuse | Verification gate |
| --- | --- | --- |
| `accounting_core/schema.sql` | logical batch, file, version, fact, validation, publication, audit, and rollback lifecycle | target catalog and Accounting owner approval |
| `accounting_kpi/schema.sql` | published-version projection-state model | metric and target-persistence approval |
| `accounting_core/yayoi_excel.py` | Workbook anchors, tax basis, fiscal period, P/L parsing concepts | fixture-only parser acceptance first |
| `review/management-yayoi-pl-local-adapter.mjs` | bounded local Workbook inspection patterns | do not promote its local UI path to a server import boundary |
| `public.stores` and Employee assignment direction | canonical Store Master, effective-dated Store Scope | approved catalog attestation and Core Master ownership |
| `supabase/functions/nov-hub-api/index.ts` | existing canonical HUB session verification behavior | Security/Platform approval of a reusable server boundary |
| `supabase/functions/store-sales-projection/` | synthetic-only regression fixture/reference | never reuse its synthetic identity/data path for real V1 data |

No repository schema artifact proves that matching objects exist in the target
environment. Every physical reuse decision is therefore conditional.

## Phase plan

| Phase | Objective | Work items | Entry gate | Exit gate |
| --- | --- | --- | --- | --- |
| 1 | Source parsing confidence with no persistence | 1-7 | approved sanitized fixture and source-profile review | fixture parser, selection, mapping and dry-run fail-closed tests pass |
| 2 | Accounting command lifecycle design/implementation | 8-13 | Phase 1 pass; Accounting lifecycle owner approval | command contracts and lifecycle tests pass, still no target deployment |
| 3 | Reviewed persistence and access controls | 10-14 | fresh catalog attestation, migration/RLS/security approval | reviewed migration package and negative authorization tests pass in staging |
| 4 | Published monthly read projection | 15 | published lifecycle and server scope resolver available | projection contract, null/unavailable, and scope tests pass |
| 5 | Store Operations read integration | 16 | Phase 4 staging endpoint and role matrix pass | staging E2E, no synthetic fallback, console clean, release review ready |

Phases 2 and 3 may prepare documentation and fixtures in parallel, but no migration
or target-backed command can be finalized before the catalog and security gates.

## Work-item plan

### 1. Yayoi Workbook Import Center

- **Target:** Accounting-only server command surface for one Workbook Profile.
- **Reuse / new code:** reuse Accounting lifecycle concepts; create a dedicated
  `Yayoi Workbook Import Center` command boundary with fixed operations only.
- **Data / migration:** use existing lifecycle objects only if catalog-compatible;
  otherwise Phase 3 proposes alignment. No new Store Operations ledger.
- **RLS / Grant:** Accounting-only command authorization; no browser database
  grants and no arbitrary SQL.
- **Edge Function / UI:** server command is required; future Accounting operator UI
  is required, but not in this planning sprint.
- **Tests, security, rollback:** authorization-negative, arbitrary-command rejection,
  and audit-event tests; command failure produces no published version. Rollback is
  a separate controlled lifecycle operation.
- **Dependencies / done:** requires items 2-13 and the canonical session boundary;
  done when only authorized Accounting actors can initiate a fixture-backed dry-run.

### 2. Workbook parser

- **Target:** parse a single `.xlsx` annual-trial-balance Workbook using anchors,
  not fixed positions or file names.
- **Reuse / new code:** adapt the validation concepts in `accounting_core/yayoi_excel.py`;
  build a server-safe parser module with no `save`, network, or arbitrary formula
  execution.
- **Data / migration:** none. **RLS / Grant:** none. **Edge / UI:** consumed by the
  Import Center only; no UI work.
- **Tests, security, rollback:** fixture tests for report anchor, `勘定科目`, tax
  basis, malformed archive, and size/resource limits. Reject and discard parsed
  output on failure; no raw Workbook quarantine.
- **Dependencies / done:** source profile and sanitized fixture approval; done when
  parser emits bounded selected-sheet candidates only and every malformed fixture
  fails closed.

### 3. Sheet selection

- **Target:** select only mapped Direct-13, FC-7, and explicitly approved
  headquarters/EC P/L sheets.
- **Reuse / new code:** reuse the Sheet Mapping Contract; create an effective-date
  selection module. B/S and unselected sheets are ignored, never aggregated.
- **Data / migration:** mapping persistence is a Phase 3 conditional addition only.
  **RLS / Grant:** mapping readable only through server access port.
- **Edge / UI:** Import Center module; no UI.
- **Tests, security, rollback:** fixtures for missing, duplicate, unselected, B/S,
  and expired mappings; no selected-sheet output if any required store mapping
  fails. No rollback needed before version publication.
- **Dependencies / done:** items 2 and 6; done when selection yields exactly 20
  canonical stores split 13/7 and no non-store total can form a store fact.

### 4. Monthly-column determination

- **Target:** derive `YYYY-MM` from actual fiscal-period metadata and monthly
  headers.
- **Reuse / new code:** reuse fiscal-period parsing concepts; add explicit
  activity-column classifier.
- **Data / migration / RLS / Grant:** none. **Edge / UI:** parser module only.
- **Tests, security, rollback:** fixtures reject missing, duplicate, ambiguous,
  half-year, cumulative, closing-adjustment, and closing-balance columns. No
  rollback: invalid columns produce no normalized facts.
- **Dependencies / done:** item 2; done when only approved monthly activity columns
  can produce facts and future/unconfirmed periods stay `preparing`.

### 5. Account mapping

- **Target:** versioned P/L label-plus-context mapping to the four V1 metrics and
  supporting validation accounts.
- **Reuse / new code:** reuse `docs/accounting/yayoi-account-mapping.csv` as a
  candidate vocabulary only; create a controlled mapping resolver with section and
  occurrence context.
- **Data / migration:** conditional Account Mapping persistence/version reference.
  **RLS / Grant:** Accounting-owned write/review; server read only.
- **Edge / UI:** Import Center validation module; future Accounting mapping-review
  UI only if manual mapping administration is approved.
- **Tests, security, rollback:** duplicate-label, changed-label, missing-account,
  arithmetic-reconciliation, and no-best-effort-match tests. Mapping changes create
  a new version, never mutate a published version.
- **Dependencies / done:** items 2 and 4 plus Accounting approval; done when sales,
  profit, EC, and product mappings are explicit and unapproved labels fail closed.

### 6. Twenty-store sheet mapping

- **Target:** effective fixed `yayoi_sheet_name -> store_id/corporation_id` mapping
  for Direct 13 and FC 7; limited non-store purposes for headquarters/EC.
- **Reuse / new code:** use public Store Master direction and approved Tokorozawa
  legacy resolution only behind the Master boundary; create mapping validation and
  administration contract.
- **Data / migration:** conditional mapping relation/configuration store; no raw
  UUID in the Workbook mapping. **RLS / Grant:** Core Master/Accounting ownership,
  backend read, deny browser access.
- **Edge / UI:** server mapping resolver; no V1 end-user UI.
- **Tests, security, rollback:** exact 20/13/7, no duplicate store, effective-date,
  corporation, and deny-unmapped tests. Revert only by publishing a new approved
  mapping version.
- **Dependencies / done:** fresh Store Master catalog and owner approval; done when
  a reviewed mapping proves all 20 canonical stores without label guessing.

### 7. Dry-run

- **Target:** non-persistent validation report for one selected Workbook.
- **Reuse / new code:** compose items 2-6; create bounded report/receipt generator.
- **Data / migration / RLS / Grant:** none in Phase 1. **Edge / UI:** server command
  preview; future Accounting UI reads summary only.
- **Tests, security, rollback:** no-write assertion, 20/13/7 failure, mapping failure,
  missing account, no personal-data output, and deterministic hash tests. No version
  or projection exists to roll back.
- **Dependencies / done:** items 2-6; done when failure produces bounded metadata
  only and success is still explicitly unpublished.

### 8. Validation and quarantine

- **Target:** fail-closed rules and bounded evidence for a whole Workbook.
- **Reuse / new code:** reuse Accounting validation-result model if compatible;
  create error-code taxonomy for profile, selection, period, account, and invariant
  failures.
- **Data / migration:** conditional validation-result alignment. **RLS / Grant:**
  Accounting/authorized server only; no raw Workbook, sheet, or row payload store.
- **Edge / UI:** Import Center response; future UI shows codes and corrective action.
- **Tests, security, rollback:** reject 20-store mismatch, invalid period, unknown
  store/corporation, forbidden data, and unconfirmed-profit rule. Failed input is
  not published and needs no data rollback.
- **Dependencies / done:** items 2-7 and lifecycle data model; done when one
  blocking failure prevents every metric from projecting.

### 9. Immutable version management

- **Target:** Workbook hash, profile/map/account versions, state transitions, and
  supersession.
- **Reuse / new code:** reuse Accounting version/publication concepts; add the
  Workbook Profile identities and group-level metric compatibility rule.
- **Data / migration:** conditional lifecycle alignment migration. **RLS / Grant:**
  Accounting write through command only; projection read is published-only.
- **Edge / UI:** lifecycle command; future history UI.
- **Tests, security, rollback:** identical-hash replay, correction-as-new-version,
  supersession, immutable-published-version, and expiry tests. Rollback selects a
  prior compatible published version; it never overwrites facts.
- **Dependencies / done:** items 7-8 and Accounting owner approval; done when one
  Workbook becomes exactly one immutable version and only a published one projects.

### 10. Import history and audit evidence

- **Target:** append-only operational metadata: batch/version IDs, hashes, mapping
  versions, aggregate counts, actor employee number, decisions, and timestamps.
- **Reuse / new code:** reuse Accounting audit-log candidate; create bounded event
  payload serializer.
- **Data / migration:** conditional audit schema alignment. **RLS / Grant:**
  Accounting/audit server read only; no browser direct history access.
- **Edge / UI:** command-generated events; optional Accounting history UI later.
- **Tests, security, rollback:** append-only, secret/PII/raw-financial-value exclusion,
  actor attribution, and retention-policy tests. Audit events are not erased by a
  rollback.
- **Dependencies / done:** item 9 and retention approval; done when every dry-run,
  publish, and rollback decision has bounded evidence.

### 11. Publish

- **Target:** Accounting-controlled transition from fully validated version to
  `published` monthly data.
- **Reuse / new code:** reuse publication lifecycle candidate; create a fixed
  publish command that accepts a version ID, not arbitrary facts.
- **Data / migration:** conditional publication alignment. **RLS / Grant:**
  Accounting-only publish; separate representative role is not needed in normal
  publication.
- **Edge / UI:** command boundary and future Accounting publish control.
- **Tests, security, rollback:** unauthorized publish, incomplete validation,
  stale mapping, pending period, and double-publish tests. Failure does not replace
  the last published version.
- **Dependencies / done:** items 8-10, Accounting role resolution, and confirmed
  period rule; done when only the latest compatible explicitly published version can
  be consumed.

### 12. Rollback

- **Target:** restore a prior compatible published version through a new
  `rollback_restore` event/version.
- **Reuse / new code:** reuse Accounting rollback/publication supersession model;
  create dual-approval evidence validation.
- **Data / migration:** conditional approval/audit alignment. **RLS / Grant:**
  Accounting plus Representative approval; neither browser claims nor one actor are
  sufficient.
- **Edge / UI:** fixed rollback-request command and future two-party review UI.
- **Tests, security, rollback:** missing second approval, incompatible target,
  immutable history, and restored-projection tests. The work item itself defines the
  rollback mechanism; it never deletes historical versions.
- **Dependencies / done:** items 9-11 and governance approval; done when a prior
  compatible version can be restored with two auditable decisions.

### 13. Server-side role and Store Scope

- **Target:** resolve actor, role, and effective store scope server-side for all
  commands and reads.
- **Reuse / new code:** reuse canonical HUB session behavior only after Security
  approves a reusable server boundary; reuse effective employee-store assignments.
- **Data / migration:** conditional assignment compatibility only. **RLS / Grant:**
  default deny; AM without an active assignment yields an empty set or `403`; general
  employee Store Sales access is `403`.
- **Edge / UI:** shared server authorization module; no role assertion from UI.
- **Tests, security, rollback:** expired/mocked token rejection, representative 20,
  sales director Direct-13, store manager own-store, AM-unassigned deny, and employee
  `403`. Authorization policy changes require a separately reviewed rollback plan.
- **Dependencies / done:** canonical verifier, Store Master, and Employee assignment
  approvals; done when commands and projections use the same resolver and negatives
  pass.

### 14. Migration, RLS, and Grant package

- **Target:** reviewed, staged package for only catalog-proven lifecycle, mapping,
  assignment/crosswalk, audit, and access gaps.
- **Reuse / new code:** use approved schema candidates as input; create no duplicate
  master or ledger.
- **Data / migration:** currently three planning candidates: Accounting lifecycle
  alignment, Core Master mapping/assignment/crosswalk compatibility, and access
  security. Exact migrations may reduce after catalog attestation.
- **RLS / Grant:** three policy domains: Accounting lifecycle, Core Master
  mapping/assignment/crosswalk, Store Master/projection Access Ports. Least privilege,
  no browser table grant, no `BYPASSRLS`.
- **Edge / UI:** deployment is deferred until package approval; no UI dependency.
- **Tests, security, rollback:** migration dry-run, policy-negative, grant-negative,
  and reversible expansion/contract tests. Every migration needs approved rollback
  before execution.
- **Dependencies / done:** all human approvals below; done when code-reviewed SQL,
  RLS, grants, and rollback runbooks are approved for staging, not executed here.

### 15. Monthly Projection

- **Target:** server-produced read model with four normalized metrics, publication
  state, confirmed-through period, and `null`/`unavailable` semantics.
- **Reuse / new code:** reuse Accounting published-fact/projection concepts; create
  a Store Operations projection Access Port instead of direct table reads.
- **Data / migration:** conditional projection view/query alignment. **RLS / Grant:**
  server principal plus resolved role/scope filter; published-only data.
- **Edge / UI:** server endpoint/function required; UI is a consumer only.
- **Tests, security, rollback:** latest-published-only, `preparing -> 集計中`,
  unconfirmed profit `null`, FC profit `unavailable`, no headquarters/EC allocation,
  and role/scope tests. Publication rollback changes which version projects, not
  facts in place.
- **Dependencies / done:** items 9, 11, 13, and 14; done when staging returns no
  synthetic fallback and only authorized store rows.

### 16. Store Operations display integration

- **Target:** consume the server projection and render approved monthly states.
- **Reuse / new code:** reuse existing Store Operations read surface only after it
  can call the target-backed access port; remove no unrelated UI.
- **Data / migration / RLS / Grant:** none beyond Phase 3/4 contracts. **Edge / UI:**
  UI change is required in this future phase, not in the current planning work.
- **Tests, security, rollback:** staging E2E for representative, sales director,
  store manager, unassigned AM, and employee; verify no direct DB access, no
  synthetic fallback, null versus zero behavior, and console errors/warnings zero.
  UI rollback returns to the last compatible read-client version while the published
  data version remains immutable.
- **Dependencies / done:** Phase 4 staging endpoint and Security role matrix; done
  when Store Operations shows only authorized latest-published data and all required
  unavailable/preparing states correctly.

## Human approval gates

1. Accounting owner approves the sanitized representative Workbook Profile, selected
   P/L sheet inventory, account mappings, tax basis, and confirmed-period rule.
2. Core Master owner confirms target catalog compatibility, 20/13/7 store mapping,
   corporation IDs, effective dates, and Tokorozawa legacy resolution boundary.
3. Security/Platform owner approves the canonical reusable HUB session verifier,
   server principal, role/scope rules, and denial tests.
4. Accounting, Core Master, and Security owners approve the exact migration, RLS,
   Grant, retention, and audit-evidence package after catalog attestation.
5. Accounting plus Representative approve the dual-approval rollback record and
   operation before rollback is enabled.
6. Staging deploy owner approves deployment and fixture/staging E2E only after all
   preceding gates pass. Production work remains a separate approval.

## Recommended first implementation sprint

Start **Phase 1: fixture-only Yayoi Workbook parser, selected-sheet mapping, month
resolver, account resolver, and dry-run**. It has no database, migration, runtime
deployment, or Production dependency, and it produces the evidence needed for the
later catalog and lifecycle decisions.

## Explicit non-actions

This plan performs no database change, migration execution, RLS/Grant change,
deployment, Production connection, real Workbook import, UI implementation, or PR
#21 modification.
