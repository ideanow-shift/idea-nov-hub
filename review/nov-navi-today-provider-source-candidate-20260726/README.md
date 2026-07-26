# NOV NAVI Today Provider Candidate

Source-only candidate for a future `novNaviTodayRead` action in `nov-hub-api`.

- Reuse existing verified HUB/Firebase authentication and employee resolution.
- Resolve employee active/login state before provider reads.
- Each provider returns only one bounded aggregate; unavailable or invalid values are omitted.
- The candidate emits no individual data, role/scope data, token, raw error, URL, or provider payload.
- This directory is not deploy input. It does not modify `supabase/functions/nov-hub-api/index.ts`.
