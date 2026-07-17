# HUB GAS source retirement result

Date: 2026-07-17
Classification: `PRODUCTION_EVIDENCE_REQUIRED`

## Local source result

- Removed the four tracked files under `gas-backend/` in an isolated local candidate.
- Public portal and Edge source contain zero `script.google.com`, `google.script.run`, legacy deployment ID, and GAS API URL references.
- Education launches the local `./education-app/` candidate.
- IDEA LINK uses stable semantic identity and its local route, not a GAS deployment ID.
- Added a strict source fixture requiring both runtime GAS references and tracked GAS source files to be zero.

## Not executed

- No push or GitHub Pages publish.
- No Apps Script deployment disable/delete.
- No `clasp` command.
- No trigger removal or notification send.
- No Script Properties, Secret, role, database, or production data change.

## Production gate

Before this source deletion is published, CoreOS must confirm that current production consumers no longer call the Apps Script deployment. Deployment shutdown, trigger removal, and credential rotation remain separate production gates.
