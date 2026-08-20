# Store Operations Staging Core UAT Foundation

Read-back date: 2026-08-21. Environment: `idea-nov-staging` only.

## Decision

Hosted Role UAT remains fail-closed. No executable, approved Core population path or complete Core authorization read contract currently exists, so this package does not create identities, roles, assignments, access grants, or a legacy fallback.

## Existing population route

The repository contains the M001-M011 Core/Governance schema, immutable Snapshot and Master Version lifecycle, publication projections, and the approved population plan. It does **not** contain an executable Store Operations Core population runner backed by a sealed real source snapshot. Staging read-back confirms zero canonical corporations, stores, employees, assignments, and published Core projections.

Therefore:

- Target schema and validation lifecycle: present.
- Approved executable population route: absent.
- Master population schema migration: not required.
- Real Master population: separate Owner-approved data operation required.

## Authorization contracts assessed

`projection.employee_assignment_v1`, `store_master_v1`, and `corporation_master_v1` are valid published-master projections, but cannot authenticate a person or attest an application Role.

M019 `accounting.current_consumer_access_contracts(...)` is the existing canonical identity/scope contract. It requires a real Staging Supabase Auth subject and an active canonical Employee/Assignment binding. It does not own Store Operations application Roles. The current HUB Session subject is a Legacy HUB Employee UUID, and no approved HUB-subject-to-Staging-Auth/Core-Employee bridge exists.

The adopted foundation boundary is therefore:

1. Existing HUB Session remains the only entry authentication and is verified server-side.
2. AUTH-01 must provide an approved Staging-only subject bridge and exact source-backed crosswalk to one canonical Employee.
3. M019 remains the canonical identity, effective assignment, organization, and Store Scope contract.
4. Store Operations Role/permission must come from a separately attested HUB authorization contract; Core has no Role master and must not receive a duplicate one.
5. The Store Operations adapter may connect only after all four contracts are populated and approved.

## Minimum real UAT identities

Three distinct, real, active Staging users are the minimum acceptance set:

1. one Executive or `super_admin` with approved all-20-store coverage;
2. one Area Manager with at least one active, effective canonical assignment;
3. one Store Manager with exactly the approved own-store scope.

These users must be selected from the sealed source snapshot. One person must not be copied into multiple fake identities merely to satisfy the matrix. General staff denial and unauthenticated/expired-session denial use additional real or negative test cases but do not require a fabricated user.

## Required migration gate

A migration is required only for the missing AUTH-01 subject bridge/read boundary if the approved platform contract cannot reuse an existing attested object. Its design must be approved before implementation. It must be Staging-safe, server-only, revocable, audience-bound, unique in both directions, non-PII, and default-deny. No migration in this package is authorized or applied.

## Acceptance sequence

1. Seal and approve the real five-manifest Master snapshot.
2. Populate and publish the six corporations, 20 official stores, selected employees, and effective assignments through the immutable Core lifecycle.
3. Onboard the three real Staging subjects through AUTH-01.
4. Add approved M019 `actual`/`budget` grants and HUB Role attestations; `forecast` remains absent.
5. Connect `handleManagementFromDeployedBaseline(...)` to the single server-resolved adapter and remove its Store Operations dependency on Legacy `public` masters.
6. Run Executive, Area Manager, Store Manager, scope-spoof, raw-UUID, missing-to-preparing, and zero-synthetic Hosted UAT.

Production change, Store Operations business write, fake identity, fake Role, direct Canonical Fact write, and Legacy `public` master restoration remain prohibited.
