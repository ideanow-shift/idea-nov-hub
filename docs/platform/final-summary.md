# Project Topology Review Summary

## Decision

**CONDITIONAL PASS.** A two-project topology is appropriate: `idea-nov-core` remains Production, and `idea-nov-staging` serves as shared Staging for Store Operations, NOV Talent, Finance, and HUB. A third project is not justified by the present evidence.

The [Staging First Development Policy](staging-first-development-policy.md) is the governing development rule: existing Production applications remain unchanged, while Core Business Data Foundation, Store Operations, Finance, Management Platform, and Digital Signage complete in Staging before one separately approved final Production cutover.

## Conditions Before Use

1. Reconfirm the remote Sandbox inventory and identity without exposing values.
2. Approve schema/function/storage/dataset ownership for all four domains.
3. Configure protected deployment environments and separate Staging auth/URL/secret boundaries.
4. Establish the shared migration calendar, owner approvals, and rollback evidence format.
5. Confirm that required project-level secret administration can remain least-privilege; otherwise isolate the affected domain in another project.

## Non-Changes

Production access, Project rename/change, migration, schema/RLS/grant update, secret registration, deploy, and dataset transfer are all zero in this review.
