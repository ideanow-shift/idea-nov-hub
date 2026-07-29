# 06. Migration Runbook

This is a production application plan, not authorization to execute it.

## Step 1 - Backup

1. Freeze Core Master writes through the approved maintenance mechanism.
2. Take and verify a restorable logical backup of `public.stores`, employees,
   roles, assignments, dependent tables, policies, grants, functions, and
   views.
3. Record schema hashes, migration version, row counts, and rollback owner.

## Step 2 - Expand

1. Apply `V001__store_history.sql` in staging only.
2. Apply `V002__rls_policy.sql` in staging only after identity prechecks.
3. Do not backfill history and do not alter store UUIDs.

## Step 3 - Verify

1. Run catalog queries for `public.stores` and any `core.stores` object.
2. Capture FK/view/function/API dependency inventory and the Tokorozawa UUID
   evidence described in `02-uuid-remediation.md`.
3. Run the role matrix under representative, executive, department, store
   manager, FC owner, employee, anonymous, and service roles.
4. Run regression suite and verify history overlap, FK, and RLS test results.

## Step 4 - Switch

1. Publish the v1 Store API contract with `public.stores.id` as canonical.
2. Enable runtime reads only after crosswalk decision and staging sign-off.
3. Keep legacy UUIDs read-only and reject legacy writes.

## Step 5 - Rollback

1. Disable the new API route/feature flag.
2. Drop only the new policies and history table if no approved production
   history events have been written; otherwise retain records and restore
   read-only access.
3. Restore prior policy/grant configuration from the verified backup.
4. Never roll back by rewriting canonical or legacy UUIDs.

## Step 6 - Contract

1. Store Runtime consumes only the v1 projection.
2. Store API owns UUID normalization and crosswalk resolution.
3. Core Master owns changes and history commands.
4. Database is protected by FK, overlap constraints, RLS, and audit evidence.
