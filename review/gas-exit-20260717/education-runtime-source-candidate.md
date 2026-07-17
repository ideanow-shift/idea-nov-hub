# Education Hub runtime source candidate

Date: 2026-07-17
Baseline: fresh `origin/main`
Classification: `LOCAL_SOURCE_REPAIR_REQUIRED`

## Purpose

Replace the HUB Education launch path that still points at a GAS Web App with a local GitHub Pages application candidate. This candidate is deliberately static and does not claim backend parity.

## Runtime changes

- Add `portal/education-app/` with staff, store manager, and education admin views.
- Change the Education fallback URL in `portal/js/apps.js` and `portal/js/main.js` to `./education-app/`.
- Remove the IDEA LINK legacy GAS deployment ID classifier. App ID, app name, and local route matching remain.
- Keep all Education write controls disabled.

## Safety boundary

- No fetch, Supabase client, GAS, browser storage, token, Secret, notification, or Storage integration.
- No production publish or `portal_apps` update.
- No live education data and no real user or application identifiers.
- The current GAS deployment is not disabled by this source candidate.

## Remaining product work

- HUB session consumer and server-side employee/role/scope resolution.
- Read APIs for assignments, content, progress, and completion.
- Reviewed write RPC/Edge actions for progress and completion.
- Explicit ownership decisions for KPI, interview/motivation, promotion/debut, and notifications.
- Production evidence that `portal_apps` no longer needs legacy GAS URLs before publication.
