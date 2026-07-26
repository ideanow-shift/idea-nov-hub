# NOV NAVI Today Provider Source-Only Design

## Status

This is a source-only design. It does not add an API action, change an Edge Function, query a database, or alter authentication.

## Candidate Boundary

`NOV NAVI` must request one aggregate-only response from a HUB-owned backend action candidate named `novNaviTodayRead`.

The browser sends no employee ID, role, store scope, app identifier, aggregate key, or token in the request body. Existing authenticated transport remains the only authentication input. The backend must resolve the employee, active login state, role validity, and scope independently for every request.

## Proposed Response

```json
{
  "schema": "nov-navi-today-v1",
  "aggregates": {
    "schedule": 0,
    "tasks": 0,
    "approvals": 0,
    "thanks": 0,
    "inquiries": 0,
    "growthPoints": 0
  }
}
```

Only integer aggregates between `0` and `1000000` are accepted. An unavailable provider omits its field. The NOV NAVI client therefore displays only verified fields and retains the compact pending state when none are available.

## Provider Ownership

| Field | Provider domain | Required backend verification |
| --- | --- | --- |
| `schedule` | Attendance | current employee and permitted schedule scope |
| `tasks` | Task Manager | current employee only |
| `approvals` | Decision Hub | assigned action scope |
| `thanks` | IDEA LINK | current IDEA LINK permission |
| `inquiries` | NOV Support | permitted inquiry scope |
| `growthPoints` | Growth | current employee only |

## Fail-Closed Rules

- Invalid authenticated session: return the existing safe authentication failure.
- Unknown key, out-of-range value, identity field, free text, URL, token, or raw provider error: reject the whole response.
- A single provider failure must not produce a synthetic zero. Its field is omitted.
- No client retry loop, no localStorage/sessionStorage cache, and no partial user identity is permitted.
- The response is not an authorization source for any application action.

## Separate Gates Required

1. HUB backend action/source candidate review.
2. Per-provider aggregate query contract and scope review.
3. Edge deploy limited execution.
4. Authenticated read-only smoke with sanitized count categories only.

## Explicitly Out Of Scope

- DB DDL/DML/RLS/RPC/GRANT
- Secret, JWKS, token, or session transport changes
- Notification enqueue or external send
- App-specific write actions
- Individual values, names, emails, employee IDs, stores, or raw rows
