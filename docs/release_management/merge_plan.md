# Integration Merge Plan

## Scope

This is a future merge sequence. It does not authorize a merge now.

## Rules before any merge

1. One release owner opens a release branch from a recorded current `main` SHA.
2. Candidate branches are rebased once onto that release base in an isolated worktree.
3. A candidate must have a clean worktree, scoped diff, passing tests, release notes, and rollback target.
4. No force push, no conflict auto-resolution, and no unrelated file cleanup.
5. A failed or conflicting candidate leaves the release branch unchanged and returns to its domain owner.

## Release 1.0 proposed sequence

| Order | Candidate family | Why this order | Merge blocker |
| ---: | --- | --- | --- |
| 1 | Core DB governance/docs | establishes terminology and pending boundaries | contradiction with ADR/governance |
| 2 | NOV HUB platform shell | common navigation while preserving legacy routes | auth/openApp boundary regression |
| 3 | Store Operations local-only UX | consumes no production source | parser/visual regression |
| 4 | Accounting local aggregate UX | provides local readiness only | source/period claim becomes misleading |
| 5 | NOV Talent local UI/validation | preserves data quarantine and existing staging boundaries | canonical/promotion path becomes reachable |

## Release 1.1 proposed sequence

| Order | Candidate family | Required evidence before merge |
| ---: | --- | --- |
| 1 | Core DB audited-read-only package | D01-D10 approvals and catalog-only smoke receipt |
| 2 | Store Master/API contract | SSoT and UUID decision pack accepted |
| 3 | Accounting confirmed-source adapter | finance owner approval of source/formula/period |
| 4 | Store Operations server read-only integration | HUB session/server scope and API tests |
| 5 | NOV Talent bounded integration | Talent endpoint-specific approval and independent receipt |
| 6 | NOV HUB aggregate provider wiring | each provider owner confirmation; unavailable remains omitted |

## Required merge record

```yaml
release: 1.0|1.1
release_branch: release/<version>
base_main_sha: recorded_before_rebase
candidate_branch: domain_owned_branch
candidate_commit: immutable_sha
tests: pass
security_boundary: verified
rollback_target: previous_release_sha
approval_reference: required_for_integration_work
```

Any item without this record remains outside the release.
