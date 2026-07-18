# GAS retirement read-only evidence handoff

This handoff is source-only. It does not approve or perform production SQL,
Apps Script trigger changes, deployment archival, Secret inspection, or
deletion.

## Fixed identities

- Evidence contract: `gas-retirement-evidence-v1`
- Contract file:
  `review/gas-exit-20260717/gas-retirement-evidence-contract.json`
- Required result shape: exactly the contract `sanitizedResultShape.requiredKeys`
- Terminal categories: exactly the contract `terminalCategories`

## Operator return

The later production read-only gate must return exactly one sanitized JSON
object with these keys and no others:

```json
{
  "contractVersion": "gas-retirement-evidence-v1",
  "category": "GAS_RETIREMENT_EVIDENCE_READY",
  "replacementRouteCount": 1,
  "recentExecutionCount": 0,
  "requiredTriggerCount": 0,
  "unresolvedDependencyCount": 0,
  "mutationCount": 0,
  "secretInspectionCount": 0,
  "replacementRoutesReady": true,
  "recentExecutionPresence": false,
  "activeTriggerRequired": false,
  "knownDependencyUnresolved": false,
  "secretOrPropertyInspection": false,
  "rawLogCaptured": false,
  "rawPayloadCaptured": false
}
```

The numbers above are an example of the only READY shape. A real run must use
fresh read-only evidence.

## Category precedence

1. Any missing key, extra key, wrong type, mutation, Secret/Script Properties
   inspection, raw log capture, or raw request/response capture:
   `EVIDENCE_CONTRACT_FAILED`.
2. Any replacement route not ready or no replacement route evidence:
   `REPLACEMENT_ROUTE_NOT_READY`.
3. Any recent Apps Script execution presence:
   `GAS_TRAFFIC_STILL_PRESENT`.
4. Any active trigger still required by production behavior:
   `GAS_TRIGGER_STILL_REQUIRED`.
5. Any unresolved external dependency owner:
   `DEPENDENCY_OWNER_NOT_READY`.
6. Only if all counts and booleans satisfy the ready rule:
   `GAS_RETIREMENT_EVIDENCE_READY`.

Any non-READY category stops the retirement lane without disabling anything.

## Evidence boundaries

Allowed evidence is limited to fixed counts, booleans, and categories:

- replacement public route readiness count/category
- Apps Script recent execution presence count/category
- active trigger required count/category
- unresolved dependency owner count/category
- mutation count fixed at zero
- Secret/Script Properties inspection count fixed at zero

Do not record:

- deployment URLs, if not already public and non-secret
- request or response bodies
- Script Properties
- raw logs, stack traces, or query text
- credentials, tokens, keys, cookies, or session values
- user names, employee IDs, row data, or business payload values
- project IDs, file IDs, or private object identifiers

## Next gate

If and only if the return category is `GAS_RETIREMENT_EVIDENCE_READY`, the next
gate is a separate explicit disable/archive approval. That later gate may still
stop if trigger counts, replacement routes, or dependencies drift.
