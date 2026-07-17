# Education Phase1 read-only API contract

Date: 2026-07-17
Status: source-only domain candidate; no HTTP wrapper, DB call, deploy, or live session

## First vertical slice

Only the employee's own learning flow is included:

1. `educationListMyAssignments`
2. `educationGetContentManifest`
3. `educationGetMyProgress`

Store progress, education administration, completion writes, notifications, attachments, KPI, promotion/debut, and interview/motivation are later gates.

## Identity boundary

- Browser supplies only the existing HUB session Bearer through the shared transport.
- The backend verifies the HUB session and resolves `public.employees.id` server-side.
- `employeeId`, actor, role, and scope fields are rejected from payload.
- Inactive employees, disabled login credentials, retirement dates, and leave/retirement statuses fail closed.
- Every gateway method receives the resolved employee ID and must include ownership filtering in its query/RPC.

## Response boundary

- Assignment response: opaque assignment ID, program title, status, due time, progress percentage.
- Content response: safe manifest only; no Storage path, signed URL, raw filename, answer text, or private metadata.
- Progress response: event type, percentage, and occurrence time only.
- Maximum 100 rows; no employee identity or raw auth data.
- Gateway output is validated again at runtime: UUIDs, enums, timestamps, content versions, and opaque content references fail closed when malformed.

## Implementation gate

The candidate intentionally has no Supabase table names or HTTP verifier implementation. CoreOS must approve production table/schema names, RLS/RPC ownership, and reuse of the canonical HUB session verifier before an Edge deploy candidate is built.
