# Decision Hub read-only live smoke result / auth transport blocked 2026-07-11

## Result

Decision Hub read-only live UI is published, but browser smoke reached a safe auth stop.

This is not a write/DML failure.
It is an auth transport mismatch between the HUB PIN session and the standalone Decision Hub page.

## Public state confirmed

- URL: `https://ideanow-shift.github.io/idea-nov-hub/decision-hub/?v=12b32fa`
- HTTP status: 200
- public `portal/decision-hub/app.js`: `DECISION_HUB_READONLY_LIVE = true`
- write buttons disabled:
  - `申請`
  - `承認`
  - `差戻し`
  - `却下`
- forbidden visible text: false
- console error/warn: none in the inspected tab

## Browser smoke result

Safe result:

```yaml
noticeTitle: Unable to verify
noticeBody: Open this screen from a signed-in NOV HUB session.
summaryDraft: 0
summaryWaiting: 0
summaryReturned: 0
requestRowCount: 1
writeButtonsDisabled: true
forbiddenTextVisible: false
consoleErrorWarnCount: 0
```

## Cause

`portal/js/api.js` keeps PIN auth in module-local `currentAuth`.

```js
let currentAuth = { authType: "firebase" };

export function setPinAuth(email, pin) {
  currentAuth = { authType: "pin", email: String(email || "").trim(), pin: String(pin || "").trim() };
}
```

When the user navigates to `./decision-hub/`, the Decision Hub page imports a fresh module instance and starts from:

```js
currentAuth = { authType: "firebase" }
```

Therefore the Decision Hub page does not inherit the PIN auth transport that was set on the HUB top page.

## Safety assessment

This stop is correct and safe:

- no token / PIN / raw claims / raw response recorded
- no write UI enabled
- no DML attempted
- no Edge deploy performed
- no RLS / GRANT change
- no Secret change
- no `os.notifications` change

## Do not solve by

Do not pass PIN through:

- URL query
- localStorage
- sessionStorage
- HUB context
- console snippet
- raw browser payload

Do not make Decision Hub trust:

- browser-provided employee id
- roleKeys / appKeys
- `hub_context` alone
- display label / position name

## Next gate proposal

Create a `Decision Hub PIN-auth transport bridge design pack`.

Candidate directions:

1. Firebase-first path
   - If Firebase token exists, use existing `getIdToken()` path.
   - PIN-auth users remain safe-stopped until a server-issued transport exists.

2. Server-issued short-lived HUB session token
   - On successful PIN login, Edge/backend issues an opaque short-lived session reference.
   - Store only the opaque reference client-side.
   - Never store raw PIN.
   - Decision Hub page uses the opaque reference to call read-only actions.
   - Edge/backend resolves actor server-side and rechecks employee active/login-enabled state.

3. Same-page embedded Decision Hub panel
   - Keep `currentAuth` in the same module/page runtime.
   - Avoid cross-page PIN transport.
   - Decision Hub appears inside HUB shell as a panel/route instead of standalone page.

## CoreOS decision requested

Please decide the preferred auth transport direction before further live smoke:

```yaml
decision_hub_readonly_live_smoke:
  result: safe_stop
  blocked_by: PIN auth transport not inherited by standalone page
  write_disabled: true
  dml: none
  forbidden_exposure: false

requested_next_gate:
  name: decision_hub_pin_auth_transport_bridge_design_pack
  choose_direction:
    - firebase_first_only
    - server_issued_short_lived_hub_session_reference
    - same_page_embedded_decision_hub_panel
```

## Still stopped

- successful draft create retry
- B1 broader DML smoke
- DB direct RPC smoke
- UI write connection
- Edge deploy
- RLS / GRANT
- notification enqueue
- attachment / Storage
- Secret / service_role change
- role / employee_roles change
- portal_apps update
- os.notifications schema change
- rollback / drop
