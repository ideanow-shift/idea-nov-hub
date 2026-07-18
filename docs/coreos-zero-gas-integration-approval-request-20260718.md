# CoreOS request: integrated zero-GAS source gate

- Date: 2026-07-18
- Authoritative GitHub baseline: `e8182fec871456391e0097256179b527bb69c4a2`
- Preserved HUB Core integration tip: `e7bd6b748ff25b04b408e315ab4dc2528039ab44`
- Zero-GAS integration source commit: `530c5684d70b3c3dacf7dcad5815f12d5be4e3cd`
- Review document commit before this SHA refresh:
  `14d10c00fe143fbec96e74e452ff63ff476c8bff`
- Push/publish/production access: 0

## Integrated result

The isolated candidate starts from the latest remote plus the nine unpushed HUB
Core commits. It then applies the reviewed zero-GAS source and evidence commits.
HR role release, LINE WORKS readiness, Management, master-data intake, IDEA
LINK, and NOV NAVI changes are preserved.

The candidate now has:

- Education Pages source and local routes.
- No tracked GAS backend.
- No active runtime or executable legacy endpoint.
- No SQL/runner capable of restoring a legacy external application URL.
- Education read-only domain and HTTP source candidates.
- A SELECT-only production precheck and unexecuted zero-GAS DML/rollback
  candidates.

## Decision requested

```yaml
integrated_source_candidate_530c568: review
combined_commit_chain:
  hub_core_nine_commits: preserve
  zero_gas_source_and_evidence_commits: approve_for_normal_push
force_push: prohibited
production_select_precheck: separate_approval_requested
production_dml: hold
education_pages_publish: separate_gate_after_source_push
apps_script_deployment_disable: separate_operator_gate
education_edge_deploy: hold
```

## Evidence

- Strict HUB GAS exit: PASS.
- portal_apps zero-GAS validator: 11/11 PASS.
- Education static: 12/12 PASS.
- Education read-only domain/HTTP: 17/17 PASS.
- HR, LINE WORKS, Core SELECT runner, master catalog, and Management regression
  checks: PASS.
- Runtime/executable legacy endpoint scan: 0 hits.
- Local PostgreSQL execution: not started; runtime unavailable.
- Production mutation: 0.

## Required sequencing

1. Review and normally push the combined source chain without force.
2. Confirm Education public route HTTP 200 while the production card remains
   unchanged.
3. Approve and execute the sanitized SELECT-only `portal_apps` precheck.
4. Build sealed DML hashes from the fresh evidence and request a separate DML
   approval.
5. Disable/archive Apps Script deployments only after the new route is verified
   and the card is cut over.

No successful write, notification, Storage operation, Secret change, role
change, production DB mutation, or Apps Script action is included in this
request.
