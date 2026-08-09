# Outcome 2 — Daily Workflow Contract

Status: local authoring only. Staging apply and write activation are not authorized.

## Source ownership

- Communication History is an append-only `COMMUNICATION_RECORDED` Event with a timestamp, method, direction, result, reply-wait state, minimized summary, actor and audit.
- Next Action uses the existing `nov_talent_next_actions_v1` table. It is not Selection History and never changes Candidate current status.
- Selection History remains the sole official recruiting-stage fact. Outcome 1 remains enabled independently.
- Suggested Actions are disabled rules/fixtures only and are never persisted automatically.

## Lifecycle and priority

Allowed transitions are `OPEN → COMPLETED`, `OPEN → ON_HOLD`, `ON_HOLD → OPEN`, and `OPEN|ON_HOLD → CANCELLED`. All other transitions fail closed. Physical deletion is forbidden.

Priority is derived only from the due date: overdue, today, future, or unscheduled. No editable high/medium/low field exists.

## Transaction and privacy

When an operator explicitly elects to create a follow-up, Communication, Next Action, and both audit rows are written by one security-definer RPC transaction. Failure rolls back every row. Conversation transcripts and private notes are not accepted; only a summary of at most 1,000 characters is stored.

## API boundary

- `GET /api/talent/v1/daily-workflow` is read-only and uses Daily Workflow Contract `1.0.0`.
- `POST /api/talent/v1/communications` and `POST /api/talent/v1/next-actions` require the existing authenticated HUB session, a canonical recruiting role, and `NOV_TALENT_OUTCOME2_WRITES_ENABLED=true`.
- Actor UUID and role are server-resolved. Browser input cannot supply them.
- Workspace Contract remains `1.0.0`; no Workspace response key is added.

## Activation

`NOV_TALENT_OUTCOME2_WRITES_ENABLED` defaults to false. This change does not apply a Staging migration, enable the flag, or write Staging/Production business data.
