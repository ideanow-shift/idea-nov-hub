# Decision Hub read-only live frontend publish result 2026-07-11

## Result

Decision Hub read-only live frontend publish limited execution completed.

## Executed

- Pulled/rebased latest `origin/main`.
- Pushed approved frontend commits to `main`.
- Public GitHub Pages post-check executed.

## Published commits after rebase

- `7b25b14 Add Decision Hub usability gate packs`
- `209a513 Prepare Decision Hub read-only live UI`
- `12b32fa Add Decision Hub read-only publish gate`

Note: hashes changed from the earlier local-only commits because `origin/main` had one newer commit and rebase was required before push.

## Public URL

- `https://ideanow-shift.github.io/idea-nov-hub/decision-hub/?v=12b32fa`

## Post-check result

Passed:

- public URL returned HTTP 200
- public `portal/decision-hub/app.js` contains `DECISION_HUB_READONLY_LIVE = true`
- public page contains `設計中 / DB未接続`
- public page contains `本番申請はまだ送信されません`
- public page contains `進捗状況`
- write buttons remain disabled:
  - `申請`
  - `承認`
  - `差戻し`
  - `却下`
- no `script.google.com` detected in public HTML
- no `service_role` detected in public HTML or public Decision app JS check
- no API key / Secret literal detected in public check patterns
- no write action string detected in public Decision app JS check

## Notes

- Initial public JS response still showed the old flag, then updated after GitHub Pages propagation.
- This publish did not include Edge deploy.
- This publish did not enable write UI operations.
- This publish did not change RLS / GRANT / Storage / Secret / roles / `os.notifications`.

## Still stopped

- Edge deploy
- successful draft create retry
- UI write connection
- RLS / GRANT
- notification enqueue
- Storage / attachment
- Secret / service_role change
- role / employee_roles change
- portal_apps update
- os.notifications schema change
- rollback / drop

## Next suggested gate

Read-only live smoke from a signed-in NOV HUB session:

- open Decision Hub from NOV HUB
- confirm list area resolves to safe list, safe empty state, or safe error
- record no token / PIN / raw claims / raw response / employee id / application id
- do not test draft create or write actions
