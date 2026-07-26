# NOV NAVI Today Provider Contract Matrix v1

## Status

Source-only contract candidate. It fixes the six provider boundaries required before a clean `nov-hub-api` candidate can be prepared. It authorizes no runtime action, query, deploy, or database change.

## Shared Rules

- The HUB resolves the authenticated active employee and login state before any provider read.
- Each provider receives only a server-side actor capability. Browser employee, role, scope, store, purpose, and aggregate fields are not accepted.
- Every provider returns one integer aggregate only, with `0 <= value <= 1000000`, or an unavailable result.
- Each provider executes a single aggregate query or aggregate endpoint call. It must not return rows, IDs, names, emails, dates, free text, URLs, or raw errors.
- Provider `503` and invalid output are normalized by HUB to an omitted field. HUB returns `503` only when the verified HUB actor cannot be resolved or every requested provider is unavailable.

| Today field | Accountable domain owner | Fixed purpose | Actor scope | Maximum read | Aggregate definition | Provider 503 condition |
| --- | --- | --- | --- | --- | --- | --- |
| `schedule` | Attendance / Shift | `nov_navi.schedule_today_count` | current employee only | one aggregate | today in the approved business timezone | schedule provider unavailable or timezone contract unavailable |
| `tasks` | Task Manager | `nov_navi.open_task_count` | current employee only | one aggregate | open tasks assigned to the current employee | task provider unavailable or assignee scope cannot be resolved |
| `approvals` | Decision Hub | `nov_navi.pending_approval_count` | current assigned approver only | one aggregate | actionable pending approvals assigned to the current employee | Decision actor or assignment scope unavailable |
| `thanks` | IDEA LINK | `nov_navi.received_thanks_count` | current IDEA LINK employee only | one aggregate | received thanks in the current calendar month | IDEA LINK employee permission cannot be revalidated |
| `inquiries` | NOV Support | `nov_navi.inquiry_response_count` | current employee or approved department scope | one aggregate | responses awaiting the actor's confirmation | support scope or route permission unavailable |
| `growthPoints` | Growth | `nov_navi.monthly_growth_points` | current employee only | one aggregate | current calendar month growth-point total | growth profile or period definition unavailable |

## HUB Aggregation Behavior

1. Resolve verified HUB actor, current employment, and login status.
2. Invoke only the six fixed provider adapters above.
3. Omit unavailable provider fields without substituting `0`.
4. Validate the final response against `nov-navi-today-v1`.
5. Return aggregate values only. The client never treats them as permission grants.

## Required Owner Confirmations Before Runtime Candidate

- Attendance: business timezone and whether no schedule is `0`.
- Task Manager: exact definition of open status.
- Decision Hub: actionable assignment status set.
- IDEA LINK: calendar-month boundary and received-status definition.
- NOV Support: employee versus department scope and response state.
- Growth: point source and month boundary.

## Explicit Holds

- `supabase/functions/nov-hub-api/index.ts` wiring
- API/Edge deploy, DB reads, provider endpoint calls, and authenticated smoke
- DDL/DML/RLS/RPC/GRANT, Secret, notification, and external send
