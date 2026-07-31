# Clean release branch report

- Branch: `release/nov-talent-v2-clean-base`
- Base: `origin/main@24486d8b61061c104922c8dc5e9a1d5732cb06a4`
- Effective migrated commits: 2
- Duplicate historical commits excluded: 87
- Candidate seed: 147 anonymous candidates
- Today task limit: 5
- Runtime: Mock only; network and persistence disabled
- Scope: Recruitment Dashboard, Candidate List, Candidate Detail, event/contact/selection history, next actions and Sprint 2 UX
- Excluded: NOV People and post-entry employee management
- Local fixed regression: 195/195 passed
- Browser review: 147 candidates, five tasks, search/filter/sort, profile and three history sections confirmed
- Mobile review: 390px viewport, document scroll width equals client width
- Browser console: 0 errors, 0 warnings

The branch is intentionally based on current main and contains no Production, DB, Supabase, JWT, RLS, Permission Model, UUID or migration change.
