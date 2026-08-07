# Fresh DB Rehearsal Environment Lifecycle Policy

**Status:** FROZEN

**Owner:** IDEA NOV OS Owner

**Scope:** Core Business Data Foundation disposable Supabase rehearsal environments

## Rehearsal tiers

### Tier 1 — Local Fresh DB Rehearsal (default)

Use an ephemeral local PostgreSQL environment for ordinary migrations. It proves DDL, keys, constraints, indexes, triggers, functions, lifecycle, negative tests, immutability, rollback, reapply and catalog equality. It must not connect to Production or idea-nov-staging and must be deleted in the same Run.

### Tier 2 — idea-nov-staging

After PR merge, use Staging for the final Supabase Cloud proof: actual Supabase PostgreSQL migration, RLS/forced RLS, grants and role behavior, `security_invoker`, Supabase-specific catalog, official validation SQL and rollback-only synthetic fixtures. Real data remains prohibited until this Gate passes.

### Tier 3 — Fresh Supabase Cloud Project (exception)

Use only when Staging cannot safely prove a destructive migration, a Supabase-specific feature requires a fresh Cloud baseline, Cloud rollback proof is release-critical, or the Staging baseline cannot reproduce the required condition. Any additional cost requires explicit Owner approval. It is not the normal migration Gate.

## Capacity and Cloud creation gate

- At most one Cloud Rehearsal Project may be ACTIVE at any time.
- Before creation, the Project inventory must prove `ACTIVE Rehearsal Project = 0`.
- A nonzero result prohibits creation.
- `idea-nov-core` and `idea-nov-staging` are permanently PROTECTED and are never Rehearsal cleanup targets.

## Required run metadata

The following values must be frozen before Project creation: `run_id`, purpose, target PR, target Migration, Owner, Apply owner, Review owner, Deletion owner, `created_at`, `delete_by`, and expected maximum cost. A run without `delete_by` must not create a Project.

## Run lifecycle

`CREATE -> IDENTITY VERIFY -> TEST -> EVIDENCE SAVE -> DELETE -> DELETE VERIFIED -> RUN COMPLETE`

TEST includes the authorized forward migration, validation, negative tests, rollback and reapply. The Project creator remains responsible through cleanup. The Reviewer independently confirms `DELETE VERIFIED`; creator self-attestation is insufficient.

## Deletion gate

Before deletion, fix the Project ID and verify: approved deletion manifest membership, identity match, no Production/Staging identity, business rows zero, Auth users zero, Storage objects zero, PII zero, and no active run. Delete one Project at a time and re-list Projects before continuing.

The run cannot be marked complete while its local runtime, database or Cloud Project exists. Deletion evidence must prove runtime/process/data-directory absence for Tier 1, or absent Project ID and healthy PROTECTED Projects for Tier 3.

## Cost governance

Record the provider cost estimate before creation and inspect Organization Usage, Compute Hours, Compute Credits and Upcoming Invoice after deletion when available. Do not replace provider evidence with inferred cost.
