# Final Review Checklist

## Required Authoring Evidence

- [ ] `C01`--`C10` remain untouched.
- [ ] `S01`--`S08` remain historical conditional templates and non-executable.
- [ ] Exactly one new namespace: `SOCE-QP01`--`SOCE-QP06` and `SOCE-MANIFEST-v1`.
- [ ] No SQL text, connection value, secret, token, raw UUID, Auth subject, or
  employee PII is stored in the repository.
- [ ] Stage 0 identity/schema gate blocks Stage 1 on any mismatch.
- [ ] Private Schema/Column Contract and private Pack manifest are hash-bound.
- [ ] No dynamic SQL, schema discovery fallback, arbitrary query, RPC, retry,
  or artifact on failure exists.
- [ ] Source/Target roles mechanically require read-only transaction/default,
  no DML/DDL/function write, no `BYPASSRLS`, and no service role.
- [ ] Corporation/Store rules include 6 corporations, official 20, direct 13,
  franchise 7, non-store separation, and Tokorozawa legacy relation state.
- [ ] Employee/assignment rules preserve AM deny-by-default, store-manager
  coverage, and Sales Department Head `UNRESOLVED` handling.
- [ ] Target pre-state requires zero Canonical Master/Auth/anchor/access rows
  and existing M019 presence.
- [ ] Sanitizer and deterministic canonicalization contracts are documented.
- [ ] In-memory static/fixture/security tests pass.
- [ ] `git diff --check` passes and worktree is clean before review.

## Review Outcome

**Package authoring complete:** only after the above checklist passes.

**Final Review ready:** yes, once the Draft PR is created and repository checks
pass. Do not move the PR to Ready for Review in this Authoring package.

**Read-only execution approved:** no. It remains contingent on a later Owner
authorization that fixes private identity/profile fingerprints, role expiry,
private Pack hashes, Schema/Column Contract hash, execution window, retention
location, operator, and reviewer.
