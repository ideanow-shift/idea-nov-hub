# Project Topology Review Summary

## Decision

**CONDITIONAL PASS.** A two-project topology is appropriate: `idea-nov-core` remains Production, and `idea-nov-staging` serves as shared Staging for Store Operations, NOV Talent, Finance, and HUB. A third project is not justified by the present evidence.

## Conditions Before Use

1. Reconfirm the remote Sandbox inventory and identity without exposing values.
2. Approve schema/function/storage/dataset ownership for all four domains.
3. Configure protected deployment environments and separate Staging auth/URL/secret boundaries.
4. Establish the shared migration calendar, owner approvals, and rollback evidence format.
5. Confirm that required project-level secret administration can remain least-privilege; otherwise isolate the affected domain in another project.

## Non-Changes

Production access, Project rename/change, migration, schema/RLS/grant update, secret registration, deploy, and dataset transfer are all zero in this review.
