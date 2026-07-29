# Store Master Intent and SSoT History Audit

## Purpose

This Phase 8.5 Step 1-B audit distinguishes the currently documented store
master from an unproven future-master intent. It reviews committed source, Git
history, reachable branches, and unreachable commit trees. It does not query a
database, alter a schema, create a migration, or change any data.

## Scope and method

The audit searched committed documentation, SQL, RPC source, TypeScript and
JavaScript contracts, fixtures, mocks, and Git history for `public.stores`,
`core.stores`, Store Master, SSoT, canonical, legacy, crosswalk, store UUID,
and core-schema migration language.

The local Git object set was searched across reachable refs and unreachable
commit trees for the literal `core.stores`. No creation commit, schema, SQL,
migration, seed, fixture, API contract, runtime contract, ADR, or explicit
design document for that literal was found. This proves only the bounded source
history result; it does not prove that a `core.stores` object does not exist in
a database.

## Git history and public.stores role

| Date | Commit | Evidence | Historical meaning |
| --- | --- | --- | --- |
| 2026-06-23 | `728e15c` | Core employee ledger v1 review | Defines `public.stores` with identity, store business fields, timestamps, and active flag. |
| 2026-06-23 | `3049af0` | Assignment history schema | Uses `public.stores(id)` for employee assignment history. |
| 2026-06-23 | `b12f59a` | Multi-store assignment schema | Uses `public.stores(id)` for employee-store assignment. |
| 2026-06-23 | `2108119` | Store area and type fields | Evolves `public.stores` for operational attributes. |
| 2026-07-01 | `75e3ec0` | NOV HUB bootstrap RPC | Joins `public.stores` and returns store context fields. |
| 2026-07-03 | `02590ce` | HUB Core master scope | Identifies `public.stores` as the master-admin store source and update target. |
| 2026-07-10 | `6e1f4e2` | Store business profile schema | Uses `public.stores(id)` as the profile key. |

These commits establish a coherent, explicit current operating model:
`public.stores` is the repository's documented Core DB store master and is used
by assignment, profile, inquiry, followup, HUB context, and bootstrap contracts.

## core.stores history and intent

No source-history artifact identifies when `core.stores` was created, which
branch created it, its schema, its intended role, or a migration plan from
`public.stores`. No committed branch or unreachable commit tree contains a
literal `core.stores` reference in the local object set.

Consequently, this audit cannot classify `core.stores` as a future master,
prototype, staging table, compatibility layer, comparison table, entity-mapping
table, or abandoned table. Any of those classifications would be speculation
without a read-only database catalog result or an external design record.

## Migration and UUID intent

No committed artifact describes a `public.stores` to `core.stores` migration,
UUID carry-forward, UUID regeneration, crosswalk, cutover, compatibility view,
or public-table retirement. The existing `public.stores` design generates an
identifier by default, but that does not establish how a future core migration
would preserve or regenerate an existing row identifier.

For the Tokorozawa mismatch, this audit found no source evidence tying either
UUID to a seed, fixture, migration, copy, bootstrap, or manual registration.
Potential causes such as new generation, copy-time reassignment, manual entry,
or schema reconstruction remain unranked hypotheses. There is no evidence to
select one.

## Hypothesis review

| Hypothesis | Supporting evidence | Counterevidence | Result |
| --- | --- | --- | --- |
| A: public is current and core is the future integrated master | Strong support for public as current repository contract | No evidence that core.stores was designed or planned as the future master | Partially supported only for public-current; core-future is unproven |
| B: a future core migration would inherit public UUIDs | None | No migration, crosswalk, carry-forward rule, or mapping contract found | Evidence insufficient |
| C: core is an unused prototype or comparison structure | No direct support | Source-history absence cannot prove database abandonment | Evidence insufficient |

## Final determination

**Decision: `unresolved`.**

The audited history strongly supports `public.stores` as the currently
documented Core DB store contract. It does not establish the historical intent,
existence, or future authority of `core.stores`. Therefore none of
`public_current_core_future`, `public_canonical_core_legacy_or_abandoned`,
`core_canonical_public_compatibility`, or `dual_master_intentional` can be
selected as a fact-based architecture decision.

## Recommended human decisions

1. Confirm whether `core.stores` exists in the authoritative database catalog.
2. If it exists, approve a read-only capture of its definition, creation
   provenance, dependencies, and the masked Tokorozawa record pair.
3. Locate any external ADR, issue, or project record that approved a core-schema
   store master, then attach it to this audit.
4. Select a formal SSoT option only after the above evidence is reviewed.

Until then, retain `public.stores` as the current operational contract without
calling it the final future-state SSoT. Do not create a crosswalk, change UUIDs,
or schedule a cutover.

## Unresolved items

- Existence and definition of `core.stores` in the authoritative database.
- Creation date, branch, commit, or external origin for `core.stores`.
- Any public-to-core migration or compatibility plan.
- UUID preservation policy and Tokorozawa mismatch provenance.
- Live API/runtime consumption of each actual store UUID.

## Change declaration

No DB connection, schema change, migration, seed, UUID generation, crosswalk,
deployment, staging change, or production operation was performed. No full UUID,
secret, personal value, or Windows absolute path is included in this audit.
