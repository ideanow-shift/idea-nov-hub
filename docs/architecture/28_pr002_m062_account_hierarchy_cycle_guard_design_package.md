# PR002 / M062 Account Hierarchy Cycle Guard — Design Package

## Decision

M062 is an additive correction to the already-applied M013 contract. It neither edits M013 nor changes Account tables, RLS, grants, mappings, classifications, or immutable history.

Option A (UNION the NEW edge into a recursive CTE) is selected for deterministic graph semantics. Option B is equivalent but less explicit. A standalone validator alone (option C) does not solve concurrent write skew. M062 therefore combines A with one transaction advisory lock and a deferred constraint trigger.

## Graph and effective dating

The virtual edge is `NEW.account_id -> NEW.parent_account_id` over `NEW.effective_period`. Each recursive hop may use only an Account version whose half-open range overlaps the accumulated common period. The common period is intersected at every hop. A cycle exists only when every edge is simultaneously valid for at least one instant. Adjacent `[from,to)` versions do not overlap; historical cycles outside NEW's interval do not fail. Different versions of one Canonical identity remain separate rows, while the identity is correctly the graph node.

The parent must have the same statement type and a version whose effective period contains the entire NEW period. Self, two-node, three-or-more-node, NEW-completed, boundary and overlapping-period cycles fail closed.

## Concurrency

Account hierarchy writes are structural and low-volume. Every INSERT takes the same transaction-scoped advisory lock `(13013,62)`. A BEFORE trigger performs immediate NEW-inclusive validation. A DEFERRABLE INITIALLY DEFERRED constraint trigger revalidates the persisted edge at transaction completion, after serialized competing hierarchy writers. This prevents two concurrent INSERTs from jointly committing a cycle without adding a mutable lock table. Locks release automatically on commit or rollback; callers must treat commit failure as transaction failure.

## Security and rollback

All functions are SECURITY INVOKER with a fixed empty search path and no Consumer EXECUTE grant. M013 forced RLS and default-deny grants are unchanged. Rollback drops only the M062 trigger/helper functions and restores the exact M013 validator body; CASCADE is prohibited.

## Release gate

Local PostgreSQL 17 must prove forward application, all graph cases, parent and mapping period mismatches, complete M013 regression, concurrent cycle prevention, M062-only rollback, full rollback residue zero, reapply, and catalog equality. Commit, Staging corrective apply, M014, data load, and Production access remain unauthorized until their separate gates.
