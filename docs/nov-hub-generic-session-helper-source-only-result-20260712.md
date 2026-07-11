# Generic NOV HUB session helper source-only result

Date: 2026-07-12

## Candidate

- `portal/index.html`
- `portal/js/main.js`
- `portal/js/nov-hub-session-candidate.js`
- `review/nov-hub-session-candidate-fixture-20260712.mjs`
- `docs/nov-hub-generic-session-helper-integration-contract-20260712.md`

## Implemented candidate behavior

- Getter-only browser contract: `window.NovHubSession.getSessionToken()`.
- Requires `audience=nov_hub` and a future expiry.
- Uses memory first and same-origin `sessionStorage` for reload recovery.
- Defines one canonical key: `ideaNov.hub.session.v1`.
- Reads two existing app-specific keys temporarily for migration compatibility.
- Never reads or writes `localStorage`.
- Clears memory and storage on logout integration, 401, 403, or invalid/expired state.
- Returns no employee ID, roles, permissions, or store scope.

## Source-only wiring

- HUB entry loads `main.js` once with an explicit cache-bust version.
- `main.js` imports the helper once.
- Existing HUB memory is registered as the preferred source.
- A valid PIN-issued `hubSession` is written to the canonical session key.
- Firebase login and demo mode clear any HUB session state.
- HUB logout clears canonical and temporary legacy session state.
- Restored helper state does not log the user into the HUB UI by itself.
- Decision and Talent do not consume the global helper yet.
- IDEA LINK and master-admin were not edited by this gate.

## Security assessment

```yaml
token_in_url: false
token_in_body: false
token_in_localStorage: false
token_in_dom_or_log: false
employee_role_scope_exposed_by_helper: false
backend_revalidation_still_required: true
idea_link_changed: false
master_admin_changed: false
```

## Check results

```yaml
helper_node_check: pass
main_node_check: pass
fixture_result: pass
fixture_count: 11
valid_hub_session: pass
audience_mismatch: pass
expired_session: pass
legacy_key_read_compatibility: pass
memory_provider_priority: pass
duplicate_load_fail_safe: pass
restore_to_memory: pass
clear_on_401: pass
clear_on_403: pass
localStorage_access: false
token_or_personal_value_printed: false
git_diff_check: pass
line_ending_warning_only: true
local_hub_http: 200
local_hub_title: NOV_HUB
local_login_screen_visible: true
local_helper_fixture_dom_result: pass
local_unauthenticated_token: null
local_console_error_warn_count: 0
```

## Current decision

```yaml
source_candidate_ready: true
publish_approved: false
live_smoke_approved: false
recommended_next_gate: commit_and_publish_review
```
