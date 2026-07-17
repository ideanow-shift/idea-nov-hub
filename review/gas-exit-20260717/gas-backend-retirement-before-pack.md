# HUB GAS backend retirement before-pack

Date: 2026-07-17
Status: source-only candidate; deployment shutdown is not approved

## Tracked backend

The repository still tracks four Apps Script source/configuration files under `gas-backend/`. Runtime portal references are removed separately from backend source retirement so they can be reviewed and rolled back independently.

## Retirement conditions

1. Public HUB runtime has zero `script.google.com` and `google.script.run` references.
2. Education launches the local `./education-app/` route.
3. IDEA LINK is recognized through stable application identity rather than a legacy deployment ID.
4. Existing non-GAS replacements for HUB API actions remain available.
5. Production evidence confirms no consumer still invokes the Apps Script deployment.
6. Script Properties and deployment shutdown are handled as separate credential/production gates.

## Candidate scope

- Delete only `gas-backend/.clasp.json`, `gas-backend/Code.gs`, `gas-backend/Setup.gs`, and `gas-backend/appsscript.json` from Git in an isolated local commit.
- Do not run `clasp`, disable a deployment, rotate a Secret, modify a trigger, or mutate production data.
- Preserve audit evidence in review documents without copying credential values or business data.

## Current gate

The source deletion candidate may be prepared locally. Push, deployment shutdown, trigger removal, and Secret rotation require CoreOS production approval.
