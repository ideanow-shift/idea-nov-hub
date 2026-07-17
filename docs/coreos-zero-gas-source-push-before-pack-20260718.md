# CoreOS Decision Hub / HUB zero-GAS source push-before pack

- Date: 2026-07-18
- Classification: `PRODUCTION_EVIDENCE_REQUIRED`
- Fresh authoritative GitHub main: `ebe0e6cdc6e0da41b96d25409d4d6864e6e38ed5`
- Candidate HEAD before this pack commit:
  `ad6969c3a8241d9e33dd9ae9534a44ff758d9c8c`
- Candidate tree: `dc5a14dbe44ae8baba90b03ec1a9f44626114553`
- Commit count over GitHub main: 21
- Changed tracked paths over GitHub main: 66
- Push, publish, production DB access, and Apps Script action: 0

## Fast-forward evidence

- A fresh `git fetch github main` completed on 2026-07-18.
- Fresh `github/main` is an ancestor of the candidate HEAD.
- No merge, reset, force push, or history rewrite is requested.
- The chain preserves the nine reviewed HUB Core commits and adds the reviewed
  Education / zero-GAS source and evidence commits.

## Runtime result

- `portal/education-app/` is the Education new-web source.
- Portal routing uses `./education-app/`.
- Tracked `gas-backend/` files are removed.
- Active portal and Edge runtime GAS endpoint hits: 0.
- Legacy Apps Script deployment ID hits across the repository: 0.
- Executable SQL and runners that could restore the legacy GAS URL are removed.
- The replacement rollback can only disable the Education card; it cannot
  restore a GAS route.
- Production `portal_apps` is unchanged until a fresh SELECT-only precheck and
  separate DML approval.

## Verification after fresh rebase

```text
Strict HUB GAS exit: PASS (7 files / 10 forbidden patterns)
portal_apps zero-GAS validator: PASS (11/11)
Education static fixture: PASS (12/12)
Education read-only domain and HTTP: PASS (17/17)
HUB zero-GAS source fixture: PASS
HR runtime access: PASS (9/9)
LINE WORKS inventory: PASS (8/8)
Core SELECT-only runner: PASS (10/10)
Master data catalog precheck: PASS (8/8)
Management regression suite: PASS (67/67)
git diff --check: PASS
Fresh GitHub main ancestor check: PASS
```

Local PostgreSQL execution is unavailable in the separated lane. No SQL process
was started and no production data was accessed. This is not treated as a source
blocker; production state remains `PRODUCTION_EVIDENCE_REQUIRED`.

## Requested next gate

```yaml
normal_fast_forward_push:
  decision: requested
  max_count: 1
  force: prohibited
  target: origin/main
  preserve_shared_hub_core_commits: true

after_push:
  education_public_http_200: requested
  production_portal_apps_mutation: hold
  apps_script_deployment_disable: hold
  education_edge_deploy: hold

separate_following_gate:
  production_select_only_precheck: requested_after_source_publish
  sealed_portal_apps_dml: hold_until_fresh_evidence
  apps_script_disable_archive: hold_until_new_route_verified
```

## Hard stop conditions

- Fresh remote main no longer remains an ancestor of this candidate.
- A shared ownership overlap appears after this pack.
- The public Education route is not HTTP 200.
- The production SELECT-only precheck does not match the expected current card
  set.
- Any step would require a Secret, production credential, force push, write
  action, notification, Storage mutation, role change, or destructive rollback.

No production DDL, DML, RPC, RLS, GRANT, Secret, notification, Storage,
deployment disable, push, publish, or live write is authorized by this pack.
