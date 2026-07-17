# CoreOS request: Education Phase1 read-only next gate

Date: 2026-07-17

## Current result

The HUB runtime and tracked source have zero GAS references in the isolated candidate. The Education static application candidate is complete and all operational write controls remain disabled. A production-agnostic, source-only read domain candidate now passes 9/9 security fixtures.

## Decision requested

```yaml
education_phase1_readonly_domain_candidate: review
production_schema_table_names: decision_required
employee_scoped_read_ownership:
  rls: decision_required
  rpc: decision_required
canonical_hub_session_verifier_reuse: decision_required
next_source_only_gate:
  dedicated_http_edge_wrapper: approval_requested
  supabase_read_adapter: approval_requested
deploy_publish_live_smoke: hold
```

## Proposed next source-only scope

- Dedicated Education read-only Edge candidate.
- Exactly three actions: assignment list, safe content manifest, own progress.
- Canonical HUB session Bearer verification; no Firebase or email fallback.
- Server-side actor, login, employment, role, and scope revalidation.
- Employee-scoped read adapter only after production table/RPC ownership is confirmed.
- No write helper, signed URL, Storage path, notification, external send, or Secret value.
- Deno checks, local fixtures, exposure scan, and deploy-before pack only.

## Still stopped

- Production DDL/DML/RPC/GRANT and RLS changes.
- Edge deploy and frontend publish.
- Live session or production data reads.
- Completion writes, assignment administration, notification, attachments, Storage, KPI, and interview/motivation features.
- Secret, role, employee_roles, portal_apps, and os.notifications changes.
