# GAS remaining inventory

- Date: 2026-07-17
- Classification: PRODUCTION_EVIDENCE_REQUIRED
- Audit mode: read-only; no push, publish, DML, Apps Script action, or Secret
  access

## Fresh remote evidence

Observed `origin/main`: `0ee2e04c9f3727be8d4bfb73af8d947d07e60ff5`

The fresh remote still contains these GAS dependencies:

1. Four tracked GAS backend files under `gas-backend/`.
2. Education GAS URL in `portal/js/apps.js`.
3. Education GAS fallback URL in `portal/js/main.js`.
4. `supabase/portal-apps-display-fix-candidate-20260717.sql` updates `EDU` to a
   GAS URL.
5. `supabase/portal-apps-display-fix-rollback-candidate-20260717.sql` restores
   another GAS URL.

## Shared ownership evidence

The shared HUB Core worktree `work/hub-core-safe-rebaseline-20260717` was
observed ahead 9 and behind 6. It has an unpushed HR access change in
`portal/js/main.js`, the same file that must lose the Education GAS fallback.
The HR change and Education change are logically non-conflicting, but the file
ownership overlaps and must be integrated from a fresh baseline.

## Isolated replacement candidate

The isolated Education branch contains local commits that:

- add `portal/education-app/`;
- route Education to `./education-app/`;
- remove the tracked GAS backend files;
- add strict zero-GAS runtime/source fixtures;
- add source-only Education read domain and HTTP boundary candidates.

Latest local candidate commit at this audit stage: `039a445`.

No local candidate was pushed because fresh remote and shared HUB Core work both
advanced.

## Required final cutover gates

1. Rebuild the zero-GAS runtime/source changes on the authoritative HUB
   integration baseline while preserving the HR access change.
2. Supersede both GAS portal_apps SQL candidates with the no-GAS proposal.
3. Execute production `portal_apps` DML only after Core approval and SELECT-only
   precheck.
4. Confirm the Education Pages URL is HTTP 200 before enabling the card.
5. Disable/archive remaining Apps Script deployments through the approved
   operator path and record only non-secret deployment status evidence.

Until these gates complete, the repository candidate is ready but production GAS
removal is not complete.
