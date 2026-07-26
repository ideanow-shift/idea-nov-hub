# NOV NAVI Notice Contract Candidate

Source-only candidate for a future `novNaviNoticeRead` action.

- It accepts only a sanitized, structural notice shape for the existing NOV NAVI notice surface.
- It limits the display payload to three items with type, title, body, unread, and actionable fields.
- URLs, control characters, extra fields, malformed values, and non-array payloads are omitted.
- It contains no provider read, database query, action wiring, notification send, or client-side authority input.
- This directory is not deploy input and does not modify `supabase/functions/nov-hub-api/index.ts`.
