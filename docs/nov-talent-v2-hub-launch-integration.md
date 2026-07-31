# NOV Talent v2 HUB Launch Integration

## Branch dependency

This integration branch is based on commit `ad22e03` from Draft PR #11. Draft PR #11 must land before, or be included in, the integration PR. Neither branch is merged to `main` by this work.

## Responsibility boundary

- HUB label: `求人管理`
- Internal app: `NOV Talent`
- Scope: candidates, selection, events, and next actions before employment
- `NOV People`: employee lifecycle after hiring. Employee management, onboarding procedures, transfers, leave, retirement, labor, payroll, and employee profiles remain outside NOV Talent.
- Candidate-to-Employee handoff is a lifecycle boundary through Employee Core. NOV Talent does not create a second employee database.

## Existing formal role mapping

| Existing role key | HUB card | Talent access |
| --- | --- | --- |
| `super_admin` | visible | full |
| `executive` | visible | dashboard; candidate contact/private notes and write controls hidden |
| `backoffice`, `hr.admin` | visible | full |
| `hr.staff` | visible | candidates, selection, events, next action; no settings |
| all other existing roles | hidden | direct URL returns 403 |

No new Permission Model role is introduced.

## Session and Auth Guard

- The HUB refreshes and stores the canonical `nov_hub` session before launch.
- Talent reuses the same-origin session and the stored HUB employee context; no second login page is added.
- Missing or expired session: Talent displays a HUB return action.
- Valid session with an unauthorized role: Talent displays 403.
- URL query parameters never grant roles. The local fixture is accepted only on `localhost` or `127.0.0.1`.

## Local integration runbook

1. From the repository root, run `python -m http.server 8765`.
2. Open `http://127.0.0.1:8765/portal/?nov_navi_preview=1&demo=1`.
3. Use the local demo selector:
   - `代表取締役`: dashboard access with private candidate fields hidden.
   - `総務人事部長`: full access.
   - `高橋 採用担当`: recruiter access without settings.
   - `佐藤 スタッフ`: the 求人管理 card is hidden.
4. Click `求人管理` and confirm navigation to `http://127.0.0.1:8765/portal/talent/` without another login.
5. For the staff fixture, open `/portal/talent/` directly and confirm 403.
6. Log out from HUB, open `/portal/talent/` directly, and confirm the HUB return screen.
7. To reproduce expiry locally, open `http://127.0.0.1:8765/portal/?nov_navi_preview=1&demo=1&talent_session=expired`, sign in with a permitted demo role, and launch 求人管理. Talent must show the HUB return screen instead of the dashboard.

The local integration uses Mock Runtime only and performs no Supabase, production, JWT contract, Permission Model, or database mutation.
