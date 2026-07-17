# HUB portal_apps zero-GAS supersession

- Date: 2026-07-18
- Status: source/static candidate only
- Production mutation: 0

## Superseded executable artifacts

The 2026-07-17 display-fix SQL, rollback SQL, validator, execution runner, and
synthetic SQL fixture were removed from the candidate. They could update or
restore external legacy application routes and must not remain production
execution inputs.

Historical Markdown audit records remain as evidence only. Git history retains
the retired files when an audit requires their exact prior content.

## Replacement candidate

- `supabase/portal-apps-zero-gas-cutover-precheck-20260718.sql`: SELECT only;
  emits route categories and booleans without raw URLs.
- `supabase/portal-apps-zero-gas-cutover-candidate-20260718.sql`: routes `EDU`
  to `./education-app/` and disables legacy `THANKS`.
- `supabase/portal-apps-zero-gas-cutover-rollback-candidate-20260718.sql`:
  disables `EDU`; never restores an external URL.
- `tools/validate_portal_apps_zero_gas_cutover_20260718.mjs`: static source
  validator only.

No production executor is included. A fresh SELECT precheck, exact production
evidence, sealed hashes, and separate CoreOS production DML approval are
required before any execution pack can be created.
