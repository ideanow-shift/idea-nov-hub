# NOV NAVI Today Provider Candidate

Source-only candidate for a future `novNaviTodayRead` action in `nov-hub-api`.

- Reuse existing verified HUB/Firebase authentication and employee resolution.
- Resolve employee active/login state before provider reads.
- Each provider returns only one bounded aggregate; unavailable or invalid values are omitted.
- The candidate emits no individual data, role/scope data, token, raw error, URL, or provider payload.
- This directory is not deploy input. It does not modify `supabase/functions/nov-hub-api/index.ts`.

## Registry boundary

- `nov-navi-today-provider-registry.ts` contains only the five fields that may later become runtime candidates after their domain owners confirm the definitions.
- `inquiries` is intentionally held. It has no provider contract and cannot be resolved until NOV Support fixes its department-scope decision, allow condition, and aggregate bound.
- The registry executes no query and accepts no browser authority input.

## Readiness boundary

- `nov-navi-today-provider-readiness.ts` keeps every provider disabled until its domain owner confirms both the aggregate definition and server-side authorization boundary.
- The confirmation object must contain exactly the five registered provider keys. Missing or extra keys fail closed.
- This is a source-only gate. It is not browser input, a feature flag, or runtime authorization.
- `buildNovNaviTodayEnvelopeForReadyProviders` demonstrates the later composition boundary: pending provider confirmations result in zero provider calls.
