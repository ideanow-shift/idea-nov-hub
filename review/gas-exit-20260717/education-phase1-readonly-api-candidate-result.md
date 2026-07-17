# Education Phase1 read-only API candidate result

Date: 2026-07-17
Classification: LOCAL_REHEARSAL_PASS
Production status: not deployed; no live session or database call

## Completed source boundary

- Added a dependency-injected domain handler for three read-only actions only:
  - `educationListMyAssignments`
  - `educationGetContentManifest`
  - `educationGetMyProgress`
- The backend contract verifies the HUB session and resolves the employee actor server-side.
- Browser payload actor, employee, role, and scope overrides are rejected.
- Inactive, login-disabled, retired, retirement-status, and leave-status actors fail closed.
- Gateway calls are always scoped with the server-resolved `public.employees.id` candidate.
- Gateway output uses explicit response allowlists and runtime validation for UUIDs, enums, timestamps, content versions, and opaque content references.
- Write actions, HTTP transport, table names, Storage, notifications, and deploy configuration are absent.

## Verification

```text
deno fmt --check: PASS
deno check domain.ts: PASS
deno test education-readonly-domain-fixture.ts: 9/9 PASS
education-app-static-fixture.mjs: 12/12 PASS
hub-zero-gas-source-fixture.mjs: PASS runtime=0 source=0
git diff --check: PASS
```

The fixtures also confirm that employee email, Storage paths, raw filenames, actor IDs, token fields, and Authorization fields do not enter the safe response.

## Remaining production evidence

The source intentionally does not select production schema/table names or implement the HTTP Edge wrapper. CoreOS review is required for:

1. Production schema and table ownership for programs, content versions, assignments, progress events, and completions.
2. RLS versus RPC ownership for employee-scoped reads.
3. Reuse of the current canonical HUB session verifier and its audience contract.
4. Whether the next source-only gate may add the dedicated HTTP wrapper and Supabase read adapter.

No production DDL, DML, RPC, GRANT, Secret, notification, Storage, push, publish, or deploy was performed.
