# DBF Handoff Edge Root Routing Corrective

## Scope

This corrective is limited to NOV HUB Edge request-contract validation. It does
not change the applied `dbf_handoff` migration, database objects, Cloud Run,
Pages, IAP, or any business-data path.

## Root cause

The stored v120 bundle and approved v121 source use the same path
normalization, HTTP method dispatch, body parser, action-missing fallback, and
authentication order. The v121 runtime addition is confined to two additive
actions inside the existing POST action dispatcher:

- `dbfStagingHandoffIssueV1`
- `dbfStagingHandoffExchangeV1`

The reported `404 NOT_FOUND` probe did not send the intended JSON bytes.
PowerShell native-command quoting removed JSON quotes before `curl.exe` sent
the request. `request.json()` therefore failed, the existing parser returned
an empty object, and the existing `!action` fallback correctly returned 404.
An in-process request built with `JSON.stringify` reaches the additive handoff
branch and returns the expected 401 for missing HUB authentication.

The same matrix exposed one genuine additive-action integration gap. NOV HUB's
existing API client puts `authType="hub_session"` in the payload envelope.
The v121 issue action treated that established envelope field as an unknown
business field and returned 400 before authentication. The runtime corrective
accepts only that exact envelope value; the backend still forces HUB-session
verification, and every other extra field remains rejected.

## Minimal corrective

No runtime-router replacement or auth-precedence change is required. The only
runtime hunk recognizes the existing HUB auth envelope at the additive issue
action boundary. The corrective also adds a byte-stable in-process contract
test around the actual Edge entrypoint and a versioned 15-case request matrix.
The fixture does not use shell quoting, network, credentials, or a database.

The contract locks:

- liveness 200 with `dataAccessed=false`;
- OPTIONS 204;
- existing form and JSON action routing;
- missing/invalid auth fail-close behavior;
- additive handoff negative behavior;
- frontend actor spoof rejection;
- no network/data access, DB writes, token logging, or request-body logging.

## Redeploy plan (not executed)

After PR review and separate Owner approval:

1. confirm active Edge version is the rollback v122 carrying the v120 bundle;
2. deploy the merge commit's `nov-hub-api` bundle once;
3. read back the Supabase-assigned version, ACTIVE state, `verify_jwt=false`,
   file hashes, and bundle digest;
4. execute the same negative request matrix with a byte-safe client;
5. keep positive issue/exchange and durable-store writes disabled;
6. on any mismatch, redeploy the captured v120 bundle and safe-stop.

Migration, Pages, Cloud Run, positive handoff, and business data remain out of
scope.
