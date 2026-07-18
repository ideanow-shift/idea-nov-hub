# GAS disable/archive operator handoff

This handoff is source-only. It is not permission to disable triggers, archive
an Apps Script deployment, inspect Script Properties, rotate credentials, or
delete anything.

## Prerequisite

The disable/archive lane may be executed only after a separately approved
read-only evidence result returns:

```text
GAS_RETIREMENT_EVIDENCE_READY
```

If the prior evidence is missing, stale, or any non-READY category, the only
allowed result is `RETIREMENT_ACTION_ABORTED_SAFE_STOP`.

## Fixed identities

- Disable/archive contract: `gas-retirement-disable-archive-v1`
- Contract file:
  `review/gas-exit-20260717/gas-retirement-disable-archive-contract.json`
- Required result shape: exactly the contract `sanitizedResultShape.requiredKeys`
- Terminal categories: exactly the contract `terminalCategories`

## Operator return

The later separately approved execution gate must return exactly one sanitized
JSON object with these keys and no others:

```json
{
  "contractVersion": "gas-retirement-disable-archive-v1",
  "category": "GAS_DEPLOYMENT_ARCHIVED_CLEAN",
  "priorEvidenceReady": true,
  "legacyWriteFreezeConfirmed": true,
  "replacementRoutesStillReady": true,
  "approvedActiveTriggerCount": 0,
  "disabledTriggerCount": 0,
  "remainingActiveTriggerCount": 0,
  "deploymentArchiveAttempted": true,
  "deploymentArchived": true,
  "postArchiveObservationReady": true,
  "mutationCount": 0,
  "secretInspectionCount": 0,
  "rawLogCaptured": false,
  "rawPayloadCaptured": false,
  "deletionPerformed": false
}
```

The numbers above are only an example shape. A real run must use the approved
active trigger count from the immediately preceding evidence gate.

## Category precedence

1. Missing prior READY evidence, replacement route drift, missing write freeze,
   deletion, Secret/Script Properties inspection, raw log capture, raw
   request/response capture, shape drift, or unexpected action boundary:
   `RETIREMENT_ACTION_ABORTED_SAFE_STOP`.
2. Disabled trigger count does not equal the approved active trigger count, or
   any active trigger remains:
   `TRIGGER_DISABLE_NOT_EXACT`.
3. Deployment archive was not attempted exactly once, or archived state is not
   confirmed:
   `DEPLOYMENT_ARCHIVE_NOT_EXACT`.
4. Post-archive replacement route observation is not ready:
   `POST_ARCHIVE_OBSERVATION_NOT_EXACT`.
5. Only if all conditions match:
   `GAS_DEPLOYMENT_ARCHIVED_CLEAN`.

Any non-clean category stops the lane. No retry, deletion, Secret rotation, or
follow-up mutation is implied.

## Output boundaries

Record only fixed booleans, counts, and categories.

Do not record:

- Apps Script URL, deployment ID, script ID, trigger ID, or file ID
- Script Properties or any Secret value
- raw logs, stack traces, request bodies, response bodies, or payload values
- credentials, tokens, keys, cookies, or session values
- user names, employee IDs, row data, or business payload values
- raw command output or private object identifiers

## After clean archive

`GAS_DEPLOYMENT_ARCHIVED_CLEAN` means disable/archive completed under the
approved narrow gate. It does not authorize deletion, credential rotation,
database mutation, notification send, or any product behavior change outside
the retired GAS deployment boundary.
