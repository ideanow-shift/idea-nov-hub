# CoreOS request: HUB zero-GAS shared integration gate

Date: 2026-07-17

## Decision requested

```yaml
hub_zero_gas_goal: all_GAS_runtime_source_and_portal_routes_removed
authoritative_integration_baseline: decision_required
shared_main_js_integration:
  preserve_HR_role_release_change: required
  replace_EDUCATION_APP_URL_with_local_route: approval_requested
tracked_gas_backend_delete: approval_requested
education_pages_source_publish: approval_requested
portal_apps_zero_gas_DML: separate_production_approval_required
apps_script_deployment_disable: separate_operator_gate_required
```

## Exact source integration scope

- Preserve all current HUB Core, HR, LINE WORKS, Management, IDEA LINK, and NOV
  NAVI changes.
- Add `portal/education-app/` static source.
- Change Education card and fallback route to `./education-app/`.
- Remove tracked `gas-backend/.clasp.json`, `Code.gs`, `Setup.gs`, and
  `appsscript.json`.
- Supersede the old SQL candidates that update or restore Education GAS URLs.
- Keep all Education write controls disabled until DB/RPC/Edge write gates are
  approved.

## Evidence already available

- Education static fixture: 12/12 PASS.
- Education read domain + HTTP fixtures: 17/17 PASS.
- Candidate HUB runtime GAS references: 0.
- Candidate tracked GAS backend files: 0.
- Forbidden Education API source scan: 0 hits.
- No production action has been taken.

## Required response

Please identify the authoritative integration baseline that includes the
unpushed HUB Core HR changes, and approve or revise the exact source scope
above. Production DML, push/publish, Apps Script disablement, and deploy remain
separate gates.
