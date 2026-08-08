# PR002 / M015 Corrective / M063 Import Batch Local Concurrency — Design Package

## Root cause and boundary

M015 seals terminal Import Batch membership by taking `SHARE` locks on the complete File and Staging Line tables. Two transactions that already hold child-table `ROW EXCLUSIVE` locks can therefore deadlock while both upgrade to global table locks. M015 is already applied to Staging and remains immutable. M063 changes only the active seal functions and trigger bindings; Journal, Fact, Allocation, tax, security and table contracts do not change.

## Option decision

Option A, advisory lock only, is not selected: a child trigger can acquire an advisory lock before a concurrent Batch `UPDATE` has already acquired the Batch row, recreating an advisory/row ordering inversion unless every caller follows an external protocol. Option B plus C is selected. The existing `import_batches` row is the collision-free batch-local mutex, and two-Batch operations lock UUIDs in ascending order. A deferred revalidation is added because an immediate statement that waited for a row lock can retain an older command snapshot.

## Lock contract

The single order is `Batch row(s), ascending UUID -> File/Staging Line row operation`. File and Staging Line INSERT/UPDATE/DELETE acquire `FOR UPDATE` on their Batch row before M012 lifecycle validation. Batch status UPDATE already owns that same row before its BEFORE ROW triggers execute. Same-Batch writers and finalizers therefore serialize; different Batch UUIDs do not share a lock. Transaction rollback or abort releases every row lock automatically.

The active M063 guard contains no `LOCK TABLE`. The three established `a_m015_*` trigger names are retained so they still execute before the M012 `guard_*` triggers. The original M015 function remains available solely for exact M063 rollback and has no active binding while M063 is applied.

## Commit-time integrity

M012 continues to perform the immediate lifecycle and membership check. M063 adds a DEFERRABLE INITIALLY DEFERRED constraint trigger for a Batch entering `validated`. At transaction completion it rechecks File existence and status, Staging Line existence and status, at least one valid line, and each File row count. A stale immediate snapshot can therefore cause only a conservative retry, never an invalid commit.

## Security and scope

Both M063 functions are SECURITY INVOKER with an empty search path. PUBLIC, anon, authenticated and service_role receive no EXECUTE grant. M015 RLS, grants, six tables, data contracts and immutable rules are unchanged. M016 validation/approval, publication, Consumer projection, data load, Staging corrective apply and Production are outside this authoring sprint.

## Verification

PostgreSQL 17 must prove different-Batch parallelism, same-Batch waiting and serialization, File/Line mutation exclusion during finalization, rollback and timeout lock release, deadlock delta zero, retained locks zero, M015 Negative 60/60 regression, M063-only rollback, full rollback residue zero, reapply and catalog equality.
