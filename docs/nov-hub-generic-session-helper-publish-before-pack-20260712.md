# Generic NOV HUB session helper publish-before pack

Date: 2026-07-12

## Current state

Source-only wiring and local checks are complete. Commit and publish remain HOLD pending CoreOS approval.

## Future publish scope candidate

Frontend publish scope candidate:

- `portal/index.html`
- `portal/js/main.js`
- `portal/js/nov-hub-session-candidate.js`

Do not include:

- IDEA LINK files
- master-admin files
- Edge Functions
- DB/SQL/RLS/GRANT/RPC
- Secret or notification files

## Required pre-publish checks

- JavaScript syntax checks pass.
- Unit fixtures pass.
- `git diff --check` passes.
- changed-file scope is exact.
- no token/PIN/Secret logging.
- no localStorage access in the helper.
- no token URL/query/body/DOM path.
- IDEA LINK handoff regression diff is zero.
- master-admin diff is zero.
- normal HUB login/logout source behavior remains intact.

## Completed pre-publish checks

```yaml
helper_node_check: pass
main_node_check: pass
fixture_count: 11
fixtures: pass
duplicate_load_fail_safe: pass
unauthenticated_token_null: pass
local_hub_http_200: pass
local_login_screen_visible: pass
local_console_error_warn_count: 0
git_diff_check: pass
localStorage_in_helper: false
token_url_body_dom_log_path: false
idea_link_gate_edits: 0
master_admin_gate_edits: 0
```

The worktree already contains unrelated/pre-existing dirty files. A future commit must use explicit path-limited staging and verify the staged diff contains only the three frontend files above.

## Future public post-check

- HUB public URL HTTP 200.
- PIN/Firebase login behavior unchanged.
- getter is available only after helper load.
- no session returns `null`.
- valid session returns a token to an in-memory test consumer without printing it.
- logout clears helper state.
- 401/403 simulation clears helper state.
- console error/warn count is zero.
- IDEA LINK handoff and master-admin launch remain healthy.
- forbidden exposure is false.

## Stop conditions

- A consumer requests token in URL/body/localStorage.
- Client employee/role/scope values are used as authority.
- IDEA LINK or master-admin changes become necessary.
- Backend bearer validation or public-master revalidation is absent.
- Any live token must be printed or inspected.
- Dirty unrelated files would enter the commit/publish.

## Decision requested later

```yaml
hub_main_source_only_wiring: completed
commit_creation: hold
push_publish: hold
live_smoke: hold
```
