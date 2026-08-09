# Final Review Checklist

## Required Authoring Evidence

- [ ] `C01`--`C10` remain untouched.
- [ ] `S01`--`S08` remain historical conditional templates and non-executable.
- [ ] Exactly one new namespace: `SOCE-QP01`--`SOCE-QP06` and `SOCE-MANIFEST-v1`.
- [ ] No SQL text, connection value, secret, token, raw UUID, Auth subject, or
  employee PII is stored in the repository.
- [ ] Stage 0 identity/schema gate blocks Stage 1 on any mismatch.
- [ ] Stage 0 requires both Source/Target PostgreSQL major version 17 and each
  profile's approved exact/min/max numeric version policy.
- [ ] Private Schema/Column Contract, expected-object-set hash, and private
  Query-registry are hash-bound.
- [ ] All 16 Query IDs have a fixed Query Version, type/schema version, and
  private SQL SHA-256 attestation before QP01; Pack hash does not substitute.
- [ ] Private profiles enforce not-before, expiry, fingerprint, broker
  reference, and broker preflight before a connection opens.
- [ ] One atomic pre-registered Owner binding / `run_id` claim rejects unknown,
  duplicate, FAILED, COMPLETE, and concurrent execution; retry remains zero.
- [ ] Atomic sealed bundle prepare/verify/commit has abort/revoke compensation;
  no final artifact survives any failure.
- [ ] Component cleanup attests connections, raw results, payloads, manifests,
  evidence, logs, downloads, listeners, child processes, and directories.
- [ ] No dynamic SQL, schema discovery fallback, arbitrary query, RPC, or
  caller-controlled retry exists.
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

**Final Review ready:** only after the repaired fixture/security suite, GitHub
review, and repository checks pass. Do not move the PR to Ready for Review in
this repair package.

**Read-only execution approved:** no. It remains contingent on a later Owner
authorization that fixes private identity/profile fingerprints, role expiry,
private Pack hashes, Schema/Column Contract hash, execution window, retention
location, operator, and reviewer.
