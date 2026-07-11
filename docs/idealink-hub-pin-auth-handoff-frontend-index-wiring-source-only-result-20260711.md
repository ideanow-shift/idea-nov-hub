# IDEA LINK frontend index wiring source-only result 2026-07-11

## Status

Source-only wiring candidate was applied locally and preview-smoked.

No GitHub Pages publish, live valid handoff smoke, production auth switch, DB change, Edge deploy, Secret change, or LINE WORKS send was executed.

## Current progress

- Thanks coin feature API migration: 99%
- HUB entry migration: 100%
- BASSA management system new Web migration: 90%
- POS new Web migration: 39%
- Human Capital new Web migration: 5%
- Decision Hub: 44%
- Attendance Schedule Supabase migration: 59%

## Changed candidate files

- `portal/js/api.js`
- `portal/js/idea-link-handoff-candidate.js`
- `portal/idea-link-app/index.html`

## Source-only wiring summary

### `portal/js/api.js`

- Added IDEA LINK session auth candidate.
- Added `clearIdeaLinkSessionAuth()`.
- Added dedicated `exchangeIdeaLinkHandoff(handoffCode)` helper.
- Kept handoff exchange payload limited to `{ handoffCode }`.
- Kept app-session token out of JSON payload.

### `portal/js/idea-link-handoff-candidate.js`

- Added memory-first + sessionStorage reload recovery handoff helper.
- Uses `handoff_code`.
- Removes handoff code from URL before exchange.
- Validates `audience`, expiry, session presence, and target view.
- Clears API auth state when IDEA LINK session is cleared.

### `portal/idea-link-app/index.html`

- Imports candidate handoff helpers.
- Initializes handoff before legacy HUB Context/Firebase path.
- Preserves existing no-code HUB context behavior.
- Allows app-session entry without exposing admin by default.
- Maps backend `my-page` to current frontend `my`.
- Replaces forced `setFirebaseAuth()` calls with auth-preserving `prepareIdeaLinkApiAuth()`.
- Adds 401/403 app-session failure handling that clears state and returns to NOV HUB.
- Makes the header HUB return link clear IDEA LINK session before navigating back.

## Static check results

- `node --check portal/js/api.js`: pass
- `node --check portal/js/idea-link-handoff-candidate.js`: pass
- `git diff --check -- portal/js/api.js portal/js/idea-link-handoff-candidate.js portal/idea-link-app/index.html`: pass
  - line-ending warnings only
  - whitespace error: none
- forbidden frontend scan:
  - `localStorage`: no hit
  - `script.google`: no hit
  - `googleusercontent`: no hit
  - `service_role`: no hit
  - `SUPABASE_SERVICE_ROLE`: no hit
  - `HUB_APP_SESSION_SIGNING_SECRET`: no hit
  - `console.log/warn/error`: no hit
  - `Authorization`: no hit
  - `Cookie`: no hit

## Local/static preview smoke

Preview method:

- Local Node static server
- Localhost only
- No publish
- No live valid handoff code
- No raw response/token/Secret/session value recorded

Cases:

### `normal_no_code`

- page visible: true
- title: `サンクスコイン | NOV HUB`
- thanks coin marker: true
- HUB return marker: true
- handoff code in URL: false
- admin nav visible: false
- forbidden marker exposure: false
- console error/warn count: 0

### `invalid_handoff_code`

- page visible: true
- title: `サンクスコイン | NOV HUB`
- thanks coin marker: true
- HUB return marker: true
- handoff code removed from URL: true
- admin nav visible: false
- forbidden marker exposure: false
- console error/warn count: 0

## Not tested in this gate

- Valid live handoff code exchange
- Production HUB PIN to IDEA LINK handoff
- GitHub Pages public publish/post-check
- Backend role denial live scenario
- Expired/reused live code scenario

## Still stopped

- GitHub Pages publish
- live valid handoff smoke
- production auth switch
- PIN actual-value submission
- Secret value display
- additional Edge deploy
- DB change
- LINE WORKS send

## Self judgment

The source-only wiring candidate is ready for external/Core review and a publish-before pack.

Do not publish until the changed frontend files and local/static preview result are approved.
