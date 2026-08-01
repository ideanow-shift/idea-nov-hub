# NOV Talent v2 main baseline

- Baseline: `origin/main`
- Commit: `24486d8b61061c104922c8dc5e9a1d5732cb06a4`
- Recorded: 2026-08-01
- Scope: non-Playwright NOV Talent tests plus HUB dashboard and Store CSV boundary regressions
- Result: 160 tests, 156 passed, 4 failed

The four baseline failures were stale expectations around the former write-enabled Talent runtime, workspace exact-one network request, and exact cache hashes. They were recorded before any release-repair change. Production, DB, Supabase, JWT, RLS, Permission Model and UUID were not changed.

Main already contains the current HUB shell, Design System, CSV compatibility fixes, staff-facing Talent UI, Store Operations boundaries, and the frozen NOV People/workforce source. The release repair therefore layers Candidate-only Mock Runtime behavior onto current main instead of replaying the historical branch.
